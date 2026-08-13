---
title: "CS336 Assignment 2：从 FlashAttention 到 FSDP"
description: "从测量方法、混合精度和 activation checkpointing 开始，逐步推导并拆解 FlashAttention、三种 DDP、optimizer state sharding 与教学型 FSDP 的实现、测试证据和工程边界。"
date: 2026-07-26
updatedDate: 2026-08-14
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

> 本文对应 Stanford CS336 Spring 2026 的 **Assignment 2: Systems and Parallelism**。我不是 Stanford 在校生，也没有把它当作正式课程提交；这是一份独立实现和公开复盘。
>
> 当前公开仓库在 CPU/Gloo 环境得到 **16 passed、4 skipped**。通过项包括 10 个 Stanford 公开测试和 6 个独立回归测试；4 个跳过项都需要 CUDA/Triton。本文会严格区分“代码路径已实现”“CPU 正确性已验证”和“GPU 性能已验证”，不会用 CPU smoke test 代替 B200、NCCL 或 Nsight 结果。

## 快速入口

- [Assignment 2 独立公开代码仓库][assignment]
- [Stanford 官方作业仓库][handout]
- [仓库内实现说明][implementation-explanation]
- [许可证、来源归属与学术诚信说明][notice]
- [公开测试适配层][adapters]

公开仓库是从 Assignment 2 代码做安全审计后重新初始化的无历史快照。下文的代码链接固定在 root commit [`3ff1df4`][coursework-commit]，因此即使仓库以后继续修改，本文讨论的实现仍然可以复现。

## 1. 先看全局：这份作业在训练系统里解决什么

Assignment 2 并不是几个互不相关的小题。它沿着一次 Transformer 训练 step 的资源流动逐层推进：

```text
tokens
  -> forward: 参数 + activation + kernel
  -> loss
  -> backward: saved tensors + 梯度
  -> distributed collectives: 同步梯度或临时收集参数
  -> optimizer: 参数更新 + optimizer state
  -> next step
```

作业依次追问：

1. **怎么测**：异步 CUDA 下怎样得到可信延迟，显存峰值由什么组成？
2. **怎么少存 activation**：mixed precision、fusion、activation checkpointing 分别改变了什么？
3. **怎么少搬 attention 中间矩阵**：online softmax 如何避免把 $N\times N$ attention matrix 写回 HBM？
4. **怎么让多卡得到同一个优化结果**：DDP 为什么要平均梯度，通信什么时候可以与 backward 重叠？
5. **怎么减少每个 rank 的持久状态**：optimizer state、gradient、parameter 应该按什么阶段逐步分片？
6. **怎么分析扩展上限**：计算量随设备数下降以后，collective 通信何时成为瓶颈？

这条学习路径的主线其实只有一句话：**决定每个张量在什么时间必须存在、放在哪一级存储或哪一个 rank，以及移动它时能否同时做计算。**

### 1.1 本实现的模块边界

作业提供 Assignment 1 Transformer、公开测试和 adapter hooks。我把 [`tests/adapters.py`][adapters] 保持为薄适配层，核心实现都放在 `cs336_systems/`：

| 文件 | 负责的状态或通信 |
|---|---|
| [`attention.py`][attention] | PyTorch attention autograd、Triton tiled forward 和可选 Triton backward |
| [`checkpointing.py`][checkpointing] | 连续 Transformer blocks 的 activation checkpointing |
| [`distributed.py`][distributed] | 参数初始化广播，naive、flat、overlap 三种 DDP |
| [`optim.py`][optim] | optimizer state 的 owner 划分与参数广播 |
| [`fsdp.py`][fsdp] | Linear/Embedding row shard、按需 all-gather、梯度同步和完整 state dict |
| [`scripts/`][scripts] | Transformer、attention、collective、DDP/FSDP benchmark 和 CUDA memory snapshot |

Adapter 只回答“测试应调用哪个类或方法”，不复制算法。这样测试、benchmark 和真实调用走的是同一条代码路径，避免出现“测试专用实现通过，脚本实际跑的是另一套代码”的情况。

### 1.2 完成度应该怎样理解

“实现完成”至少有三个层次：

| 层次 | 当前状态 | 能说明什么 |
|---|---|---|
| 接口与算法路径 | 已实现 | 模块、脚本和 adapter 可连接 |
| CPU/Gloo correctness | 已验证 | 数值与单进程基线一致，分布式状态能同步 |
| CUDA/NCCL 性能与 profiler 证据 | 尚未验证 | 不能声称 kernel 更快、通信成功重叠或显存达到预期 |

后文每节都会按这三个层次展开，而不是只罗列文件名。

## 2. Benchmark、混合精度与显存：先建立可信测量

### 2.1 为什么普通计时会低估 CUDA 时间

GPU kernel launch 对 CPU 是异步的。Python 调用返回时，kernel 可能只是进入 CUDA stream，还没有执行完。如果直接用：

```python
start = time.perf_counter()
output = model(x)
elapsed = time.perf_counter() - start
```

测到的主要是 CPU 提交工作的时间。可信的 wall-clock 边界需要：

```text
warmup 若干步
  -> torch.cuda.synchronize()

每次正式测量
  -> start timer
  -> forward / backward / optimizer step
  -> torch.cuda.synchronize()
  -> stop timer
```

Warmup 也不是装饰。首轮执行可能包含 CUDA context 初始化、allocator 扩容、Triton JIT、`torch.compile` 图捕获和 NCCL communicator 初始化。把这些一次性成本混入 steady-state latency，结论会随着测量次数而变化。

[`benchmark_transformer.py`][benchmark-transformer] 提供五档模型：`small / medium / large / xl / 10B`，并区分三种 mode：

| mode | 实际包含的工作 | 用途 |
|---|---|---|
| `forward` | forward | 推理或纯 forward 成本 |
| `backward` | forward + loss + backward | 训练求梯度成本，不含 optimizer step |
| `train` | forward + loss + backward + AdamW step | 完整训练 step |

这里要特别注意：脚本里的 `backward` 数字是 **forward 与 backward 的总和**，不是单独 backward。如果要得到 backward-only 的近似值，必须在同配置下用 `backward_total - forward`，并认识到两次独立测量仍会有噪声。

脚本输出 mean、standard deviation、min 和 max。只报最小值容易隐藏抖动，只报均值又可能看不见 outlier；四个统计量放在一起，才能判断 warmup 是否充分、系统是否稳定。

### 2.2 Mixed precision 改变的是计算 dtype，不是简单地把模型全转半精度

`torch.autocast` 的目标是把适合 Tensor Core 的 matmul 等操作降到 BF16/FP16，同时让数值敏感的 reduction、normalization 和 loss 保留更高精度。以“FP32 参数 + BF16 autocast”为例：

