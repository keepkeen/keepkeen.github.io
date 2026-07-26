---
title: "verl 分布式执行与训练、Rollout 后端"
description: "比较共置与分离、FSDP2 与 Megatron、vLLM 与 SGLang，以及异步权重同步。"
date: 2026-07-26
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

### 分离

训练 GPU 和 rollout GPU 独立，可并行重叠，推理服务也能选择独立 TP/DP；代价是每次参数同步更昂贵，并引入样本陈旧度。适合资源充足、rollout 长尾明显或希望独立扩缩容的场景。

## 三种 V1 trainer mode

| mode | 特征 | 适用 |
|---|---|---|
| `sync` | 生成一批、训练一批，版本最清晰 | 起步、复现、排查正确性 |
| `colocate_async` | 同一资源上的生成/训练做更细流水化 | GPU 不足但希望减少阶段空洞 |
| `separate_async` | 增加 standalone rollout 资源，同时仍保留 hybrid replicas，按频率同步参数 | 大规模、rollout/工具长尾、追求吞吐 |

异步配置的 `parameter_sync_step`、`max_off_policy_threshold` 和 `max_off_policy_strategy=drop|wait` 共同定义数据新鲜度。吞吐提高并不自动意味着有效学习速度提高。

仓库另有 [`verl/experimental/fully_async_policy`](https://github.com/verl-project/verl/tree/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/experimental/fully_async_policy) 独立入口，它不是 V1 的第四种 `trainer_mode`。它用 Rollouter、MessageQueue、Trainer、ParameterSynchronizer 组织 streaming/partial rollout、陈旧度和动态资源；成熟度与约束应按 [`docs/advance/fully_async.md`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/docs/advance/fully_async.md) 单独评估。

## FSDP/FSDP2

适合 Hugging Face 生态、中小到大型 dense 模型、快速接新模型。FSDP 按 data-parallel rank 分片参数/梯度/优化器状态；FSDP2 基于 DTensor、逐参数分片，组合性和 reshard 通常更好。

常见能力：CPU offload、activation checkpointing、sequence parallel/Ulysses、remove padding、mixed precision。代价是前后向 all-gather/reduce-scatter，以及 actor→rollout 权重布局转换。

选择理由应说成：“模型原生 HF、规模与网络允许、开发效率优先”，而不是“FSDP 永远更快”。

## Megatron

适合超大 dense/MoE、长上下文、多机高速互联。它提供：

- TP：矩阵在多卡切分。
- PP：不同层放不同 stage。
- CP：上下文维度切分。
- EP/ETP：MoE expert 并行。
- data parallel + distributed optimizer。

优势是成熟的多维并行和大模型效率；代价是模型实现/权重映射、pipeline bubble、拓扑和 checkpoint 更复杂。训练能启动但 rollout 更新后输出异常时，应优先核对训练权重到 HF/inference 权重的名称、shape 和分片转换。

EngineRegistry 还包含 TorchTitan、VeOmni、AutoModel、MindSpeed/NPU 等平台或扩展后端。面试中知道其存在即可；具体成熟度、模型支持和 recipe 必须以当前源码注册及 CI 为准，不能从目录名推断生产可用性。

## Rollout 后端

当前 async rollout registry 主要注册 vLLM、SGLang、TRT-LLM server。选择时看模型支持、版本、TP/DP、prefix cache、多轮工具、VLM 和权重热更新能力。

- vLLM：成熟的 continuous batching、PagedAttention 和广泛模型支持。
- SGLang：多轮/agent、结构化生成和服务侧能力丰富，在 verl 社区使用广泛。
- HF rollout：仓库有 `HFRollout` 实现并可调用 `generate`，但未注册到当前主 async registry；更适合把它理解为 legacy/受限实现，不能据“文件存在”断言主路径开箱支持。

源码：[`verl/workers/rollout/base.py:88-109`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/workers/rollout/base.py#L88-L109)，[`verl/workers/rollout/hf_rollout.py`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/workers/rollout/hf_rollout.py)。

## Rollout TP 不是越大越好

更大 TP 能让单个模型装得下、增加单请求算力，但也增加跨卡通信并减少 DP 副本数。在大量独立 prompt 的生成中，更多 DP 副本有时吞吐更高。需要联合考虑：模型是否装得下、KV cache、prompt/response 长度、batch、互联带宽和长尾。

## 权重同步

Checkpoint Engine 抽象训练 worker 到 rollout server 的权重传递。共置通常用本地/naive 同步；分离可用 NCCL/HCCL/NIXL/Mooncake 等路径，具体受硬件和拓扑限制。

delta-sharded 通过在训练 shard 上计算 bit-exact 稀疏差分，只传变化坐标和值，减少全量传输和峰值内存；当参数变化不稀疏、后端/精度不满足约束时可能不划算。面试要强调 checksum、版本原子性和失败恢复，否则 rollout 可能混用权重版本。

参考：[`verl/checkpoint_engine/README.md`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/checkpoint_engine/README.md)、[`docs/advance/delta_weight_sync.md`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/docs/advance/delta_weight_sync.md)。

## 异步正确性与 rollout correction

异步下可能同时存在生成轨迹的 rollout policy、训练该 batch 前固定的 old anchor、以及更新中的 current actor。Decoupled 模式保留三策略并可对 rollout→old 偏移做 token/sequence importance sampling 或 rejection sampling；Bypass 模式直接令 old 等于 rollout，只保留 rollout/current 两策略，并选择 PPO clip 或显式 IS 的 REINFORCE loss。`separate_async` 当前强制 bypass。

rollout correction 能缓解而不能无限修复陈旧数据。还要联合监控模型版本跨度、IS 权重/有效样本率、clip fraction、drop/wait 和最终 wall-clock 学习曲线。配置入口：[`verl/trainer/config/algorithm/rollout_correction.yaml`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/trainer/config/algorithm/rollout_correction.yaml)，原理见 [`docs/algo/rollout_corr.md`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/docs/algo/rollout_corr.md)。

## 多机启动与网络

Ray head 管理控制面，worker 节点加入集群，再提交训练任务。底层模型通信仍依赖 NCCL/HCCL。真实排障要检查：

- 每节点 CUDA/驱动/依赖一致；
- 网卡与 NCCL socket/IB 选择；
- 防火墙和端口；
- `/dev/shm` 与 Ray object store；
- 共享 checkpoint 路径；
- placement group 是否拿到完整资源；
- 节点 GPU 数与配置是否一致。

参考 [`docs/start/multinode.rst`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/docs/start/multinode.rst)。

## 典型场景选择

| 场景 | 起始方案 |
|---|---|
| 单机 8 卡、7B/14B、先跑通 | V1 sync + FSDP2 + vLLM，actor/rollout colocate |
| 70B、显存紧 | FSDP2 + checkpoint/offload/reshard；评估 LoRA |
| 235B/671B MoE、多机 | Megatron + TP/PP/CP/EP，严格按网络拓扑设计 |
| 工具调用长尾 | SGLang/vLLM AgentLoop；先 sync 验证，再 separate async |
| rollout 成为主要瓶颈 | 增加 rollout DP、调 token budget/KV cache；资源足够再分离异步 |
