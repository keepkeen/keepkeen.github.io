---
title: "如何扩展 verl：算法、Reward、模型与后端"
description: "梳理新增 estimator、reward、模型、rollout、AgentLoop、训练后端与自定义 sampler 的扩展入口。"
date: 2026-07-26
updatedDate: 2026-08-14
tags:
  - verl
  - development
  - architecture
lang: zh-CN
featured: false
draft: false
series: verl-interview-guide
seriesOrder: 10
---

## 新算法

先判断变化属于哪层：

- 新 advantage：在 `core_algos.py` 注册 estimator，明确输入字段、mask、是否需要 critic。
- 新 policy objective：注册 loss mode，复用 actor worker 的 log-prob/mini-batch 逻辑。
- 新采样/过滤：扩展 V1 replay buffer/sampler 或 Trainer hook。
- 新阶段/新模型角色：才需要改 Trainer 控制流和 Role/ResourcePool。

最小改动原则是保留现有 worker API。算法单元测试至少覆盖 mask、长度 0/1、组大小、极端 reward 和数值稳定性。

## 新 reward

最轻量方式是配置动态导入自定义函数；需要并发、组合或状态时实现 RewardManager/RewardLoop。接口要明确输入字段、输出范围、失败策略和 component metrics。

测试建议：手工金样本、解析异常、超时、恶意输出、超长和 batch 并发；确认 reward 落在最后有效 token 或预期 token 上。

参考 [`docs/preparation/reward_function.rst`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/docs/preparation/reward_function.rst)。

## 新模型

分三层验证：

1. tokenizer/processor、chat template、forward 输出符合 actor/value 所需接口。
2. 训练后端能构造、分片、保存和恢复模型。
3. 训练权重能正确映射到 rollout 后端，并在更新后生成一致结果。

FSDP/HF 接入通常简单；Megatron 需要模型结构和权重转换。先做固定输入下单卡 HF、训练 worker、rollout server 的 logits/生成对照，再上分布式。相关指南在 [`docs/advance/fsdp_extension.rst`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/docs/advance/fsdp_extension.rst)、[`docs/advance/megatron_extension.rst`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/docs/advance/megatron_extension.rst)。

## 新 rollout 后端

接入不只是写一个 `generate`：需要处理 `BaseRollout`/`ServerAdapter` 的生成与 sleep/wake/权重生命周期，在主 `_ROLLOUT_REGISTRY` 显式登记当前 async adapter，并通过 `RolloutReplicaRegistry`/LLM server client 管理副本和路由。还要实现生成参数转换、token 结果、权重更新、TP/DP 与多模态能力。当前主 registry 是硬编码映射，不是任意 decorator 插件。

正确性测试比"能返回文本"更严格：

- 给定权重和 seed 的 token/log-prob 对齐；
- EOS/stop/截断语义；
- 更新权重后版本原子切换；
- 多请求并发与取消；
- 多轮真实 token 不丢失。

## 新工具或 AgentLoop

无状态函数适合简单 API；stateful tool 适合持有会话/环境。定义 schema、超时、并发、重试、响应截断和清理。AgentLoop 输出必须包含训练所需 token 与 mask，并把环境错误作为可观测字段而非悄悄变成零分。

## 新训练后端

通过 EngineRegistry 和 TrainingWorker 的统一 API 接入：在 `verl/workers/engine/<your_backend>/` 下实现 `BaseEngine` 子类并用 `@EngineRegistry.register(model_type=..., backend=...)` 注册，把 `engine_config.strategy` 指向新名字即可被 worker 层拾取（worker 层已引擎无关）。需要实现：模型初始化、推理 batch、训练 mini-batch、optimizer、checkpoint、参数导出/同步。最难部分通常不是 forward/backward，而是：

- 与 WorkerGroup rank/world size 对齐；
- 动态 batch 和 mask；
- checkpoint state；
- actor→rollout 权重格式；
- offload/reshard 生命周期；
- profiling/metrics。

## 自定义 V1 sampler 与 AgentLoopManager

`trainer.v1.sampler.custom_sampler.{path,name}` 可加载 ReplayBuffer 子类。sampler 决定哪些 ready trajectory 组成训练 batch、哪些被消费/丢弃，因而会改变数据分布和 on/off-policy 程度。必须记录选择率、版本分布和失败组，避免吞吐优化悄悄改变算法。

整个 rollout 编排层也可替换：`actor_rollout_ref.rollout.agent.agent_loop_manager_class` 指定自定义 AgentLoopManager（[`main_ppo.py:112-132`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/trainer/main_ppo.py#L112-L132)），唯一契约是实现 `generate_sequences` 并把输出写入 TransferQueue。这是接入自研 Agent 框架/环境集群的官方扩展点。

## 设计评审问题清单

- 变化属于控制流、数据流还是模型计算？
- 是否能通过已有 registry/config 完成？
- 需要哪些新字段，谁生产、谁消费、何时 ready？
- 多 rank 的 dispatch/collect 语义是什么？
- 共置和分离都能工作吗？
- checkpoint/resume 后状态是否一致？
- 如何验证 token/log-prob/权重版本正确？
- 有哪些新增 stage metrics 和失败计数？
- 是否改变公开 API、依赖或 recipe 兼容性？

能回答这些问题，才算真正理解一个分布式 RL 框架扩展。
