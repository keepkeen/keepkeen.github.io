---
title: "verl 源码导航与七天学习路线"
description: "提供核心目录地图、四遍源码阅读法、专题选择和七天学习计划。"
date: 2026-07-26
updatedDate: 2026-08-29
tags:
  - verl
  - source-code
  - learning-roadmap
lang: zh-CN
featured: false
draft: false
series: verl-interview-guide
seriesOrder: 12
---

## 目录地图

| 目录/文件 | 职责 |
|---|---|
| [`verl/trainer/main_ppo.py`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/trainer/main_ppo.py) | Hydra/Ray 入口，V0/V1 分流 |
| [`verl/trainer/config/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/verl/trainer/config) | 组件化配置树 |
| [`verl/trainer/ppo/v1/trainer_base.py`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/trainer/ppo/v1/trainer_base.py) | 当前默认 Trainer 公共初始化、step、validation、checkpoint |
| [`verl/trainer/ppo/v1/trainer_separate_async.py`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/trainer/ppo/v1/trainer_separate_async.py) | separate async mini-batch 流、old-policy 保存/恢复与 step-boundary 借卡 |
| [`verl/trainer/ppo/v1/agent_loop_tq.py`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/trainer/ppo/v1/agent_loop_tq.py) | prompt 提交及 trajectory 输出接入 TransferQueue |
| [`verl/trainer/ppo/v1/replay_buffer.py`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/trainer/ppo/v1/replay_buffer.py) | 按 group、状态和模型版本选择轨迹，返回 `KVBatchMeta`，并为借卡策略暴露 sampleable-depth 接口 |
| [`verl/trainer/ppo/ray_trainer.py`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/trainer/ppo/ray_trainer.py) | V0 经典同步主循环，适合学习依赖关系 |
| [`verl/trainer/ppo/core_algos.py`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/trainer/ppo/core_algos.py) | advantage、KL controller、policy loss |
| [`verl/protocol.py`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/protocol.py) | DataProto 与 Future |
| [`verl/single_controller/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/verl/single_controller) | Worker/WorkerGroup、Ray 资源和 dispatch |
| [`verl/workers/engine_workers.py`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/workers/engine_workers.py) | actor/ref/critic 的统一 worker 与生命周期 |
| [`verl/workers/engine/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/verl/workers/engine) | 训练 engine 实现/注册 |
| [`verl/workers/rollout/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/verl/workers/rollout) | 推理服务、client 和 rollout 后端 |
| [`verl/experimental/agent_loop/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/verl/experimental/agent_loop) | 多轮生成与工具循环 |
| `verl/utils/tokenizer/continuous_token*.py` | 文本/VL Continuous Token builder、模型族解析与增量 token merge |
| [`verl/experimental/reward_loop/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/verl/experimental/reward_loop) | reward 并发执行与管理 |
| [`verl/experimental/teacher_loop/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/verl/experimental/teacher_loop) | on-policy distillation 的 teacher 管理 |
| [`verl/experimental/fully_async_policy/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/verl/experimental/fully_async_policy) | 独立 fully-async 实验架构，不是 V1 trainer mode；CI 已迁到 v1 separate_async |
| [`verl/experimental/separation/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/verl/experimental/separation) | 分离部署共享库（DetachActorWorker 等，支撑 separate_async 的 decoupled PPO） |
| [`verl/checkpoint_engine/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/verl/checkpoint_engine) | actor→rollout 权重同步（naive/nccl/nixl/mooncake/kimi/delta_sharded） |
| [`verl/trainer/ppo/checkpoint_callback.py`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/trainer/ppo/checkpoint_callback.py) | V1 driver-side checkpoint 保存后扩展 hook |
| [`verl/trainer/config/transfer_queue/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/verl/trainer/config/transfer_queue) | TransferQueue 数据面配置（存储后端等） |
| [`verl/model_merger/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/verl/model_merger) | 将 FSDP/Megatron 训练 checkpoint 导出为 HF 模型并验证 |
| [`verl/utils/dataset/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/verl/utils/dataset) | RL/SFT 数据集与模板处理 |
| [`verl/workers/reward_manager/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/verl/workers/reward_manager) | legacy/可注册 reward manager |
| [`examples/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/examples) | 可运行的算法、后端、多模态和 LoRA 配置 |
| [`docs/perf/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/docs/perf) | 性能指标、profiling 与调优 |
| [`docs/advance/v1_async_trainer.md`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/docs/advance/v1_async_trainer.md) | V1 colocate/separate async、partial rollout、staleness 与借卡主文档 |
| [`docs/advance/fsdp_turbo_backend.rst`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/docs/advance/fsdp_turbo_backend.rst) | FSDP-Turbo 能力、配置计划与边界 |
| [`manage_envs.py`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/manage_envs.py) / [`pyproject.toml`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/pyproject.toml) / [`uv.lock`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/uv.lock) | 可复现的 uv backend extras 与环境切换 |

## 第一遍：只追主链，约 2 小时

1. [`README.md`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/README.md) 的定位与 feature。
2. [`verl/trainer/main_ppo.py`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/trainer/main_ppo.py) 的 `TaskRunnerV1`，看 V1 如何启动。
3. [`verl/trainer/ppo/v1/trainer_base.py`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/trainer/ppo/v1/trainer_base.py) 的 `init`、`fit`、`step` 与 `prepare_step`，看初始化组件和 hook 顺序。
4. 搜索 `PPOTrainer.fit` 和 `PPOTrainerSync`，画出 sample/train/sync 顺序。
5. 对照 `ray_trainer.py` 的 `RayPPOTrainer.fit` 看 V0 线性 step，再用 `trainer_separate_async.py` 比较 mini-batch 流与借卡。