| 对象 | 典型 dtype | 原因 |
|---|---|---|
| leaf model parameters | FP32 | optimizer 反复累加更新，需要 master precision |
| Linear/matmul 输出 | BF16 | 使用低精度 Tensor Core 路径 |
| normalization/reduction 中间量 | 通常提升精度 | 均值、平方和、rsqrt 对舍入和动态范围敏感 |
| logits | 常为 BF16 | 最后一层 matmul 仍在 autocast 内 |
| cross entropy | FP32 | 脚本显式把 logits 转为 `float()` |
| parameter gradients | FP32 | 梯度累加到 FP32 leaf parameters |

一个简单的直觉实验是把 `0.01` 累加 1000 次。FP16 accumulator 每次都重新量化当前和，误差会连续积累；FP32 accumulator 即使接收的是低精度输入，也避免了每一步再次把总和压回 FP16。BF16 的 exponent range 接近 FP32，较少出现 FP16 的 overflow/underflow，但 mantissa 更短，reduction 仍然可能需要 FP32 accumulation。

脚本用 `--bf16` 打开 CUDA BF16 autocast。它没有声称 BF16 必然更快：小矩阵可能被 launch 和 cast 开销主导，只有在支持 BF16 Tensor Core 且工作量足够大时，吞吐优势才更可能显现。

### 2.3 显存不能只看参数量

训练时常见的持久或临时内存包括：

```text
parameters
+ gradients
+ optimizer states
+ activations saved for backward
+ temporary workspaces / communication buffers
+ CUDA allocator reserved but currently inactive memory
```

以作业的 `xl` 配置为例，batch size $B=4$、sequence length $T=2048$、hidden size $D=2560$。一份 FP32 residual-stream tensor 的大小是：

$$
B\times T\times D\times 4
=4\times 2048\times 2560\times 4
=83{,}886{,}080\ \text{bytes}
=80\ \text{MiB}.
$$

这只是一个 residual tensor。一个 Transformer block 内的 attention、normalization 和 FFN 会为 backward 保存多份中间量，所以 activation 总量会远大于 $80$ MiB，并且大致随 batch、sequence length 和 layer count 增长。

[`profile_memory.py`][profile-memory] 用 PyTorch CUDA memory history 记录一次 forward 或完整训练 step，最后写出可以加载到 `memory_viz` 的 snapshot。正确解读 timeline 时，应区分：

- forward 阶段逐层保存 activation，active memory 通常持续增长；
- backward 逐层消费 saved tensors，同时创建 gradient，曲线不一定单调下降；
- 第一次 AdamW step 会懒初始化一阶、二阶 moment，因此 step 后可能出现新的持久平台；
- allocator 的 reserved memory 不等于仍被 tensor 使用的 active memory。

当前机器没有 CUDA，所以 snapshot 脚本已实现但没有在本文伪造截图和峰值表。

## 3. Activation checkpointing：用一次重算减少长期 activation

### 3.1 Autograd 默认保存了什么

Backward 需要 forward 的输入或中间结果。普通执行 $L$ 个 block 时，每层保存自己的 residual，长期存活 activation 近似随 $L$ 线性增长。Checkpoint 的做法是把一段函数视为一个重算单元：

```text
第一次 forward:
  保存 checkpoint 输入
  不长期保存 chunk 内部 activation

backward 到达该 chunk:
  从保存的输入重跑 forward
  临时生成 chunk 内 activation
  立刻执行该 chunk backward 并释放
```

因此它节省的是 **activation storage**，不是参数、梯度或 optimizer state，也没有减少数学 FLOPs。一次非嵌套 checkpoint 通常让被覆盖 block 的 forward 多执行一次。

### 3.2 为什么 chunk size 不是越大越好

设共有 $L$ 层，每个 checkpoint chunk 包含 $k$ 层，单个边界 activation 大小近似为 $A$，单层内部 residual 峰值近似为 $R$。一个粗略的峰值模型是：

$$
M_{activation}(k)\approx \frac{L}{k}A+kR.
$$

第一项是长期保存的 chunk boundaries；第二项是 backward 重算一个 chunk 时同时物化的内部 residual。$k$ 很小时，边界数量多；$k$ 很大时，一次重算区域大。最佳 $k$ 要在真实模型和 GPU 上测，不能仅从层数猜。

如果允许递归嵌套 checkpoint，还可以继续用额外重算换更低峰值；本实现采用的是容易验证的一层连续分块策略。

### 3.3 代码怎样接入 Transformer

[`run_checkpointed_blocks`][checkpointing] 按连续层切分：

```python
for start in range(0, len(blocks), chunk_size):
    chunk = blocks[start : start + chunk_size]
    x = checkpoint(run_chunk, x, use_reentrant=False)
```

`install_transformer_activation_checkpointing` 替换 `BasicsTransformerLM.forward`，仍保持原来的顺序：

```text
token_embeddings
  -> checkpointed Transformer layers
  -> final RMSNorm
  -> lm_head
```

采用 `use_reentrant=False` 是 PyTorch 当前更通用的 checkpoint 语义，也能更自然地与 autograd graph 和 kwargs 等机制配合。`chunk_size <= 0` 则完全绕过 checkpoint，方便用同一个脚本做 A/B 对照。

### 3.4 如何证明没有改坏训练语义

独立的 [`test_checkpointing.py`][checkpointing-test] 对 `chunk_size = 1, 2, 4` 分别执行：

1. 从同一个 Transformer 深拷贝 baseline 和 checkpointed model；
2. 比较 forward output；
3. 对同一个标量 loss backward；
4. 逐参数比较所有 gradients。

只比较输出还不够，因为错误的 checkpoint closure、随机状态或参数连接可能在 backward 才暴露。这个测试验证的是确定性 toy model 上的数学等价，不代表已经测得显存收益；后者仍要由 CUDA memory snapshot 给证据。

## 4. FlashAttention：减少的是 HBM IO，不是 attention 数学

### 4.1 从张量形状看 naive attention 的问题

设：

$$
Q\in\mathbb{R}^{B\times N_q\times d},\qquad
K,V\in\mathbb{R}^{B\times N_k\times d}.
$$

标准 scaled dot-product attention 是：

$$
S=\frac{QK^T}{\sqrt d},\qquad
P=\operatorname{softmax}(S),\qquad
O=PV.
$$

$S$ 和 $P$ 的形状都是 $B\times N_q\times N_k$。Self-attention 中 $N_q=N_k=N$，于是中间矩阵按 $O(N^2)$ 增长。即使总 FLOPs 无法绕开，naive 分解还会把 $S$ 写入 HBM、读出做 softmax、再写 $P$、读出乘 $V$；backward 又要多次读取这些大矩阵。

