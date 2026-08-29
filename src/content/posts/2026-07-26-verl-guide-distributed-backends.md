---
title: "verl 分布式执行与训练、Rollout 后端"
description: "比较共置与分离、FSDP2 与 Megatron、vLLM 与 SGLang，以及六种权重同步后端与异步正确性。"
date: 2026-07-26
updatedDate: 2026-08-29
tags:
  - verl
  - distributed-systems
  - fsdp
  - megatron
lang: zh-CN
featured: false
draft: false
series: verl-interview-guide
seriesOrder: 6
---

## 两层并行不要混淆

- **任务/角色并行**：actor、rollout、critic、reward 是否占不同资源，是否流水化。由 Ray、ResourcePool、Trainer mode 管理。
- **模型计算并行**：一个模型内部如何分布到多 GPU。由 FSDP2 或 Megatron 的 DP/TP/PP/CP/EP 等管理。

Ray 不替代 NCCL/FSDP/Megatron；它负责进程、资源和 RPC 编排，模型后端负责高性能 collective 和计算。

## Colocate 与 separate

### 共置

actor/rollout 共享 GPU，收益是减少专用 GPU 数量和跨节点权重传输；代价是显存状态切换、CUDA context 竞争和阶段串行。典型顺序：休眠 rollout/释放 KV cache → 恢复 actor 训练状态 → 更新 → 恢复 rollout weights → 同步 → actor 参数可 offload → 恢复 KV cache。

vLLM 的 sleep 分级：CUDA 且 vLLM>=0.18 默认 level 2（释放权重+KV cache），启用 MTP/LoRA adapter 或 NPU 时用 level 1（仅 KV cache 转存），由 `VLLM_SLEEP_LEVEL` 与 hybrid sleep 逻辑决定（`vllm_async_server.py`）。`rollout.free_cache_engine` 默认 True，控制是否每轮释放/恢复。

### 分离

训练 GPU 和 rollout GPU 独立，可并行重叠，推理服务也能选择独立 TP/DP；代价是每次参数同步更昂贵，并引入样本陈旧度。适合资源充足、rollout 长尾明显或希望独立扩缩容的场景。

## 三种 V1 trainer mode

| mode | 特征 | 适用 |
|---|---|---|
| `sync` | 生成一批、训练一批，版本最清晰；禁用 partial rollout | 起步、复现、排查正确性 |
| `colocate_async` | 同一资源上生成/训练细流水化；sample 后 abort+sleep，step 后恢复生成；支持 partial rollout；`num_warmup_batches`（默认 1） | GPU 不足但希望减少阶段空洞 |
| `separate_async` | 增加 standalone rollout 资源（`rollout.nnodes/n_gpus_per_node`），以 mini-batch 粒度重叠训练/生成；`parameter_sync_step` 默认 4，且要求 `train_batch_size == parameter_sync_step * ppo_mini_batch_size` | 大规模、rollout/工具长尾、追求吞吐 |

异步配置里，replay buffer 的 `max_off_policy_threshold`（默认 8）与 `max_off_policy_strategy=drop|wait` 共同定义数据新鲜度（`ppo_trainer.yaml` 的 `trainer.v1.sampler`）。吞吐提高并不自动意味着有效学习速度提高。

**重要更新（#7188，2026-07-29）**：`separate_async` 已支持 Decoupled PPO，不再强制 `bypass_mode=True`。实现方式是用 [`verl/experimental/separation/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/verl/experimental/separation) 的 `DetachActorWorker` 替换 actor worker，支持把训练前的权重 detach 到 CPU、按 `local_trigger_step` 在"π_old 权重"与"当前权重"之间切换来重算 old log-prob。E2E 脚本已显式跑 `bypass_mode=False`（[`tests/special_e2e/run_v1_separate_async.sh:62`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/tests/special_e2e/run_v1_separate_async.sh#L62)）。