目标：能不看文档画出 prompt → rollout → reward → advantage → update → sync。

读 V1 时牢记：`KVBatchMeta` 主要携带 partition、keys、tags 与调用元信息；大字段留在 TQ，Trainer 按 key 驱动后续阶段。它是理解 V1 与 V0 差异的关键对象。

## 第二遍：追分布式对象，约 2 小时

1. [`verl/trainer/ppo/utils.py`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/trainer/ppo/utils.py) 的 Role 和启用条件。
2. [`verl/single_controller/ray/base.py`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/single_controller/ray/base.py) 的 `RayResourcePool`。
3. 同文件 `RayWorkerGroup`，再看 base WorkerGroup 的动态方法绑定。
4. [`verl/workers/engine_workers.py`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/workers/engine_workers.py) 的 TrainingWorker 和 ActorRolloutRefWorker。

目标：能解释“一个 Trainer 调用如何变成多 rank 计算”，并区分 Ray 与模型并行后端。

## 第三遍：追一个 GRPO 样本，约 3 小时

1. 从 [`examples/grpo_trainer/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/examples/grpo_trainer) 选一个最简单脚本，整理 resolved 配置类别。
2. 看 `RLHFDataset` 返回的字段与 `uid`。
3. 看 rollout 返回的 response/attention mask。
4. 看 reward function → manager → token score。
5. 看 `core_algos.py` 的 GRPO estimator。
6. 看 actor policy loss 和 loss aggregation。

目标：能列出每个阶段新增的字段、shape、mask 和 producer/consumer。

## 第四遍：选一个工程专题

- 性能：[`docs/perf/perf_tuning.rst`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/docs/perf/perf_tuning.rst) + `metric_utils.py`。
- 多轮 Agent：[`docs/advance/agent_loop.rst`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/docs/advance/agent_loop.rst) + [`verl/experimental/agent_loop/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/verl/experimental/agent_loop)。
- 大模型：Megatron engine/config 与一个 Megatron example。
- 权重同步：`checkpoint_engine/README.md` + actor worker lifecycle。
- V1 异步：[`docs/advance/v1_async_trainer.md`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/docs/advance/v1_async_trainer.md) + 三个 trainer mode + replay buffer 的 span/staleness 与 step switching。
- 多模态 Agent：Continuous Token builder、processor placeholder、最终 multimodal tensor 重建。
- 环境与运维：uv extras/Ray `py_executable`、checkpoint callback、profiler finish hook。
- 进阶正确性：rollout correction、validation/checkpoint、determinism 或 distillation。

只选一个深入，面试中“一条链讲透”比每个目录都说半句更可信。

## 建议自己画的四张图

1. 组件层级图：Trainer → Role → WorkerGroup → Engine/Server。
2. 一次 PPO/GRPO step 的时序图。
3. colocate 显存状态转换图。
4. PPO、GRPO、RLOO、ReMax baseline 对照表。

画完后脱稿讲一遍，并回答“为什么这样设计、替代方案是什么”。

## 七天学习计划

| 天 | 任务 | 输出 |
|---|---|---|
| Day 1 | 读 00～03，追入口 | 手画端到端链路 |
| Day 2 | 读 04 和 core_algos | 算法对照表 |
| Day 3 | 读 05，追 WorkerGroup | 分布式层级图 |
| Day 4 | 按 13 章跑/精读一个 GRPO example | 配置解释、字段表和导出链路 |
| Day 5 | 读 06～08 | 场景方案和排障树 |
| Day 6 | 读 12，再选 Agent、Megatron、异步或性能专题深入 | 10 分钟项目分享 |
| Day 7 | 完整回答 10 章题库 + 14 章真题热点，并复盘薄弱点 | 模拟面试录音 |

若你有自己的 verl PR，Day 6 的专题应优先选 PR 所在链路（如 advantage 估计器/reward loop），把"通用框架理解"和"我改过哪一行"串成一条叙事。#7150/#7151 可直接用第 15 章作为这种练习的样例。

## 源码核查清单

- 当前默认 `trainer.use_v1` 和 trainer mode。
- rollout registry 的真实后端，不仅看文档文字。
- `need_critic`/`need_reference_policy` 的条件。
- estimator 与 policy loss registry。
- estimator 需要的前置字段是否在所选 V0/V1 路径真的产生，尤其 ReMax。
- decoupled/bypass 下 rollout/old/current log-prob 的来源。
- actor 更新后 rollout 权重版本何时切换。
- reward 和 response mask 的 shape/落点。
- example 使用的模型、后端和版本是否与当前环境一致。
- registry 是否在目标 device/model_type 上注册，而不只看目录名；尤其 `fsdp_turbo` 与 Ascend `megatron`。
- async dashboard 的指标名是否与目标 commit 的实际代码一致。

## 最后记住的主线

不要把 verl 记成大量 YAML 参数。把它记成三个问题：

1. **算法依赖**：这条轨迹接下来要计算什么？
2. **数据契约**：需要哪些字段、mask 和版本，谁生产谁消费？
3. **资源执行**：这些计算在哪些 GPU、用什么后端、何时切换或重叠？

所有类、配置和性能问题都能回到这三条主线。