FlashAttention 的目标不是近似 softmax，也不是减少到次二次复杂度，而是：

1. 把 $Q/K/V$ 分 tile 载入片上 SRAM/register；
2. 在一个 kernel 内融合 score、softmax 和 value accumulation；
3. 只把最终 $O$ 与每行少量统计量写回 HBM；
4. backward 用 $Q/K/V/O/L$ 重算局部的 $S$ 和 $P$。

它用更多局部重算换更少的全局内存读写。

### 4.2 Online softmax 为什么可以分块

普通稳定 softmax 对一行 scores $s$ 使用：

$$
m=\max_j s_j,\qquad
l=\sum_j e^{s_j-m},\qquad
\operatorname{softmax}(s_j)=\frac{e^{s_j-m}}{l}.
$$

问题是，一开始并不知道整行最大值。假设已处理前若干 key tiles，保存旧状态 $(m_{old},l_{old},acc_{old})$；新 tile scores 为 $S_{new}$。先更新最大值：

$$
m_{new}=\max\left(m_{old},\operatorname{rowmax}(S_{new})\right).
$$

旧的指数和基于 $m_{old}$，必须换到新的数值基准：

$$
\alpha=e^{m_{old}-m_{new}}.
$$

然后更新分母和未归一化输出：

$$
l_{new}=\alpha l_{old}
+\operatorname{rowsum}\left(e^{S_{new}-m_{new}}\right),
$$

$$
acc_{new}=\alpha acc_{old}
+e^{S_{new}-m_{new}}V_{new}.
$$

所有 key tiles 扫描结束后：

$$
O=\frac{acc}{l},\qquad L=m+\log l.
$$

$L$ 就是每个 query row 的 `logsumexp`。这套递推的关键是 $alpha$：如果最大值变大而旧 accumulator 不重标定，前面 tiles 与新 tile 就不在同一个指数尺度上，结果会错误。

### 4.3 PyTorch autograd baseline 保存什么

[`FlashAttentionPytorchFunction`][attention-pytorch] 的 forward 用 PyTorch 张量运算计算标准 attention，并保存：

```text
Q, K, V, O, L
```

没有保存完整 $P$。Backward 可以用：

$$
P_{ij}=\exp(S_{ij}-L_i)
$$

重构 probability。虽然这个 PyTorch baseline 仍会在 backward 临时 materialize 大矩阵，它为 Triton 路径提供了清晰、可逐项对比的数学参考。

公开测试还有一个容易漏掉的接口约束：saved tensors 中必须恰好有一个形状为 `(batch, n_queries)` 的 tensor，它就是 $L$。所以不能顺手再保存同形状的 row max 或 row sum。

### 4.4 Backward 公式如何从 softmax Jacobian 化简

给定上游梯度 $dO$：

$$
dV=P^TdO,
$$

$$
dP=dOV^T.
$$

Softmax 每行 Jacobian 可以写成：

$$
dS_i=P_i\odot\left(dP_i-\sum_j P_{ij}dP_{ij}\right).
$$

直接计算行内点积仍需要 $P$ 与 $dP$。利用 $O=PV$，有：

$$
D_i=\sum_k O_{ik}dO_{ik}
=\sum_j P_{ij}dP_{ij}.
$$

于是：

$$
dS=P\odot(dP-D[:,None]),
$$

$$
dQ=\frac{dSK}{\sqrt d},\qquad
dK=\frac{dS^TQ}{\sqrt d}.
$$

这就是代码先算 `delta = rowsum(O * grad_out)` 的原因。$D$ 只有 $B\times N_q$，远小于 $N_q\times N_k$。

### 4.5 Triton forward 怎样映射到 program grid

[`_flash_attention_fwd_kernel`][attention] 使用二维 launch grid：

```text
program_id(0) -> 一个 query tile
program_id(1) -> 一个 batch/head-like flattened index
```

Python wrapper 把所有 leading dimensions 展平到 batch 轴，所以最后两维仍表示 sequence 和 hidden dimension。当前 tile 设置为：

```text
BLOCK_M = 16 query rows
BLOCK_N = 64 key rows
BLOCK_D = next_power_of_2(d_model)
```

一个 program 只加载自己的 $Q_i$，然后循环扫描所有 $K_j,V_j$。`row_max`、`row_sum` 和 `acc` 都用 FP32，执行 `tl.dot` 前再把局部 probability cast 到 $V$ 的 dtype。这兼顾 Tensor Core 输入与稳定 accumulation。

Causal mask 通过绝对 query/key index 比较得到：只有 `query_index >= key_index` 的位置有效。越界 rows/columns 也在 load 和 score 阶段分别 mask，确保 tile size 不整除 sequence length 时不会污染 reduction。

### 4.6 为什么 Triton backward 拆成三个 kernel

作业必做路径允许 backward 使用 PyTorch/`torch.compile`；当前实现额外完成了可选的 tiled Triton backward：

1. `delta kernel`：每个 query row 计算 $D=\operatorname{rowsum}(O\odot dO)$；
2. `dK/dV kernel`：一个 program 独占一个 key tile，遍历所有 query tiles；
3. `dQ kernel`：一个 program 独占一个 query tile，遍历所有 key tiles。

这种 ownership 让每个输出 gradient tile 只由一个 program 写入：

```text
key-tile program   -> owns dK[key tile], dV[key tile]
query-tile program -> owns dQ[query tile]
```

如果一个 program 同时围绕 query tile 计算全部梯度，多个 programs 会共同写相同的 `dK/dV`，需要昂贵的 atomics 或跨 program 同步。这里宁可重算一次局部 $P$，也避免写冲突。

### 4.7 Fallback 与 backend routing 也需要测试

CUDA 不可用时，Triton wrapper 会退回 PyTorch helper，使 CPU 环境仍能验证接口和数学。但 fallback 也容易掩盖接线错误：如果 `FlashAttentionTritonFunction.backward` 意外调用了 torch helper，CPU 测试仍可能全过。

因此独立的 [`test_attention_backend_routing.py`][attention-routing-test] monkeypatch 两个 backend helper，明确验证：

```text
PyTorch Function backward -> torch helper
Triton Function backward  -> triton helper
```

这类测试不证明 kernel 数值正确，却能防止“类名是 Triton，实际 backward 走了 PyTorch”的静默退化。

### 4.8 当前 FlashAttention 证据边界

CPU 上已经验证 PyTorch forward、$L$ 和 `dQ/dK/dV`。CUDA 测试包含 causal/non-causal forward/backward 共 4 个 case，但当前机器没有 NVIDIA GPU，所以被 skip。

