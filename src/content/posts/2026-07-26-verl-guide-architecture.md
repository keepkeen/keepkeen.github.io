---
title: "verl 系统架构：Role、WorkerGroup 与 DataProto"
description: "拆解配置、控制流、资源编排、Worker、DataProto 和 TransferQueue 的职责边界。"
date: 2026-07-26
tags:
  - verl
  - architecture
  - distributed-systems
lang: zh-CN
featured: false
draft: false
series: verl-interview-guide
seriesOrder: 3
---

## 分层心智模型

<div style="overflow-x: auto; margin: 1.5rem 0;">
  <img src="/images/verl-interview-guide/architecture.svg" alt="verl 系统架构分层" style="display: block; min-width: 760px; width: 100%; height: auto;" loading="lazy" />
</div>

上层回答“算法下一步做什么”，下层回答“在哪些 GPU、以何种并行方式做”。这就是框架可扩展性的来源。

图中的 Role 是配置和构造阶段使用的逻辑标签，不是每次 RPC 都经过的运行时节点；独立 rollout server 也可能由 `LLMServerManager` 直接管理，而不在普通 WorkerGroup 下游。

## 入口与配置

[`verl/trainer/main_ppo.py`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/trainer/main_ppo.py) 的职责很窄：Hydra 组装配置、做合法性校验、初始化 Ray runtime environment、创建远程 TaskRunner。`trainer.use_v1=true` 进入 `TaskRunnerV1`；否则进入 deprecated 的 V0 `TaskRunner`。

根配置 [`verl/trainer/config/ppo_trainer.yaml`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/trainer/config/ppo_trainer.yaml) 用 Hydra defaults 分别组合 actor、rollout、ref、critic、model、reward、algorithm。命令行的 `a.b.c=value` 本质是覆盖配置树，而不是调用定制脚本逻辑。

面试要点：入口只负责 bootstrap；真正算法循环在 Trainer，真正模型计算在 Worker/Engine。

## Role：逻辑职责

[`verl/trainer/ppo/utils.py`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/trainer/ppo/utils.py) 的 `Role` 表达 Actor、Rollout、Critic、RefPolicy、RewardModel，以及若干共置组合。Role 不是 Ray actor，也不是具体模型类。它用于：

- 选择 worker 实现；
- 映射资源池；
- 决定是否把多个角色融合到同一进程；
- 在 Trainer 中使用稳定语义，而不绑定 FSDP/Megatron。

## ResourcePool 与 placement group

`ResourcePoolManager` 维护“角色 → pool”和“pool → 每节点 GPU/进程布局”。`RayResourcePool` 使用 Ray placement group 预留 bundle。当前默认 V1 把 actor/ref/critic 映射到 `global_pool`；reward model 和 teacher 可配置独立 pool。这个抽象本身支持更灵活布局，但 `separate_async` 的 standalone rollout 由 `LLMServerManager` 另行创建，不属于默认角色到 pool 映射。

需要区分：

- ResourcePool 是 verl 的逻辑资源描述和角色映射。
- placement group 是 Ray 对一组资源 bundle 的原子预留与调度机制。
- `max_colocate_count` 控制一个资源位置允许共置多少 worker 角色，不是 tensor parallel 大小。

