---
title: "CS336 Assignment 2：从 FlashAttention 到 FSDP"
description: "完整实现 Transformer benchmark、activation checkpointing、Triton FlashAttention、DDP、optimizer state sharding 与 FSDP，并用公开测试和 CPU/Gloo smoke test 核验正确性。"
date: 2026-07-26
tags:
  - cs336
  - llm
  - systems
  - engineering
lang: zh-CN
featured: true
draft: false
series: stanford-cs336
seriesOrder: 2
---

> 本文对应 Stanford CS336 Spring 2026 的 **Assignment 2: Systems and Parallelism**。我不是 Stanford 在校生，也没有把它当作正式课程提交；这是一份独立实现、公开复盘的学习记录。
>
> **结论先行：仓库测试为 16 passed、4 skipped；实现文件通过 Ruff。通过项包含 10 个 Stanford 公开 CPU/Gloo 测试和 6 个独立回归测试。4 个 skipped 都是当前机器没有 CUDA 而无法运行的 Triton GPU 测试。本文不会用 CPU smoke 数字冒充 GPU 性能。**

## 快速入口

- [Assignment 2 独立公开代码仓库][assignment]
- [Stanford 官方作业仓库][handout]
- [实现细节讲解][implementation-explanation]
- [许可证、归属与学术诚信说明][notice]
- [公开测试适配层][adapters]

公开仓库从安全审计后的 Assignment 2 快照重新初始化，不带 coursework monorepo 历史；所有代码链接固定在 root commit [`3ff1df4`][coursework-commit]，避免后续仓库变化让本文与代码错位。

## 1. 这份作业真正要求什么

Assignment 2 不是单独实现一个 kernel。它把 Transformer 训练系统拆成一条连续的学习路径：

1. 先建立可信的 benchmark 与 profiler，知道时间和显存花在哪里。
2. 用 mixed precision、activation checkpointing 改变计算与显存的平衡。
3. 用 online softmax 和 tiling 实现 FlashAttention，减少 HBM 往返。
4. 从单卡进入多卡：实现 DDP、通信计算重叠和 optimizer state sharding。
5. 最后实现 FSDP，把参数和梯度也切到不同 rank，并推导 DP、FSDP、TP、2D parallelism 的通信边界。

作业提供了 Assignment 1 的 Transformer staff implementation、公开测试、adapter hooks 和提交脚本。我的实现保持 `tests/adapters.py` 为薄适配层，核心逻辑全部放在 `cs336_systems/`，这样 benchmark、测试和后续实验共享同一套实现。

| 文件 | 职责 |
|---|---|
| [`attention.py`][attention] | PyTorch autograd attention 与 Triton FlashAttention forward/backward |
| [`checkpointing.py`][checkpointing] | 连续 Transformer block 的 activation checkpointing |
| [`distributed.py`][distributed] | naive、flat、overlap 三种 DDP 与分布式辅助函数 |
| [`optim.py`][optim] | optimizer state sharding |
| [`fsdp.py`][fsdp] | Linear/Embedding row-shard FSDP |
| [`scripts/`][scripts] | Transformer、attention、distributed benchmark 与 memory snapshot |
| [`tests/adapters.py`][adapters] | 公开测试到实现的唯一连接层 |

## 2. 先把 benchmark 做可信

GPU benchmark 最容易犯的错误，是只量 Python 函数返回所花的时间。CUDA kernel 是异步执行的；如果不在测量边界调用 `torch.cuda.synchronize()`，量到的主要是 CPU 提交 kernel 的时间。

[`benchmark_transformer.py`][benchmark-transformer] 支持：

- `small / medium / large / xl / 10B` 五档模型；
- `forward / backward / train` 三种测量模式；
- warmup 次数与正式测量次数；
- BF16 autocast、`torch.compile`；
- activation checkpoint chunk size；
- mean、std、min、max 四个统计量。

测量循环的边界是：