因此目前可以说“kernel 已实现并已静态接线”，不能说“比 PyTorch 更快”或“所有 GPU shape 都正确”。真实结论还需要：

- CUDA numerical tests；
- BF16/FP32、不同 $N$ 和 $d$ 的 benchmark；
- Triton compile/resource usage 检查；
- Nsight 中 HBM traffic、occupancy 和 kernel timeline。

## 5. DDP：数学上是全局 batch，工程上是 collective 调度

### 5.1 为什么要平均而不是只求和

设 global batch 被 $N$ 个 ranks 等分，rank $r$ 的 local loss 是其样本 loss 的平均值，得到 local gradient $g_r$。单进程对 global batch 求平均的梯度是：

$$
g=\frac{1}{N}\sum_{r=0}^{N-1}g_r.
$$

`dist.all_reduce(..., SUM)` 默认只求和，所以代码要再除以 `world_size`。当前实现先原地 `div_`，再 SUM all-reduce，结果与“先求和再除”相同。

这个等价依赖各 rank local batch size 相同且 local loss reduction 一致。如果最后一个 batch 各 rank 样本数不同，简单除以 world size 就不是精确的 sample-weighted global mean。

### 5.2 所有 rank 为什么必须从同一状态开始

每个进程独立构造模型时，随机初始化可能不同。DDP 初始化先从 rank 0 broadcast：

- 所有唯一 parameters；
- 所有 buffers，例如 running statistics 或注册状态。

只广播参数、不广播 buffers，会让 forward 语义仍可能分叉。

另一个细节是 tied weights。同一个 `Parameter` 可能以多个名字出现在 module tree 中。[`unique_named_parameters`][distributed] 使用 `named_parameters(remove_duplicate=False)` 遍历全部名字，再按 `id(param)` 去重。这样既能看见 alias，又不会重复注册 hook、all-reduce 或 optimizer update。

### 5.3 三种 DDP 的差别不在数学结果，而在何时发通信

[`distributed.py`][distributed] 实现了三个结果等价、调度不同的版本：

| 版本 | collective 数量 | 发起时间 | 额外 buffer | 主要瓶颈 |
|---|---:|---|---|---|
| `NaiveDistributedDataParallel` | 约等于参数 tensor 数 | backward 全结束后 | 很少 | 大量小 collective 的 latency |
| `FlatDistributedDataParallel` | 1 | backward 全结束后 | 一份 flat gradient | 启动少，但完全没有 overlap |
| `DistributedDataParallel` | 约等于可训练参数数 | 每个 gradient ready 时 | work handles | 可 overlap，但小 collective 多且顺序敏感 |

#### Naive：最容易验证的基线

```text
loss.backward()
  -> for each parameter grad:
       divide by world_size
       synchronous all_reduce
  -> optimizer.step()
```

它把 backward 和通信完全串行化，适合确认数学语义，但每个小 tensor 都有 collective launch latency。

#### Flat：一次大通信换额外复制

Flat 版本把所有 dense gradients flatten 成连续 tensor，一次 all-reduce 后再 unflatten/copy 回原 gradient。

优点是 collective 次数最少，带宽更容易饱和；缺点是必须等最后一个 gradient ready，无法与 backward 重叠，而且 flat buffer 会提高峰值显存。工业 DDP 常用多个 buckets，而不是“每参数一个”或“全模型一个”这两个极端。

#### Overlap：gradient ready 就发 async all-reduce

Overlap 版本为每个 trainable parameter 注册 `register_post_accumulate_grad_hook`：

```text
backward computes parameter.grad
  -> post-accumulate hook
  -> grad /= world_size
  -> async all_reduce(grad)
  -> backward continues

finish_gradient_synchronization()
  -> wait every Work handle
  -> clear handles

optimizer.step()
```

必须在 `optimizer.step()` 前 wait。`async_op=True` 只表示 Python 立即拿到 handle，并不保证通信已经完成；如果 optimizer 读取仍在写入的 gradient，会发生数据竞争。

理论上的 overlap 也不等于实测一定更快。小模型上通信太短、hook/launch overhead 太大，overlap 版本可能反而更慢；真实收益要看 gradient ready 顺序、bucket size、NCCL stream 和 compute/communication 比例。

### 5.4 Ring all-reduce 的成本说明了什么

设总 gradient 大小为 $S$ bytes、设备数为 $N$、每设备有效 egress bandwidth 为 $W$。理想 ring all-reduce 可以看成 reduce-scatter 加 all-gather：

$$
T_{allreduce}\approx 2\frac{N-1}{N}\frac{S}{W}.
$$

随着 $N$ 增大，单卡 compute 因 local batch 变小而下降，但每卡需要同步的完整模型 gradient 大小 $S$ 不变。这就是纯 data parallel 最终变成 communication-bound 的根本原因。

### 5.5 DDP 测试到底验证了什么

[`test_ddp.py`][ddp-test] 用两个 Gloo ranks 各看 global batch 的一半，并与单进程 full-batch baseline 连续训练 5 步。它还覆盖：

- rank 0 参数和 buffers 初始化广播；
- tied weights；
- `requires_grad=False` parameter；
- 多步后参数一致，而不是只比较某一次 gradient。

多步比较比单步更有价值：错误的平均系数、重复更新或漏同步可能第一步差异很小，但会持续累积。

## 6. Sharded optimizer：先切 AdamW 最昂贵的持久状态

### 6.1 普通 DDP 为什么仍然容易 OOM

设模型有 $P$ 个参数元素，并用 FP32 参数、FP32 gradient 和 AdamW 的两个 FP32 moments。忽略 activation、allocator 和临时 buffer，每个 rank 的持久内存近似是：

| 状态 | 普通 DDP 每 rank | Sharded optimizer 每 rank（理想均分） |
|---|---:|---:|
| parameters | $4P$ bytes | $4P$ bytes |
| gradients | $4P$ bytes | $4P$ bytes |
| Adam first/second moments | $8P$ bytes | $8P/N$ bytes |
| 合计 | $16P$ bytes | $8P+8P/N$ bytes |

这解释了为什么只切 optimizer state 就很有价值：Adam moments 本身通常是参数存储的两倍。但参数和梯度仍 replicated，所以它不是完全分片。

### 6.2 Owner 模型怎样工作

[`ShardedOptimizer`][optim] 先按对象身份收集唯一参数，再用稳定顺序分配：

$$
owner(p_i)=i\bmod N.
$$

每个 rank 只用自己 owner 的参数构造内部真实 optimizer。一次 step 是：