**新增 step-boundary 借卡（#7373，实验性、默认关闭）**：设置 `trainer.v1.separate_async.hybrid_rollout.enable_switch=true` 后，step 间若 standalone rollout 尚未产生足够 sampleable groups，hybrid trainer replicas 会临时加入 load balancer 帮助生成；达到阈值后执行 remove → abort partial requests → sleep，把 GPU 收回训练。默认 `switch_threshold_ratio=0.4`，可根据实际 sample wait 自适应上下调，并用预估收益对比最近切换成本决定是否值得切。它不能与 rollout PD disaggregation 同开；自定义 sampler 必须实现 `get_sampleable_count` 和 `wait_for_sampleable`。这不是连续最优调度器，收益估计仍使用静态 GPU 数比例。

仓库另有 [`verl/experimental/fully_async_policy`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/verl/experimental/fully_async_policy)（Rollouter + MessageQueue + ParameterSynchronizer 的 streaming/partial rollout 架构）和 `one_step_off_policy`。注意 2026-08 的状态变化：CI 已整体从这两条实验路径迁移到 V1 `separate_async`（#7357，删除旧 workflow 与 e2e 脚本，官方注明"准备把 fully_async 移入 recipe"）。面试中应表述为"独立实验入口，能力正被 V1 separate_async 吸收"，不要称其为 V1 的第四种 trainer mode。

## 训练后端：EngineRegistry

当前 `EngineRegistry` 注册的后端（[`verl/workers/engine/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/verl/workers/engine)，按 `engine_config.strategy` 选择）：

| backend | 说明 |
|---|---|
| `fsdp` / `fsdp2` | 同一个 FSDPEngine 类注册两个名字；`fsdp` 走 PyTorch FSDP1，`fsdp2` 走 `fully_shard`/DTensor（需 PyTorch>=2.4）。支持 CPU offload、activation checkpointing、Ulysses 序列并行、remove padding、LoRA |
| `fsdp_turbo` | 基于外部 FSDPTurbo 库，CUDA/NPU 均注册；组合 FSDP + expert parallel + context parallel，强调通信/重计算 overlap。当前只有 language-model engine 注册，TP 保持 1，且 Turbo CP 不能与 verl 自身 Ulysses SP 同开 |
| `megatron` | TP/PP/EP/CP + distributed optimizer、DCP（动态上下文并行）、router replay、MTP、Muon 优化器、LoRA bridge |
| `veomni` | 字节 VeOmni 平台后端（仅 fsdp2 分片），支持 Ulysses SP、router replay、DeepSeek-V4 |
| `torchtitan` | PyTorch 官方 TorchTitan：FSDP2/HSDP + TP + CP + EP；当前 engine 不支持 PP，且依赖匹配的 PyTorch/TorchTitan nightly |
| `automodel` | NVIDIA NeMo Automodel 适配 |

这里没有独立 `mindspeed` backend：#7374 删除了 `strategy=mindspeed` 及其配置。Ascend 上仍保留 MindSpeed patch/Bridge，但类注册为 `(backend=megatron, device=npu)`，用户配置写 `strategy=megatron`。这说明 registry 要按“strategy × device × model_type”看，不能只按目录名猜后端名。

### FSDP/FSDP2

适合 Hugging Face 生态、中小到大型 dense 模型、快速接新模型。FSDP 按 data-parallel rank 分片参数/梯度/优化器状态；FSDP2 基于 DTensor、逐参数分片，组合性和 reshard 通常更好。代价是前后向 all-gather/reduce-scatter，以及 actor→rollout 权重布局转换。

选择理由应说成："模型原生 HF、规模与网络允许、开发效率优先"，而不是"FSDP 永远更快"。

FSDP-Turbo 是同一技术族里的专门优化后端：适合愿意提供 module glob/patch plan、希望在 MoE/长上下文上组合 EP/CP 和 overlap 的场景；它不是把 `fsdp2` 名字改掉就自动更快。外部库、模型 patch、critic/value-model 支持和 CI 覆盖都要单独检查。

### Megatron

适合超大 dense/MoE、长上下文、多机高速互联。提供 TP（矩阵切分）、PP（层间流水）、CP（上下文切分，另有 2026-08 新增的动态 CP：按 packed micro-batch 长度动态选 CP size，见 [`docs/advance/dynamic_context_parallel.rst`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/docs/advance/dynamic_context_parallel.rst)）、EP/ETP（MoE expert 并行）、distributed optimizer，以及 Muon 优化器（#7120，经 Megatron-Core TensorParallelMuon 暴露，[`examples/muon/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/examples/muon)）。