```text
warmup
  -> synchronize
repeat N times
  -> start timer
  -> forward / backward / optimizer step
  -> synchronize
  -> stop timer
```

另外三条脚本分别处理 attention microbenchmark、distributed collective/training benchmark 和 CUDA memory snapshot：

- [`benchmark_attention.py`][benchmark-attention] 比较 PyTorch、compiled PyTorch 与 Triton 路径；
- [`benchmark_distributed.py`][benchmark-distributed] 比较 all-reduce、三种 DDP、sharded optimizer 与 FSDP；
- [`profile_memory.py`][profile-memory] 使用 PyTorch CUDA memory history 生成可交给 `memory_viz` 的 snapshot。

当前机器没有 NVIDIA GPU，所以这里能证明的是参数解析、CPU forward 和 Gloo 多进程路径可运行，不能证明真实 GPU 吞吐、Nsight kernel 占比或 B200 leaderboard 成绩。

## 3. Activation checkpointing：用重算换显存

训练时的显存并不只由参数决定。Autograd 需要保存 forward 中的中间 activation，层数和序列长度上去以后，这些 residual 很快成为峰值显存的主体。

[`checkpointing.py`][checkpointing] 做了两件事：

```python
run_checkpointed_blocks(blocks, x, chunk_size)
install_transformer_activation_checkpointing(model, chunk_size)
```

实现按连续 block 分 chunk。Forward 只保存 chunk 边界，backward 时重新执行 chunk 内部 forward：

```text
blocks 0..k-1       -> checkpoint
blocks k..2k-1      -> checkpoint
blocks 2k..3k-1     -> checkpoint
...
```

chunk 小，保存的边界多、单次重算短；chunk 大，边界少、但 backward 重算区域更大。它不是一个固定的“最佳值”，而是显存预算与额外计算之间的 knob。脚本统一暴露 `--checkpoint-chunk-size`，可以在目标 GPU 上画出 peak memory 与 step time 的 Pareto curve。

## 4. FlashAttention：优化的是 IO，不是数学定义

标准 scaled dot-product attention 为：

$$
S = \frac{QK^T}{\sqrt d}, \qquad
P = \operatorname{softmax}(S), \qquad
O = PV.
$$

Naive 实现会在 HBM 中 materialize 完整的 $N \times N$ score 和 probability matrix。FlashAttention 的关键不是减少理论 FLOPs，而是把 query/key/value 分块读入片上存储，通过 online softmax 一边扫描 key blocks、一边更新归一化状态，不把完整矩阵写回 HBM。

### PyTorch autograd 基线

[`FlashAttentionPytorchFunction`][attention-pytorch] 保存 `Q, K, V, O, L`，其中：

$$
L_i = \log \sum_j \exp(S_{ij}).
$$

Backward 重新得到 $P = \exp(S-L)$，然后计算：

$$
\begin{aligned}
dV &= P^T dO, \\
D &= \operatorname{rowsum}(O \odot dO), \\
dS &= P \odot (dO V^T - D), \\
dQ &= dS K / \sqrt d, \\
dK &= dS^T Q / \sqrt d.
\end{aligned}
$$

公开测试有一个很具体的约束：saved tensors 中必须恰好存在一个形状为 `(batch, n_queries)` 的 tensor，作为 log-sum-exp。实现不能为了方便再保存另一个同形状中间量。

### Triton tiled forward/backward

[`FlashAttentionTritonFunction`][attention-triton] 的 forward 按 query block 和 key block 遍历，每行维护：

- running maximum $m$；
- running exponential sum $l$；
- output accumulator `acc`。

读入新 key block 后，先计算新的最大值，再按 $\exp(m_{old}-m_{new})$ 缩放旧 accumulator，最后加入新 block 的概率和值。结束时得到：

$$
O = \frac{acc}{l}, \qquad L = \log l + m.
$$

Backward 分为三步：先算 $D=\operatorname{rowsum}(O\odot dO)$，再按 key block 累积 `dK/dV`，最后按 query block 累积 `dQ`。这种拆法避免在多个 program instance 之间对同一梯度做高成本原子累加。