```text
所有 ranks 已有相同的 averaged gradients
  -> rank r 的 local AdamW 只更新 owner=r 的参数
  -> 每个参数由其 owner broadcast 新值
  -> 所有 ranks 再次拥有一致的完整模型
```

`zero_grad()` 仍遍历所有参数，因为每个 rank 的完整模型都参与 forward/backward，非 owner 参数同样会产生 local gradients。`add_param_group()` 会重新建立本地 optimizer groups，使逐步解冻等动态参数组仍有明确 owner。

参数组不能简单 flatten 后丢失 metadata。不同 group 可能有不同 learning rate、weight decay 或 betas；实现复制每组除 `params` 外的配置，只把属于当前 rank 的参数留下。

### 6.3 它与完整 ZeRO-1 的关系

这是 ZeRO Stage 1 思路的教学简化：optimizer states partitioned，parameters 和 gradients replicated。主要差异在工程实现：

- 当前代码按 parameter 轮流 owner，负载只保证参数数量近似均匀，不保证 numel 或 update cost 均匀；
- step 后逐参数 broadcast，缺少 bucket、flat partition 和通信调度优化；
- state dict 是当前 rank 的本地 optimizer state，不是可直接跨 world size 恢复的完整 distributed checkpoint；
- 没有把参数同步与后续计算重叠。

因此它能验证状态分片语义和内存方向，不能代表成熟 ZeRO runtime 的性能。

### 6.4 测试如何覆盖 alias 和多步更新

[`test_sharded_optimizer.py`][sharded-optimizer-test] 用 AdamW 比较普通 optimizer 与 sharded optimizer，普通模型和 tied-weight 模型都连续训练 10 步。最终每个参数必须对齐。

这个测试同时约束 owner 分配、moment 更新、参数广播和 alias 去重。只检查“每个 rank 的 state 数量减少了”无法证明模型更新仍正确。

## 7. FSDP：持久参数是 shard，计算时临时恢复完整权重

### 7.1 从 DP 到 FSDP，切掉哪些副本

理想的 fully sharded data parallel 会把参数、梯度和 optimizer states 都沿 data-parallel group 分片。忽略 activation 和临时 all-gather buffer，FP32 AdamW 的持久状态从普通 DDP 的约 $16P$ bytes/rank 降到：

$$
\frac{4P+4P+8P}{N}=\frac{16P}{N}\ \text{bytes/rank}.
$$

代价是某层计算前必须 all-gather full weight；backward 通常再次 all-gather weight，并把各 rank 的 partial full gradient reduce-scatter 成本地 gradient shard。

本实现把这个核心生命周期做出来，但为了教学和 CPU/Gloo correctness，通信原语与工业实现仍有差异，后面会单独列出。

### 7.2 初始化：row shard 与不整除情况

[`FullyShardedDataParallel`][fsdp] 只 shard `cs336_basics.model.Linear` 和 `Embedding` 的 `weight`，RMSNorm 等小参数保持 replicated。流程是：

```text
rank 0 full state broadcast
  -> 找到 Linear / Embedding
  -> 读取 FP32 full weight
  -> 沿 dimension 0 划分 rows
  -> 用 local rows 替换原 Parameter
  -> 记录 ShardSpec
  -> 为该模块绑定 FSDP forward
```

若总 rows $R$ 不能被 $N$ 整除，前 $R\bmod N$ 个 ranks 多拿一行：

$$
size_r=\left\lfloor\frac{R}{N}\right\rfloor
+\mathbf{1}\left[r<R\bmod N\right].
$$

`ShardSpec` 保存每个 rank 的 `size` 和 `start`。由于 `dist.all_gather` 要求各输入 shape 相同，通信前把较短 shard pad 到最大 rows，收集后再按真实 sizes 去 padding 并 concatenate。

### 7.3 Linear forward：参数只在算子期间完整

对于 weight $W\in\mathbb{R}^{D_{out}\times D_{in}}$，每个 rank 持有 row shard $W_r$。Forward：

```text
all_gather(W_0, ..., W_{N-1})
  -> concatenate to full W
  -> Y = X W^T
  -> full W 临时对象离开作用域
```

Autograd context 只保存 input $X$ 与本地 `weight_shard`，不把刚 gather 的 full weight 长期保存到 backward。这一点很重要，否则“持久参数分片”会被 saved full weights 抵消。

### 7.4 Linear backward：为什么还要再次 gather

给定 $dY$：

$$
dX=dYW,
$$

$$
dW=dY^TX.
$$

计算 $dX$ 需要完整 $W$，所以 backward 再次 all-gather weight。每个 rank 只看自己的 batch shard，因此本地算出的 $dW_r^{partial}$ 是 global-batch gradient 的一部分。

工业 FSDP 通常直接 reduce-scatter partial full gradients，让 rank $r$ 只收到自己负责的 gradient rows。当前教学实现为了清晰和 Gloo 兼容，采用：

```text
每个 rank 计算 full dW partial
  -> 转 FP32
  -> divide by world_size
  -> all_reduce full dW
  -> slice [local_start:local_stop]
  -> 返回 local grad_shard
```

数值结果与“全局平均后取本地 shard”一致，但通信和峰值内存更高：all-reduce 传输完整 gradient，并且在切片前每个 rank 都短暂持有 full gradient。这是当前实现与真正 reduce-scatter FSDP 最重要的差距。

### 7.5 Embedding backward 为什么使用 `index_add_`

Embedding lookup 没有普通 dense matmul 的 weight-gradient 公式。每个 token id 对应 weight 的一行，重复 token 的梯度必须累加：

```python
grad_full.index_add_(
    0,
    token_ids.reshape(-1),
    grad_output.reshape(-1, hidden_size),
)
```

之后再对 `grad_full` 做跨 rank 平均并切出本地 rows。`index_add_` 正确处理同一 batch 中重复出现的 token；直接 assignment 会覆盖而不是累加。

### 7.6 Replicated parameters、mixed precision 与 state dict

没有 shard 的小参数仍在每个 rank 上各有完整副本，所以它们的 gradients 必须在 [`finish_gradient_synchronization()`][fsdp] 中普通 all-reduce。方法用 flag 保证同一 step 重复调用不会二次平均。

Mixed precision 路径遵守两种 dtype 角色：

- local master shard 始终保存 FP32，供 AdamW 更新；
- CUDA 上如果传入 `compute_dtype`，通信和 matmul 使用低精度 full weight；
- CPU/Gloo 保持 FP32 communication，避免 CPU half 算子支持差异影响 correctness test；
- weight gradient accumulation 先转 FP32，再同步并返回 local FP32 shard gradient。

