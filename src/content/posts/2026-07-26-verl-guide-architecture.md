---
title: "verl 系统架构：Role、WorkerGroup 与 DataProto"
description: "拆解配置、控制流、资源编排、Worker、DataProto 和 TransferQueue 的职责边界。"
date: 2026-07-26
updatedDate: 2026-08-14
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

<div class="wide-media">
  <img class="wide-media-image" src="/images/verl-interview-guide/architecture.svg" alt="verl 系统架构分层" loading="lazy" />
</div>

上层回答"算法下一步做什么"，下层回答"在哪些 GPU、以何种并行方式做"。这就是框架可扩展性的来源。CheckpointEngine 作为独立一层负责训练侧到推理侧的权重同步。

图中的 Role 是配置和构造阶段使用的逻辑标签，不是每次 RPC 都经过的运行时节点；独立 rollout server 也可能由 `LLMServerManager` 直接管理，而不在普通 WorkerGroup 下游。

## 入口与配置

[`verl/trainer/main_ppo.py`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/trainer/main_ppo.py) 的职责很窄：Hydra 组装配置、`validate_config` 校验、初始化 Ray runtime environment、创建远程 TaskRunner。`trainer.use_v1=true`（默认，[`ppo_trainer.yaml:222`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/trainer/config/ppo_trainer.yaml#L222)）进入 `TaskRunnerV1`；否则进入 deprecated 的 V0 `TaskRunner`，并打印"将在 v0.9.0 移除"警告（[`main_ppo.py:184-193`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/trainer/main_ppo.py#L184-L193)）。

`TaskRunnerV1.run`（[`main_ppo.py:134-164`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/trainer/main_ppo.py#L134-L164)）做四件事：按 `trainer.v1.trainer_mode` 选 Trainer 类、**强制** `config.transfer_queue.enable = True` 并 `tq.init`、构造 Trainer 并 `init()`、创建 `AgentLoopManagerTQ`（可通过 `rollout.agent.agent_loop_manager_class` 替换为自定义 manager）后进入 `fit`。

根配置 `verl/trainer/config/ppo_trainer.yaml` 用 Hydra defaults 分别组合 actor、rollout、ref、critic、model、reward、algorithm、transfer_queue。命令行的 `a.b.c=value` 本质是覆盖配置树，而不是调用定制脚本逻辑。

面试要点：入口只负责 bootstrap；真正算法循环在 Trainer，真正模型计算在 Worker/Engine。

## Role：逻辑职责

[`verl/trainer/ppo/utils.py`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/trainer/ppo/utils.py) 的 `Role` 表达 Actor、Rollout、Critic、RefPolicy、RewardModel，以及若干共置组合。Role 不是 Ray actor，也不是具体模型类。它用于：

- 选择 worker 实现；
- 映射资源池；
- 决定是否把多个角色融合到同一进程；
- 在 Trainer 中使用稳定语义，而不绑定 FSDP/Megatron。

## ResourcePool 与 placement group

`ResourcePoolManager` 维护"角色 → pool"和"pool → 每节点 GPU/进程布局"。`RayResourcePool` 使用 Ray placement group 预留 bundle。当前默认 V1 把 actor/ref/critic 映射到 `global_pool`；reward model 和 teacher 可配置独立 pool。`separate_async` 的 standalone rollout 则按 `rollout.nnodes/n_gpus_per_node` 另建资源，不属于默认角色到 pool 映射。

需要区分：

- ResourcePool 是 verl 的逻辑资源描述和角色映射。
- placement group 是 Ray 对一组资源 bundle 的原子预留与调度机制。
- `max_colocate_count` 控制一个资源位置允许共置多少 worker 角色，不是 tensor parallel 大小。

代码入口：[`verl/single_controller/ray/base.py`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/single_controller/ray/base.py)（`RayResourcePool` 约 113 行起，`RayWorkerGroup` 约 418 行起）。

## Worker、WorkerGroup 与 dispatch

Worker 是单个分布式进程中的执行对象；WorkerGroup 是一组同构 worker 的控制句柄。`RayWorkerGroup` 创建 Ray actors、动态绑定远程方法、广播调用并收集结果。

Worker 方法用 `@register(dispatch_mode=...)` 声明数据分发语义。`Dispatch` 枚举的主要取值（[`verl/single_controller/base/decorator.py:26-47`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/single_controller/base/decorator.py#L26-L47)）：

| dispatch mode | 语义 |
|---|---|
| `ONE_TO_ALL` | 同一参数广播到所有 rank 执行（如 `init_model`、`update_weights`） |
| `DP_COMPUTE_PROTO` | 把 DataProto 按 DP 切分、各 rank 算各自 shard、结果拼回 |
| `make_nd_compute_dataproto_dispatch_fn(mesh)` | 按设备 mesh（如 "train"/"actor"/"ref"）切分与收集 |
| `RANK_ZERO` / `ALL_TO_ALL` 等 | 单 rank 执行 / 原样传递 |

这样 Trainer 调用的是逻辑方法，WorkerGroup 负责 SPMD 细节。

面试回答模板：WorkerGroup 不是又一层无意义包装，它把算法控制流从 Ray RPC、rank 切分和结果收集里解耦，让相同 Trainer 能驱动不同训练引擎。

## TrainingWorker 与 ActorRolloutRefWorker

`TrainingWorker`（[`verl/workers/engine_workers.py:76-443`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/workers/engine_workers.py#L76-L443)）通过 `EngineRegistry.new(backend=engine_config.strategy)` 选择模型训练后端，并暴露统一的 `infer_batch`、`train_mini_batch`/`train_batch`、checkpoint 等能力。critic 可以作为 `model_type="value_model"` 的独立 TrainingWorker。

`ActorRolloutRefWorker`（同文件 [446-817](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/workers/engine_workers.py#L446-L817)）是 hybrid engine 的关键组合：同一 worker 进程内管理 actor/ref 的训练引擎、rollout 实例以及 checkpoint engine。它的 `update_weights`（719-805）实现了共卡时的核心状态机：

1. 非 naive 后端（分离部署）：走 `checkpoint_engine.send_weights`；
2. naive（共置）：`resume(tags=["weights"])` 唤醒推理权重 → 从训练引擎导出 per-tensor 参数写入 rollout（LoRA 可先 merge）→ 若开了 param offload 则把 actor 参数放回 CPU → `resume(tags=["kv_cache"])` 恢复 KV cache。

它允许同一组 GPU 分时承担训练和生成，而 Trainer 无需了解参数如何 reshard。

## DataProto：批计算协议

`DataProto`（[`verl/protocol.py:318`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/protocol.py#L318) 起）由三部分组成：

- `batch`：TensorDict，放 input ids、mask、log-prob、reward、advantage 等张量。
- `non_tensor_batch`：NumPy object 数据，如 raw prompt、ground truth、data source、uid。
- `meta_info`：不随样本逐条变化或控制调用的元信息。

`union`（781）、`chunk`（864）、`reorder`（963）、`repeat`（971）等操作使 Trainer 能不断给同一批样本追加字段。V0 中完整 DataProto 常经过 driver；V1 主数据面改为 TransferQueue + `KVBatchMeta`，但 reward、advantage、metrics 等局部计算仍会重建 DataProto。

## TransferQueue：V1 的数据衔接

当前 V1 在启动时强制初始化 TransferQueue（独立 pip 包 `transfer_queue`），并按 trajectory key 组织数据：

- prompt 以 `uid` 为 key，带 `status`（pending/running/finished/failure）、`global_steps` 等 tag；
- 每条轨迹以 `{uid}_{session_id}_{index}` 为 key，AgentLoop 在一条 trajectory 完成生成及可选 reward/teacher 后一次写入该记录的 rollout 字段；
- Trainer 后续按需读取并追加 old/ref log-prob、value、advantage 等结果。

配置在 [`verl/trainer/config/transfer_queue/transfer_queue.yaml`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/trainer/config/transfer_queue/transfer_queue.yaml)（2026-07 新增）：存储后端默认 `SimpleStorage`（可选 `MooncakeStore`），可配 storage size、单元数、metrics 端口等。

其核心收益：

- 不同 trajectory 可独立完成，不必等整批 rollout 全部结束；
- 控制元数据（`KVBatchMeta`：partition + keys + tags）与分布式大张量存储分离，driver 只搬"句柄"；
- 为异步生成/训练、过滤和自定义 sampler 提供统一数据面；
- 减少所有完整 DataProto 都经单 controller 的瓶颈。

但它没有消灭 controller：算法顺序、资源和训练 step 仍由 PPOTrainer 控制。相关入口：[`verl/trainer/ppo/v1/agent_loop_tq.py`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/trainer/ppo/v1/agent_loop_tq.py)、[`verl/trainer/ppo/v1/replay_buffer.py`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/trainer/ppo/v1/replay_buffer.py)、[`docs/data/transfer_queue.md`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/docs/data/transfer_queue.md)。

这里的 ReplayBuffer 首先是"TransferQueue 轨迹选择器"，不是默认的长期经验回放。sync 模式等待足够的终态 prompt groups，选中后在本 step 训练并清理，保持 on-policy/bufferless 语义；异步模式才使用 `ReplayBufferAsync`，依据模型版本跨度执行 `drop` 或 `wait`（默认阈值 8、策略 drop，见 `ppo_trainer.yaml` 的 `trainer.v1.sampler`）。

## V0 与 V1 怎么回答

| 维度 | V0 | V1（当前默认） |
|---|---|---|
| Trainer | `RayPPOTrainer` | `PPOTrainerSync/ColocateAsync/SeparateAsync` |
| 主要数据组织 | driver 中的 `DataProto` | TransferQueue + replay buffer，内部仍会使用 TensorDict/DataProto |
| 优点 | 主循环线性直观，便于学习 | 更细粒度数据流，支持异步和降低中心搬运瓶颈 |
| 状态 | deprecated，入口注明 v0.9.0 移除（当前即 0.9.0.dev） | 默认路径，自 #6823（2026-06）起 `use_v1: true` |

最佳表达是："用 V0 理解经典 step，用 V1 描述当前架构"。