CPU 上的 PyTorch forward/backward 已通过；Triton causal 与 non-causal forward/backward 共 4 个 case 因无 CUDA 跳过。这是当前实现最重要的剩余验证边界。

## 5. DDP：同样是 all-reduce，调度方式差很多

[`distributed.py`][distributed] 实现了三个版本：

| 版本 | 同步方式 | 主要取舍 |
|---|---|---|
| `NaiveDistributedDataParallel` | backward 后逐参数 all-reduce | 最直观，但 collective 次数多，无法 overlap |
| `FlatDistributedDataParallel` | flatten 全部梯度，一次 all-reduce | collective 少，但要额外 buffer，通信启动较晚 |
| `DistributedDataParallel` | gradient ready 时异步 all-reduce | 可与后续 backward overlap，调度更复杂 |

初始化时所有版本都从 rank 0 broadcast 参数和 buffers。参数遍历使用 `remove_duplicate=False` 加 `id(param)` 去重，因此 tied weights 不会重复注册 hook 或重复同步。

Overlap 版本给每个可训练参数注册 `register_post_accumulate_grad_hook`：

```text
parameter gradient ready
  -> divide by world_size
  -> async all_reduce
  -> continue backward
finish_gradient_synchronization()
  -> wait all handles
```

公开 DDP 测试让两个 Gloo rank 分别看到全局 batch 的一半，再与单进程 full-batch baseline 训练 5 步。普通模型、tied weights 和 `requires_grad=False` 参数都必须保持语义一致。

## 6. Sharded optimizer：先切最贵的状态

AdamW 对每个参数至少维护一阶、二阶 moment。普通 DDP 在每个 rank 上都保留完整参数和完整 optimizer state，随着模型增大，optimizer state 往往比参数本身更早压垮显存。

[`ShardedOptimizer`][optim] 做的是简化 ZeRO-1：

1. 对唯一参数按顺序分配 owner：`owner = index % world_size`；
2. 每个 rank 的真实 optimizer 只接收自己负责的参数；
3. 本地 `step()` 只更新 owner parameters；
4. 更新后由 owner broadcast 参数，使每个 rank 的完整模型重新一致。

模型参数仍然 replicated，节省的是 optimizer state。公开测试用 AdamW 在普通模型和 tied-weight 模型上训练 10 步，最终参数必须与 non-sharded baseline 对齐。

## 7. FSDP：参数只在计算时暂时完整

[`FullyShardedDataParallel`][fsdp] 对 `cs336_basics.model.Linear` 和 `Embedding` 的 weight 按第 0 维 row-shard，RMSNorm 等小参数保持 replicated。

### 初始化

```text
rank 0 full state broadcast
  -> find Linear / Embedding weights
  -> split rows across ranks
  -> replace each full Parameter with local shard
  -> record ShardSpec
```

### Forward

Linear 或 Embedding 真正计算前，先 all-gather full weight；计算完成后，长期存活的 parameter 仍然只有 local shard。

### Backward

Linear backward 再次 gather weight 计算 `grad_input`，用 `grad_output^T @ input` 得到 weight gradient，然后跨 rank 平均并切回本地 rows。Embedding 用 `index_add_` 构造完整 gradient，再走同样的同步和切片。Replicated parameters 则在 `finish_gradient_synchronization()` 中普通 all-reduce。

Mixed precision 路径保留 FP32 master shard，CUDA 上允许用 `compute_dtype` gather 和计算；CPU/Gloo 测试保持 FP32 communication，避免 CPU half operator 覆盖不足。

公开测试覆盖：

- FP32 与 FP16 compute dtype；
- 训练结果与 full-batch baseline 的逐步参数对齐；
- `gather_full_params()` 能恢复完整 state；
- local gradient shape/dtype 与 local shard 一致；
- replicated parameter gradients 跨 rank 一致。