`gather_full_params()` 用于测试、调试和导出完整参数。自定义 `state_dict()` 还包含 registered buffers；`load_state_dict()` 根据 `ShardSpec` 从 full tensor 切回本地 shard。独立回归测试覆盖了 full state 和 buffers 的 round trip，避免出现“参数能恢复，但 buffer 静默丢失”的 checkpoint bug。

### 7.7 当前实现与生产 FSDP 的差距

为了避免名称掩盖事实，下面把差距明确列出：

| 能力 | 当前教学实现 | 生产级 FSDP/FSDP2 常见做法 |
|---|---|---|
| 参数持久存储 | Linear/Embedding row shard | 按 policy 包装和分片更多模块/参数 |
| forward weight | 同步 all-gather 后立即计算 | prefetch、bucket、独立 stream overlap |
| backward weight | 同步 all-gather | backward prefetch 与计算重叠 |
| gradient | full all-reduce 后 slice | reduce-scatter 直接产出 local shard |
| 临时内存 | 每层可能出现 full weight/full gradient | 限流、buffer reuse、精细 reshard |
| checkpoint | gather full state dict | sharded/distributed state dict |
| module 接入 | 给特定 Linear/Embedding 动态绑定 forward | 通用 composable API、DTensor/DeviceMesh |

因此 CPU 测试通过说明训练语义正确，不说明达到了作业描述中的 all-gather prefetch、reduce-scatter 通信量或峰值显存目标。

### 7.8 FSDP 测试覆盖什么

[`test_fsdp.py`][fsdp-test] 使用包含 Embedding、Linear 和 RMSNorm 的 toy model，覆盖：

- `compute_dtype=None` 与 `torch.float16`；
- 两 rank 分片 batch 后与 full-batch baseline 多步参数对齐；
- `gather_full_params()` 恢复完整参数；
- local sharded gradient 的 shape/dtype 与 local parameter 一致；
- replicated parameter gradients 在 ranks 间一致。

这些测试重点是 correctness contract。没有 CUDA/NCCL timeline 时，不能从中推断 all-gather 是否及时完成或峰值显存节省多少。

## 8. 把 DP、FSDP、TP 放进同一个通信模型

作业最后一部分要求用简化模型推导并行策略的扩展边界。这里给出推导方法和最重要的结论，而不是只放最终公式。

### 8.1 三个 ring collective 的理想成本

设 tensor 总大小为 $S$ bytes，设备数 $N$，每设备有效带宽 $W$：

$$
T_{allgather}=\frac{N-1}{N}\frac{S}{W},
$$

$$
T_{reducescatter}=\frac{N-1}{N}\frac{S}{W},
$$

$$
T_{allreduce}=2\frac{N-1}{N}\frac{S}{W}.
$$

这些是忽略 latency、拓扑竞争和协议开销的带宽模型。真实多机网络不一定是理想 fully connected ring，有效 $W$ 也会随消息大小和 topology 改变。

### 8.2 一个 SwiGLU FFN 的计算量

令输入 $X\in\mathbb{R}^{B\times D}$，$W_1,W_2\in\mathbb{R}^{D\times D_{FF}}$，$W_3\in\mathbb{R}^{D_{FF}\times D}$。忽略 elementwise ops：

```text
forward:
  XW1, XW2, ZW3                    -> 3 matmuls

backward:
  dY W3^T
  dX1 W1^T, dX2 W2^T
  Z^T dY, X^T dX1, X^T dX2        -> 6 matmuls
```

一次 $(A\times B)(B\times C)$ matmul 计 $2ABC$ FLOPs，所以：

$$
F_{fwd}=6BDD_{FF},\qquad
F_{bwd}=12BDD_{FF}.
$$

这里把两个 input-gradient matmul 和三个 weight-gradient matmul都明确计入，避免只数公式行数而漏掉一次矩阵乘法。

### 8.3 Data parallel

$N_{DP}$ 个 ranks 各处理 $B/N_{DP}$ 样本，因此 local backward compute 为：

$$
\frac{12BDD_{FF}}{N_{DP}}\ \text{FLOPs}.
$$

三份 FP16 weight gradients 共：

$$
S_{grad}=2\times 3DD_{FF}=6DD_{FF}\ \text{bytes}.
$$

每 step 对它们做 all-reduce。若 accelerator rate 为 $C$ FLOP/s，则比较：

$$
T_{compute}=\frac{12BDD_{FF}}{N_{DP}C},
$$

$$
T_{comm}=2\frac{N_{DP}-1}{N_{DP}}\frac{6DD_{FF}}{W}.
$$

在理想完全 overlap 模型下，保持 compute-bound 需要：

$$
N_{DP}-1\le \frac{BW}{C}.
$$

模型维度在这个简化比值中约掉了，因为 compute 与 gradient bytes 都正比于 $DD_{FF}$；batch 越大，每次同步对应的计算越多，DP 越容易扩展。

### 8.4 Fully sharded data parallel

FSDP local compute 与 DP 相同，但通信改为：

```text
forward:  all-gather weights
backward: all-gather weights + reduce-scatter gradients
```

三份 FP16 weights 的总大小也是 $6DD_{FF}$ bytes。理想 FSDP 每 step 的总带宽项是三个单向 ring phases：

$$
T_{FSDP,total}\approx 3\frac{N-1}{N}\frac{6DD_{FF}}{W}.
$$

它的通信总量不一定比 DDP 少。FSDP 的主要收益是持久显存分片，并通过 prefetch/overlap 尽量把额外 weight all-gather 藏到计算后面。

当前代码的 gradient 路径是 all-reduce 后 slice，不是 reduce-scatter，所以其教学实现通信量更接近：

```text
forward all-gather
+ backward all-gather
+ backward full-gradient all-reduce
```

不能拿理想 FSDP 公式直接声称当前实现已经达到对应带宽。

### 8.5 Tensor parallel 与 2D parallelism

对于常见 FFN TP：$W_1,W_2$ 沿输出维切，$W_3$ 沿输入维切。每 rank 只做 $1/N_{TP}$ 的 FFN matmul，但 forward 要对输出 activation all-reduce，backward 要对 input gradient all-reduce。

与 DP/FSDP 不同，TP 通信的是 activation，消息大小更接近 $2BD$ bytes，而不是 $2DD_{FF}$ bytes。因此：

- batch/sequence 增大会放大 TP activation communication；
- hidden/FFN 维度增大会增加计算，也会改变 TP 的算术强度；
- TP 通常优先放在节点内高速互联上，FSDP/DP 可以跨较慢的网络轴。

2D FSDP + TP 把设备组成 $N_{FSDP}\times N_{TP}$ 网格：

```text
FSDP axis -> gather TP-sharded weights
TP axis   -> reduce FSDP-batch-sharded activations
```