优势是成熟的多维并行和大模型效率；代价是模型实现/权重映射（经 Megatron-Bridge/mbridge）、pipeline bubble、拓扑和 checkpoint 更复杂。训练能启动但 rollout 更新后输出异常时，应优先核对训练权重到 HF/inference 权重的名称、shape 和分片转换。

## Rollout 后端

当前 `_ROLLOUT_REGISTRY`（见 [`verl/workers/rollout/base.py`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/workers/rollout/base.py)）只注册 async server 模式：vLLM、SGLang、TRT-LLM 三者都经 `ServerAdapter`；`rollout.mode=sync` 会在配置校验直接报错（SPMD sync rollout 已于 v0.7 移除）。vLLM 要求 >= 0.18（#7190，入口见 [`verl/third_party/vllm/__init__.py`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/third_party/vllm/__init__.py)）。

- vLLM：成熟的 continuous batching、PagedAttention 和广泛模型支持。
- SGLang：多轮/agent、结构化生成和服务侧能力丰富，在 verl 社区使用广泛。PD 分离（prefill/decode 不对称部署）当前已同时 dispatch 到 SGLang 和 vLLM 的独立 replica 实现，不再是 SGLang 独有。vLLM PD 仍是明确的 MVP 边界：只支持 `nixl|mooncake` transfer backend、`prefill_replicas=1`、单节点、DP=1、PP=1，且 NPU 未验证。
- HF rollout：`HFRollout` 文件仍存在但未注册进主 registry，属 legacy/受限实现，不能据"文件存在"断言主路径开箱支持。

部署形态由 `RolloutReplica` 统一管理，分三种（`replica.py`）：HYBRID（与训练同进程共卡）、COLOCATED（同 GPU 不同进程，常用于 LLM-as-judge/RM）、STANDALONE（独立 GPU，`separate_async` 使用）。

## Rollout TP 不是越大越好

更大 TP 能让单个模型装得下、增加单请求算力，但也增加跨卡通信并减少 DP 副本数。在大量独立 prompt 的生成中，更多 DP 副本有时吞吐更高。需要联合考虑：模型是否装得下、KV cache、prompt/response 长度、batch、互联带宽和长尾。

## 权重同步：CheckpointEngine