这是一个教学型 FSDP。工业实现还需要 prefetch、bucket、communication overlap、nested wrapping、distributed checkpoint 和 sharded state dict 等能力。

## 8. 测试与当前证据

完整公开测试命令：

```bash
env UV_CACHE_DIR=/tmp/cs336-uv-cache PYTHONDONTWRITEBYTECODE=1 \
  ~/.local/bin/uv run pytest -p no:cacheprovider
```

| 测试区域 | 结果 | 核心标准 |
|---|---:|---|
| PyTorch attention | 2 passed | output、LSE、`dQ/dK/dV`，`rtol=atol=1e-2` |
| Triton attention | 4 skipped | 需要 CUDA；causal/non-causal forward/backward |
| DDP | 2 passed | 两 rank 训练与 full-batch baseline 一致 |
| Sharded optimizer | 2 passed | AdamW 10 步后参数一致，含 tied weights |
| FSDP | 4 passed | FP32/FP16 correctness 与 gradient sync |
| 独立回归 | 6 passed | backend routing 2、checkpointing 3、FSDP state-dict 1 |
| 合计 | **16 passed, 4 skipped** | 清理后的独立仓库完整测试 |

实现文件 lint：

```bash
~/.local/bin/uv run ruff check --no-cache cs336_systems tests/adapters.py
```

结果为 `All checks passed!`。全仓 `ruff check .` 仍会命中课程提供测试文件中的既有 lint 问题，所以没有把“实现 lint 通过”扩大成“所有原始文件 lint 通过”。

CPU/Gloo smoke benchmark 也跑通了 naive/flat/overlap DDP、FSDP 和 checkpointed Transformer，但这些小模型 CPU 数字只用于验证脚本路径，不用于性能结论。

## 9. 作业提交脚本与没有生成的结果

官方提交物是 `writeup.pdf` 与 `code.zip`。[`test_and_make_submission.sh`][submission-script] 会：

1. 运行公开测试并生成 `test_results.xml`；
2. 删除旧 submission zip；
3. 排除 cache、venv、日志、pickle、权重等文件后重新打包。

我没有运行该脚本：一方面我不是课程注册学生，不需要向 Gradescope 提交；另一方面脚本会生成提交 artifacts。真正缺失的不是 zip，而是 NVIDIA GPU 上的实测材料：

- Triton kernel correctness 与速度；
- Nsight Systems kernel summary 和 timeline；
- CUDA memory snapshot / memory_viz 截图；
- 不同模型、上下文长度和 mixed precision 的 timing table；
- 两张 B200 上的 8B leaderboard step time。

这些结果必须来自真实硬件，不能从 CPU smoke 或理论 FLOPs 推断。

## 10. 2025—2026：这份作业之后该看什么

这次复盘还补查了近期论文和官方工程资料。它们恰好展示了课程概念如何继续演进：

1. [FlashAttention-4][flash4] 把 online softmax 推到 Blackwell，围绕 TMEM、异步 Tensor Core 和 softmax/MMA overlap 做算法—kernel 协同设计。
2. [PyTorch Activation Checkpointing Techniques][pytorch-ac] 增加 selective checkpoint、memory budget API 与 compile min-cut partitioner，从手工 chunk 走向自动图划分。
3. [TorchTitan][torchtitan] 把 FSDP2、DTensor、TP/PP/CP、distributed checkpoint 与 FP8 集成成 PyTorch 原生训练栈。
4. [FSDP2 `fully_shard`][fsdp2] 与 [DTensor][dtensor] 用 per-parameter sharding 和 DeviceMesh/SPMD 抽象替代教学实现中的手工 shard metadata。
5. NeurIPS 2025 的 [Topology-Aware Communication Alignment on More Than 9600 GPUs][arnold] 说明，真实大规模训练不能把网络看成理想 fully-connected collective。
6. [The Ultra-Scale Playbook][ultrascale] 用大量实测把 DP、ZeRO/FSDP、TP、PP、SP、communication overlap 串成一份很好的工程导读。