若两个 axes 使用独立网络资源并能 overlap，通信时间取两者最大值；若共享同一瓶颈链路，则应相加。选择网格不能只看总 GPU 数，而要让 weight communication 与 activation communication 尽量平衡，并服从真实拓扑。

## 9. 测试、复现与每条证据的含义

### 9.1 当前环境

本地环境检查结果：

```text
macOS arm64
Python 3.12
PyTorch 2.11
MPS available
CUDA unavailable
Triton unavailable
```

分布式 CPU 测试使用 Gloo 和本机多进程。Gloo 适合开发 correctness，不能代表 NCCL GPU latency 或 bandwidth。

### 9.2 完整测试

执行命令：

```bash
env UV_CACHE_DIR=/tmp/cs336-uv-cache PYTHONDONTWRITEBYTECODE=1 \
  ~/.local/bin/uv run pytest -p no:cacheprovider
```

结果：

| 测试区域 | 结果 | 它实际证明了什么 |
|---|---:|---|
| PyTorch attention | 2 passed | output、LSE、`dQ/dK/dV` 对齐 reference |
| Triton attention | 4 skipped | 需要 CUDA，当前无 GPU 证据 |
| DDP | 2 passed | 两 rank 多步训练等价于 full-batch baseline |
| Sharded optimizer | 2 passed | AdamW 多步更新一致，含 tied weights |
| FSDP | 4 passed | FP32/FP16 contract、full-param gather、gradient sync |
| 独立回归 | 6 passed | backend routing 2、checkpointing 3、FSDP state dict 1 |
| 合计 | **16 passed, 4 skipped** | 当前独立仓库的完整测试结果 |

Attention 的数值容差为 `rtol=atol=1e-2`；FSDP FP32 与 mixed precision 测试使用不同容差。容差通过不代表 bitwise identical，而是符合低精度/并行浮点 reduction 的预期误差范围。

### 9.3 Lint 与 lockfile

实现和新增测试运行：

```bash
~/.local/bin/uv run ruff check --no-cache \
  cs336_systems \
  tests/adapters.py \
  tests/test_attention_backend_routing.py \
  tests/test_checkpointing.py

~/.local/bin/uv lock --check
```

两项均通过。全仓 `ruff check .` 会命中课程原始测试文件中的既有 lint 问题，因此这里准确表述为“实现和新增测试 lint 通过”，不扩大成“所有上游文件 lint 通过”。

### 9.4 CPU/Gloo smoke benchmark

脚本路径还做了最小 smoke：

| 路径 | world size | mean time |
|---|---:|---:|
| naive DDP | 2 | 0.004411 s |
| flat DDP | 2 | 0.004839 s |
| overlap DDP | 2 | 0.006415 s |
| teaching FSDP | 2 | 0.005685 s |
| checkpointed Transformer forward | 1 | 1.609158 s |

这些数字只证明 CLI、多进程和 training loop 可运行。Tiny CPU model 上 overlap 比 naive 慢并不矛盾，因为 hook 和 collective launch overhead 占比更大；也不能据此预测 GPU 上的排名。

### 9.5 如何在 NVIDIA 环境补齐结果

Transformer timing 示例：

```bash
uv run python -m cs336_systems.scripts.benchmark_transformer \
  --model-size xl \
  --context-length 2048 \
  --batch-size 4 \
  --mode train \
  --bf16 \
  --warmup-steps 5 \
  --steps 20
```

Checkpointing 对照只需添加不同的：

```bash
--checkpoint-chunk-size 1
--checkpoint-chunk-size 2
--checkpoint-chunk-size 4
```

Attention sweep：

```bash
uv run python -m cs336_systems.scripts.benchmark_attention \
  --seq-lens 128 256 1024 4096 16384 65536 \
  --d-models 16 32 64 128 \
  --dtype all \
  --causal
```

Distributed benchmark 在 GPU 上应使用 NCCL，并保证 rank 到 GPU 的映射正确：

```bash
uv run python -m cs336_systems.scripts.benchmark_distributed \
  --benchmark ddp \
  --backend nccl \
  --world-size 2 \
  --ddp-mode overlap
```

Memory snapshot：

```bash
uv run python -m cs336_systems.scripts.profile_memory \
  --model-size xl \
  --context-length 2048 \
  --batch-size 4 \
  --mode train \
  --bf16 \
  --output memory_snapshot.pickle
```

跑 GPU 实验时还应记录 GPU 型号、PyTorch/CUDA/Triton 版本、power state、warmup、repetitions、dtype 和输入 shape，否则 latency table 难以复现。

## 10. 作业要求与当前交付矩阵

| 作业部分 | 代码/推导 | 当前验证 | 仍缺少 |
|---|---|---|---|
| Transformer benchmark | 已实现 | CPU smoke | 各模型 CUDA timing table |
| Nsight profiling | 脚本可接入 | 未运行 | kernel summary、timeline 截图 |
| Mixed precision | BF16 autocast + dtype 分析 | CPU 参数路径检查 | GPU speed/memory 对照 |
| Memory profiling | snapshot 脚本 | CLI 路径检查 | memory_viz timeline 与 peak table |
| Activation checkpointing | 已实现 | output/gradient tests | CUDA peak-memory Pareto curve |
| FlashAttention forward | PyTorch + Triton | PyTorch CPU pass | 4 个 CUDA cases 与长序列 benchmark |
| FlashAttention backward | PyTorch + 可选 Triton kernels | routing pass | CUDA numerical/performance tests |
| DDP variants | naive/flat/overlap | Gloo baseline pass | NCCL timing 与 overlap timeline |
| Optimizer state sharding | 已实现 | 10-step Gloo pass | GPU peak memory 与 step time |
| Teaching FSDP | 已实现 | Gloo correctness pass | reduce-scatter/prefetch 优化与 Nsight |
| DP/FSDP/TP/2D analysis | 本文给出模型与推导 | 公式复核 | 用真实拓扑参数校准 |
| Leaderboard | 未伪造 | 无 | 两张 B200 上的真实 8B step time |

官方提交物是 `writeup.pdf` 和 `code.zip`。[`test_and_make_submission.sh`][submission-script] 会运行测试、生成 JUnit XML，并重新打包代码。我不是课程注册学生，也没有向 Gradescope 提交，因此没有生成这些 submission artifacts。

这个矩阵比简单写“作业完成”更准确：软件 correctness 已覆盖大部分公开接口，硬件相关 deliverables 仍然明确缺失。

## 11. 常见误解与这次实现给出的答案

### “FlashAttention FLOPs 更少，所以更快”

不准确。它的核心优势是避免 materialize $N^2$ 中间矩阵、减少 HBM IO，并通过 fusion 提高数据复用；backward 还会主动重算部分 scores/probabilities。

