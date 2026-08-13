---
title: "verl 源码导航与七天学习路线"
description: "提供核心目录地图、四遍源码阅读法、专题选择和七天学习计划。"
date: 2026-07-26
updatedDate: 2026-08-14
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
| `verl/trainer/main_ppo.py` | Hydra/Ray 入口，V0/V1 分流 |
| `verl/trainer/config/` | 组件化配置树 |
| `verl/trainer/ppo/v1/trainer_base.py` | 当前默认 Trainer 公共初始化、step、validation、checkpoint |
| `verl/trainer/ppo/v1/agent_loop_tq.py` | prompt 提交及 trajectory 输出接入 TransferQueue |
| `verl/trainer/ppo/v1/replay_buffer.py` | 按 group、状态和模型版本选择轨迹，返回 `KVBatchMeta` |
| `verl/trainer/ppo/ray_trainer.py` | V0 经典同步主循环，适合学习依赖关系（deprecated） |
| `verl/trainer/ppo/core_algos.py` | advantage、KL controller、policy loss |
| `verl/protocol.py` | DataProto 与 Future |
| `verl/single_controller/` | Worker/WorkerGroup、Ray 资源和 dispatch |
| `verl/workers/engine_workers.py` | actor/ref/critic 的统一 worker 与生命周期 |
| `verl/workers/engine/` | 训练 engine 实现/注册 |
| `verl/workers/rollout/` | 推理服务、client 和 rollout 后端 |
| `verl/experimental/agent_loop/` | 多轮生成与工具循环 |
| `verl/experimental/reward_loop/` | reward 并发执行与管理 |
| `verl/experimental/teacher_loop/` | on-policy distillation 的 teacher 管理 |
| `verl/experimental/fully_async_policy/` | 独立 fully-async 实验架构，不是 V1 trainer mode；CI 已迁到 v1 separate_async |
| `verl/experimental/separation/` | 分离部署共享库（DetachActorWorker 等，支撑 separate_async 的 decoupled PPO） |
| `verl/checkpoint_engine/` | actor→rollout 权重同步（naive/nccl/nixl/mooncake/kimi/delta_sharded） |
| `verl/trainer/config/transfer_queue/` | TransferQueue 数据面配置（存储后端等） |
| `verl/model_merger/` | 将 FSDP/Megatron 训练 checkpoint 导出为 HF 模型并验证 |
| `verl/utils/dataset/` | RL/SFT 数据集与模板处理 |
| `verl/workers/reward_manager/` | legacy/可注册 reward manager |
| `examples/` | 可运行的算法、后端、多模态和 LoRA 配置 |
| `docs/perf/` | 性能指标、profiling 与调优 |

## 第一遍：只追主链，约 2 小时

1. `README.md` 的定位与 feature。
2. [`verl/trainer/main_ppo.py:103-193`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/trainer/main_ppo.py#L103-L193)，看 V1 如何启动。
3. [`verl/trainer/ppo/v1/trainer_base.py`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/trainer/ppo/v1/trainer_base.py) 的 `init`（217-369）与组件初始化。
4. 搜索 `PPOTrainer.fit` 和 `PPOTrainerSync`，画出 sample/train/sync 顺序。
5. 对照 `ray_trainer.py` 看 V0 线性 step。

目标：能不看文档画出 prompt → rollout → reward → advantage → update → sync。

读 V1 时牢记：`KVBatchMeta` 主要携带 partition、keys、tags 与调用元信息；大字段留在 TQ，Trainer 按 key 驱动后续阶段。它是理解 V1 与 V0 差异的关键对象。

## 第二遍：追分布式对象，约 2 小时

1. `verl/trainer/ppo/utils.py` 的 Role 和启用条件（`need_critic`/`need_reference_policy`）。
2. [`verl/single_controller/ray/base.py`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/single_controller/ray/base.py) 的 ResourcePool。
3. 同文件 `RayWorkerGroup`，再看 base WorkerGroup 的动态方法绑定。
4. `verl/workers/engine_workers.py` 的 TrainingWorker 和 ActorRolloutRefWorker。

目标：能解释"一个 Trainer 调用如何变成多 rank 计算"，并区分 Ray 与模型并行后端。

## 第三遍：追一个 GRPO 样本，约 3 小时

1. 从 `examples/grpo_trainer/` 选一个最简单脚本，整理 resolved 配置类别。
2. 看 `RLHFDataset` 返回的字段与 `uid`。
3. 看 rollout 返回的 response/attention mask。
4. 看 reward function → manager → token score。
5. 看 `core_algos.py` 的 GRPO estimator。
6. 看 actor policy loss 和 loss aggregation。

目标：能列出每个阶段新增的字段、shape、mask 和 producer/consumer。

## 第四遍：选一个工程专题

- 性能：`docs/perf/perf_tuning.rst` + `metric_utils.py`。
- 多轮 Agent：`docs/advance/agent_loop.rst` + `experimental/agent_loop/`。
- 大模型：Megatron engine/config 与一个 Megatron example。
- 权重同步：`checkpoint_engine/README.md` + actor worker lifecycle。
- V1 异步：三个 trainer mode + replay buffer 的 model version 逻辑。
- 进阶正确性：rollout correction、validation/checkpoint、determinism 或 distillation。

只选一个深入，面试中"一条链讲透"比每个目录都说半句更可信。

## 建议自己画的四张图

1. 组件层级图：Trainer → Role → WorkerGroup → Engine/Server。
2. 一次 PPO/GRPO step 的时序图。
3. colocate 显存状态转换图。
4. PPO、GRPO、RLOO、ReMax baseline 对照表。

画完后脱稿讲一遍，并回答"为什么这样设计、替代方案是什么"。

## 七天学习计划

| 天 | 任务 | 输出 |
|---|---|---|
| Day 1 | 读速览到训练链路四篇，追入口 | 手画端到端链路 |
| Day 2 | 读算法篇和 core_algos | 算法对照表 |
| Day 3 | 读分布式篇，追 WorkerGroup | 分布式层级图 |
| Day 4 | 按模型导出篇跑/精读一个 GRPO example | 配置解释、字段表和导出链路 |
| Day 5 | 读数据奖励、配置实战、性能排障三篇 | 场景方案和排障树 |
| Day 6 | 读版本边界篇，再选 Agent、Megatron、异步或性能专题深入 | 10 分钟项目分享 |
| Day 7 | 完整回答题库篇 + 真题热点篇，并复盘薄弱点 | 模拟面试录音 |

若你有自己的 verl PR，Day 6 的专题应优先选 PR 所在链路（如 advantage 估计器/reward loop），把"通用框架理解"和"我改过哪一行"串成一条叙事（参考本系列 [PR 拆解篇](/blog/verl-guide-pr-deep-dive/)）。

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

## 最后记住的主线

不要把 verl 记成大量 YAML 参数。把它记成三个问题：

1. **算法依赖**：这条轨迹接下来要计算什么？
2. **数据契约**：需要哪些字段、mask 和版本，谁生产谁消费？
3. **资源执行**：这些计算在哪些 GPU、用什么后端、何时切换或重叠？

所有类、配置和性能问题都能回到这三条主线。