代码入口：[`verl/single_controller/ray/base.py:113-224`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/single_controller/ray/base.py#L113-L224)。

## Worker、WorkerGroup 与 dispatch

Worker 是单个分布式进程中的执行对象；WorkerGroup 是一组同构 worker 的控制句柄。`RayWorkerGroup` 创建 Ray actors、动态绑定远程方法、广播调用并收集结果。

Worker 方法用 `@register(dispatch_mode=...)` 声明数据分发语义，例如切 batch、单 rank 执行、所有 rank 执行和聚合。这样 Trainer 调用的是逻辑方法，WorkerGroup 负责 SPMD 细节。

面试回答模板：WorkerGroup 不是又一层无意义包装，它把算法控制流从 Ray RPC、rank 切分和结果收集里解耦，让相同 Trainer 能驱动不同训练引擎。

## TrainingWorker 与 ActorRolloutRefWorker

`TrainingWorker` 通过 EngineRegistry 选择模型训练后端，并暴露统一的推理 batch、训练 mini-batch、checkpoint 等能力。critic 可以作为 `model_type="value_model"` 的独立 TrainingWorker。

`ActorRolloutRefWorker` 是 hybrid engine 的关键组合：同一 worker 进程内管理 actor/ref 的训练引擎，以及 rollout 相关生命周期和权重同步。它允许同一组 GPU 分时承担训练和生成，而 Trainer 无需了解参数如何 reshard。

代码入口：

- [`verl/workers/engine_workers.py:76-156`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/workers/engine_workers.py#L76-L156)：TrainingWorker。
- [`verl/workers/engine_workers.py:446-804`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/workers/engine_workers.py#L446-L804)：ActorRolloutRefWorker 及显存/权重生命周期。

## DataProto：批计算协议

`DataProto` 由三部分组成：

- `batch`：TensorDict，放 input ids、mask、log-prob、reward、advantage 等张量。
- `non_tensor_batch`：NumPy object 数据，如 raw prompt、ground truth、data source。
- `meta_info`：不随样本逐条变化或控制调用的元信息。

`repeat`、`union`、`chunk`、`reorder` 等操作使 Trainer 能不断给同一批样本追加字段。V0 中完整 DataProto 常经过 driver；V1 主数据面虽改为 TransferQueue + `KVBatchMeta`，仍会在 reward、advantage、metrics 等局部计算中重建 DataProto。

实现见 [`verl/protocol.py:327-807`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/protocol.py#L327-L807)。

## TransferQueue：V1 的数据衔接

当前 V1 在启动时强制初始化 TransferQueue，并按 trajectory key 组织数据。AgentLoop 在一条 trajectory 完成生成及可选 reward/teacher 后，一次写入该记录的一组 rollout 字段；Trainer 后续按需读取并追加 old/ref log-prob、value、advantage 等结果。其核心收益是：

- 不同 trajectory 可独立完成，不必等整批 rollout 全部结束；这不表示任意字段一产生就逐字段发布；
- 控制元数据与分布式存储分离；
- 为异步生成/训练、过滤和自定义 sampler 提供统一数据面；
- 减少所有完整 DataProto 都经单 controller 的瓶颈。

但它没有消灭 controller：算法顺序、资源和训练 step 仍由 PPOTrainer 控制。相关入口：[`verl/trainer/ppo/v1/agent_loop_tq.py`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/trainer/ppo/v1/agent_loop_tq.py)、[`verl/trainer/ppo/v1/replay_buffer.py`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/trainer/ppo/v1/replay_buffer.py)、[`docs/data/transfer_queue.md`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/docs/data/transfer_queue.md)。

这里的 ReplayBuffer 首先是“TransferQueue 轨迹选择器”，不是默认的长期经验回放。sync 模式等待足够的终态 prompt groups，选中后在本 step 训练并清理，保持 on-policy/bufferless 语义；异步模式才使用 `ReplayBufferAsync`，依据模型版本跨度执行 `drop` 或 `wait`。

## V0 与 V1 怎么回答

| 维度 | V0 | V1（当前默认） |
|---|---|---|
| Trainer | `RayPPOTrainer` | `PPOTrainerSync/ColocateAsync/SeparateAsync` |
| 主要数据组织 | driver 中的 `DataProto` | TransferQueue + replay buffer，内部仍会使用 TensorDict/DataProto |
| 优点 | 主循环线性直观，便于学习 | 更细粒度数据流，支持异步和降低中心搬运瓶颈 |
| 状态 | deprecated，计划移除 | 默认路径 |

最佳表达是：“用 V0 理解经典 step，用 V1 描述当前架构”。