### “用了 `async_op=True` 就自动完成 overlap”

不准确。还需要合理的 gradient ready 顺序、足够大的 compute window、通信 stream 调度和最终 wait。小 tensor collective 太多时，launch latency 仍可能主导。

### “Sharded optimizer 就是 FSDP”

不是。前者只分 optimizer state，模型 parameters 和 gradients 仍完整复制；FSDP 进一步分参数与梯度，但必须为计算临时 gather weight。

### “FSDP 一定减少通信量”

不一定。FSDP 用额外 weight all-gather 换持久显存下降。它依赖 prefetch 和 overlap 把通信藏在 compute 后面；当前教学实现还用 full-gradient all-reduce，通信效率低于标准 reduce-scatter 路径。

### “测试通过就说明 kernel 快”

不成立。Correctness test 只比较数值与状态语义；性能需要目标硬件、同步边界、warmup、重复测量和 profiler 证据。

## 12. 继续阅读：课程概念怎样走向生产系统

这份作业建立的是最小可解释版本。继续往生产系统走，可以沿以下资料理解每个抽象如何升级：

1. [FlashAttention-4][flash4] 展示 Blackwell 上围绕 TMEM、异步 Tensor Core 和 softmax/MMA overlap 的算法-kernel 协同设计。
2. [PyTorch Activation Checkpointing Techniques][pytorch-ac] 介绍 selective checkpoint、memory budget API 与 compile min-cut partitioner，从手工 chunk 走向图级自动选择。
3. [TorchTitan][torchtitan] 把 FSDP2、DTensor、TP/PP/CP、distributed checkpoint 和 mixed precision 集成进 PyTorch 原生训练栈。
4. [FSDP2 `fully_shard`][fsdp2] 与 [DTensor][dtensor] 用 per-parameter sharding、DeviceMesh 和 SPMD 表达替代手工 `ShardSpec`。
5. NeurIPS 2025 的 [Topology-Aware Communication Alignment on More Than 9600 GPUs][arnold] 说明大规模训练必须建模真实拓扑，不能把网络当成理想 fully connected collective。
6. [The Ultra-Scale Playbook][ultrascale] 用实测串起 DP、ZeRO/FSDP、TP、PP、SP 和 communication overlap。

## 总结

这份 Assignment 2 的价值不只是写出几个类，而是建立一套训练系统推理方法：

1. 先定义正确的测量边界，再讨论快慢；
2. 区分持久状态、saved activation 和临时 communication buffer；
3. 用 online reduction 与 recomputation 减少全局内存 IO；
4. 用数学等价性约束分布式同步，再优化 collective 粒度和时序；
5. 把内存收益、通信代价和实现复杂度放在同一张表里；
6. 明确 correctness 证据与性能证据不是一回事。

当前公开实现已经覆盖 benchmark/profile harness、activation checkpointing、PyTorch/Triton FlashAttention、三种 DDP、optimizer state sharding 和教学型 FSDP，并通过可在 CPU/Gloo 上运行的公开测试与独立回归测试。剩余工作主要有两类：一类是 CUDA/NCCL/Nsight/B200 上的真实数据；另一类是把教学 FSDP 的 full-gradient all-reduce 升级为 reduce-scatter，并加入 prefetch、bucket 和 distributed checkpoint。

[assignment]: https://github.com/keepkeen/cs336-assignment2-systems/tree/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9
[coursework-commit]: https://github.com/keepkeen/cs336-assignment2-systems/commit/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9
[handout]: https://github.com/stanford-cs336/assignment2-systems
[implementation-explanation]: https://github.com/keepkeen/cs336-assignment2-systems/blob/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9/docs/implementation.md
[notice]: https://github.com/keepkeen/cs336-assignment2-systems/blob/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9/NOTICE.md
[adapters]: https://github.com/keepkeen/cs336-assignment2-systems/blob/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9/tests/adapters.py
[attention]: https://github.com/keepkeen/cs336-assignment2-systems/blob/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9/cs336_systems/attention.py
[attention-pytorch]: https://github.com/keepkeen/cs336-assignment2-systems/blob/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9/cs336_systems/attention.py#L557
[attention-routing-test]: https://github.com/keepkeen/cs336-assignment2-systems/blob/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9/tests/test_attention_backend_routing.py
[checkpointing]: https://github.com/keepkeen/cs336-assignment2-systems/blob/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9/cs336_systems/checkpointing.py
[checkpointing-test]: https://github.com/keepkeen/cs336-assignment2-systems/blob/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9/tests/test_checkpointing.py
[distributed]: https://github.com/keepkeen/cs336-assignment2-systems/blob/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9/cs336_systems/distributed.py
[ddp-test]: https://github.com/keepkeen/cs336-assignment2-systems/blob/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9/tests/test_ddp.py
[optim]: https://github.com/keepkeen/cs336-assignment2-systems/blob/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9/cs336_systems/optim.py
[sharded-optimizer-test]: https://github.com/keepkeen/cs336-assignment2-systems/blob/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9/tests/test_sharded_optimizer.py
[fsdp]: https://github.com/keepkeen/cs336-assignment2-systems/blob/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9/cs336_systems/fsdp.py
[fsdp-test]: https://github.com/keepkeen/cs336-assignment2-systems/blob/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9/tests/test_fsdp.py
[scripts]: https://github.com/keepkeen/cs336-assignment2-systems/tree/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9/cs336_systems/scripts
[benchmark-transformer]: https://github.com/keepkeen/cs336-assignment2-systems/blob/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9/cs336_systems/scripts/benchmark_transformer.py
[profile-memory]: https://github.com/keepkeen/cs336-assignment2-systems/blob/3ff1df475ff9dd2a89e32425f1e7b7691bfe23e9/cs336_systems/scripts/profile_memory.py
[submission-script]: https://github.com/stanford-cs336/assignment2-systems/blob/ca8bc81a59b70516f7ebb2da4808daade877c736/test_and_make_submission.sh
[flash4]: https://tridao.me/blog/2026/flash4/
[pytorch-ac]: https://pytorch.org/blog/activation-checkpointing-techniques/
[torchtitan]: https://arxiv.org/abs/2410.06511
[fsdp2]: https://docs.pytorch.org/docs/stable/distributed.fsdp.fully_shard.html
[dtensor]: https://docs.pytorch.org/docs/stable/distributed.tensor.html
[arnold]: https://papers.nips.cc/paper_files/paper/2025/hash/d82c24b7a4237aa4283b38e12047dc38-Abstract-Conference.html
[ultrascale]: https://huggingface.co/spaces/nanotron/ultrascale-playbook?section=high-level_overview