我最喜欢这份作业的一点，是它没有把“系统优化”简化成某个神奇 API。FlashAttention、checkpointing、DDP 和 FSDP 都在做同一件事：**明确哪份数据在什么时候必须存在、应该放在哪里，以及能否让数据移动与计算重叠。**

## 总结

最终实现覆盖了 benchmark/profile、activation checkpointing、PyTorch/Triton FlashAttention、三种 DDP、optimizer state sharding 和教学型 FSDP。公开 CPU/Gloo correctness 测试全部通过；GPU 路径和性能材料被诚实地保留为硬件相关未验证项。

从学习顺序看，这份 Assignment 2 很完整：先学会测量，再优化单个算子，然后处理单卡显存，最后把模型扩展到多卡。等真正拿到 CUDA/Nsight/B200 环境时，剩下的工作不是再写一套架构，而是用现有脚本补齐最重要的 GPU 证据。

[assignment]: https://github.com/keepkeen/cs336-assignment2-systems/tree/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9
[coursework-commit]: https://github.com/keepkeen/cs336-assignment2-systems/commit/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9
[handout]: https://github.com/stanford-cs336/assignment2-systems
[implementation-explanation]: https://github.com/keepkeen/cs336-assignment2-systems/blob/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9/docs/implementation.md
[notice]: https://github.com/keepkeen/cs336-assignment2-systems/blob/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9/NOTICE.md
[adapters]: https://github.com/keepkeen/cs336-assignment2-systems/blob/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9/tests/adapters.py
[attention]: https://github.com/keepkeen/cs336-assignment2-systems/blob/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9/cs336_systems/attention.py
[attention-pytorch]: https://github.com/keepkeen/cs336-assignment2-systems/blob/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9/cs336_systems/attention.py#L557
[attention-triton]: https://github.com/keepkeen/cs336-assignment2-systems/blob/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9/cs336_systems/attention.py#L572
[checkpointing]: https://github.com/keepkeen/cs336-assignment2-systems/blob/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9/cs336_systems/checkpointing.py
[distributed]: https://github.com/keepkeen/cs336-assignment2-systems/blob/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9/cs336_systems/distributed.py
[optim]: https://github.com/keepkeen/cs336-assignment2-systems/blob/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9/cs336_systems/optim.py
[fsdp]: https://github.com/keepkeen/cs336-assignment2-systems/blob/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9/cs336_systems/fsdp.py
[scripts]: https://github.com/keepkeen/cs336-assignment2-systems/tree/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9/cs336_systems/scripts
[benchmark-transformer]: https://github.com/keepkeen/cs336-assignment2-systems/blob/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9/cs336_systems/scripts/benchmark_transformer.py
[benchmark-attention]: https://github.com/keepkeen/cs336-assignment2-systems/blob/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9/cs336_systems/scripts/benchmark_attention.py
[benchmark-distributed]: https://github.com/keepkeen/cs336-assignment2-systems/blob/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9/cs336_systems/scripts/benchmark_distributed.py
[profile-memory]: https://github.com/keepkeen/cs336-assignment2-systems/blob/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9/cs336_systems/scripts/profile_memory.py
[submission-script]: https://github.com/stanford-cs336/assignment2-systems/blob/ca8bc81a59b70516f7ebb2da4808daade877c736/test_and_make_submission.sh
[flash4]: https://tridao.me/blog/2026/flash4/
[pytorch-ac]: https://pytorch.org/blog/activation-checkpointing-techniques/
[torchtitan]: https://arxiv.org/abs/2410.06511
[fsdp2]: https://docs.pytorch.org/docs/stable/distributed.fsdp.fully_shard.html
[dtensor]: https://docs.pytorch.org/docs/stable/distributed.tensor.html
[arnold]: https://papers.nips.cc/paper_files/paper/2025/hash/d82c24b7a4237aa4283b38e12047dc38-Abstract-Conference.html
[ultrascale]: https://huggingface.co/spaces/nanotron/ultrascale-playbook?section=high-level_overview