Checkpoint Engine 抽象训练 worker 到 rollout server 的权重传递，统一 `send_weights / receive_weights / get_weights` API。当前注册表（[`verl/checkpoint_engine/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/verl/checkpoint_engine)）：

| backend | 机制 | 适用 |
|---|---|---|
| `naive` | 共置进程内 per-tensor 拷贝 | colocate（V1 基类强制） |
| `nccl` | NCCL bucket broadcast；当前构造签名默认启用 node-local multi-sender relay；NPU 上同名注册为 HCCL 实现 | 分离部署全量同步 |
| `nixl` | NIXL P2P 点对点 | 跨节点异构传输 |
| `mooncake` / `kimi_ckpt_engine` | Mooncake store / Kimi 开源 checkpoint-engine | 大规模分离集群 |
| `delta_sharded` | 在训练 shard 上做 bytewise 稀疏差分，只传变化的 (位置,值)；首轮全量 seed，此后 delta | 当前限 FSDP1/FSDP2/TorchTitan → SGLang BF16 的分离部署 |

`delta_sharded` 的差分是 bit-exact 的（view-as-int 逐字节比较），并配套 `ShardSpec/BlockPlacement` 契约让 FSDP1/FSDP2/TorchTitan 的分片布局映射到 HF 目标布局；TorchTitan 的 HSDP/TP/CP/EP 已覆盖，PP 会在 export 边界拒绝。Megatron 当前仍在 roadmap，rollout 侧只支持 SGLang BF16，不能因为存在通用 registry 就外推到 vLLM/TRT-LLM/量化 rollout。当参数变化不稀疏、后端/精度不满足约束时可能不划算。面试要强调 checksum、版本原子性和失败恢复，否则 rollout 可能混用权重版本。

NCCL multi-sender 与 delta 是两种不同优化：前者仍传全量 bucket，只让 actor rank 0 同节点的 NVLink peers 作为 relay 扩大 NIC fan-out；后者改变 payload，只传稀疏差分。不要把“多个 sender”误解为多个训练 rank 各自发送一段不同权重。

参考：[`verl/checkpoint_engine/README.md`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/checkpoint_engine/README.md)、[`docs/advance/delta_weight_sync.md`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/docs/advance/delta_weight_sync.md)。

## 异步正确性与 rollout correction

异步下可能同时存在生成轨迹的 rollout policy、训练该 batch 前固定的 old anchor、以及更新中的 current actor。Decoupled 模式（`bypass_mode=false`，默认）保留三策略，并可对 rollout→old 偏移做 token/sequence importance sampling 或 rejection sampling；Bypass 模式直接令 old 等于 rollout，只保留 rollout/current 两策略，并选择 PPO clip 或显式 IS 的 REINFORCE loss。三种 trainer mode 现在都可以选 decoupled 或 bypass（#7188 之后）。

rollout correction 能缓解而不能无限修复陈旧数据。还要联合监控模型版本跨度、IS 权重/有效样本率、clip fraction、drop/wait 和最终 wall-clock 学习曲线。配置入口：[`verl/trainer/config/algorithm/rollout_correction.yaml`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/trainer/config/algorithm/rollout_correction.yaml)（`rollout_is`、`rollout_is_threshold=2.0`、`rollout_rs`、`bypass_mode=false`、`loss_type=ppo_clip|reinforce`），原理见 [`docs/algo/rollout_corr.md`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/docs/algo/rollout_corr.md) 与 `rollout_corr_math.md`。

## 多机启动与网络

Ray head 管理控制面，worker 节点加入集群，再提交训练任务。底层模型通信仍依赖 NCCL/HCCL。真实排障要检查：

- 每节点 CUDA/驱动/依赖一致；
- 网卡与 NCCL socket/IB 选择（Slurm 场景网卡接口已可配置，#7386）；
- 防火墙和端口；
- `/dev/shm` 与 Ray object store；
- 共享 checkpoint 路径；
- placement group 是否拿到完整资源；
- 节点 GPU 数与配置是否一致。

参考 [`docs/start/multinode.rst`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/docs/start/multinode.rst)。

## 典型场景选择

| 场景 | 起始方案 |
|---|---|
| 单机 8 卡、7B/14B、先跑通 | V1 sync + FSDP2 + vLLM，actor/rollout colocate |
| 70B、显存紧 | FSDP2 + checkpoint/offload/reshard；评估 LoRA；只有在模型/依赖有 Turbo plan 时再比较 fsdp_turbo |
| 235B/671B MoE、多机 | Megatron + TP/PP/CP/EP（或 veomni），严格按网络拓扑设计 |
| 工具调用长尾 | SGLang/vLLM AgentLoop；先 sync 验证，再 separate_async |
| rollout 成为主要瓶颈 | 增加 rollout DP、调 token budget/KV cache；资源足够再分离异步；若 trainer step 间持续等样本可试实验性借卡；权重同步后端按真实支持矩阵选择 |
