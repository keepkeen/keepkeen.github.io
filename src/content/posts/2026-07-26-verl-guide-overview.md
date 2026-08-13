---
title: "十分钟读懂 verl：架构、算法与训练主线"
description: "用一条完整数据流快速理解 verl 的核心价值、关键抽象，以及 PPO 与 GRPO 的差异。"
date: 2026-07-26
updatedDate: 2026-08-14
tags:
  - verl
  - llm-rl
  - overview
lang: zh-CN
featured: true
draft: false
series: verl-interview-guide
seriesOrder: 1
---

## verl 解决的不是单个 loss，而是一条异构流水线

LLM 强化学习的一轮训练至少包含五种性质不同的工作：准备 prompt、批量生成回答、计算规则或模型奖励、计算旧策略/参考策略/价值、更新策略。生成偏推理系统（KV cache、continuous batching），训练偏分布式优化器（参数分片、梯度同步）；它们的并行方式和显存形态完全不同。verl 的价值是把这条流水线写成清晰控制流，同时复用成熟训练与推理引擎。

最简数据流如下：

<div class="wide-media">
  <img class="wide-media-image" src="/images/verl-interview-guide/overview-flow.svg" alt="verl 最简训练数据流" loading="lazy" />
</div>

## 五个最重要的设计点

1. **HybridFlow / single-controller**：算法顺序在一个 driver 中表达（"先 rollout、再算 reward、再更新"），重计算由 worker group 以 SPMD 方式执行。改算法主要改控制流或 loss，不必重写底层分布式通信。这是 HybridFlow 论文（EuroSys 2025）的核心贡献：单控制器的灵活性 + 多控制器的效率。
2. **角色与实现解耦**：Actor、Rollout、Ref、Critic 是逻辑角色；FSDP/FSDP2/Megatron 与 vLLM/SGLang/TRT-LLM 是具体执行后端；ResourcePool 决定角色占哪批 GPU。换后端不改算法代码。
3. **Hybrid engine（训推共卡）**：训练 actor 与推理 rollout 可以共用 GPU。生成阶段使用 KV cache 和推理布局权重，训练阶段释放/休眠推理资源并恢复训练状态，更新后再把新权重同步给推理引擎。共卡省资源，但换来一套严格的显存状态机（sleep/wake/offload/reshard）。
4. **算法组件化但有支持边界**：PPO、GRPO、RLOO、REINFORCE++ 等复用 advantage estimator、policy loss、KL、采样和过滤组件；能在 registry 中找到函数，不代表当前 V1 已准备好它需要的全部字段，ReMax 就是反例。
5. **V1 数据解耦**：当前默认 V1 用 TransferQueue 按 trajectory key 组织数据（TaskRunnerV1 强制开启），并提供 sync、colocate_async、separate_async 三种 trainer mode；V0 则让完整 `DataProto` 经过 driver，已被弃用。

## 面试中如何用 90 秒介绍

> verl 是字节 Seed 与港大开源的 LLM RL 后训练框架，论文是 EuroSys 2025 的 HybridFlow。它的核心不是发明 PPO，而是把算法控制流、模型计算和设备资源解耦。driver 描述 rollout、reward、advantage、actor/critic update；Ray WorkerGroup 把逻辑调用派发到多进程；训练后端可用 FSDP2 或 Megatron，生成后端可用 vLLM/SGLang。actor 与 rollout 可完全共置（hybrid engine），也可以在 separate_async 下增加独立 rollout GPU 并按频率同步参数。PPO 与 GRPO 共用一套骨架，主要差别是 advantage 和 critic：PPO/GAE 依赖 value model，GRPO 用同 prompt 多回答的组内相对奖励，通常不要 critic。当前默认 V1 通过 TransferQueue 降低 driver 完整 batch 搬运，支持同步和异步模式，并内置 rollout correction（decoupled/bypass + IS/RS）处理训推不一致和异步陈旧问题。

## PPO 与 GRPO 的最小对照

| 维度 | PPO + GAE | GRPO |
|---|---|---|
| baseline | critic 给出的 value | 同 prompt 多回答的组内均值 |
| critic | 通常需要 | 通常不需要 |
| rollout 数 | 可为 1 | 通常 `n > 1` |
| advantage 粒度 | token 时序递推 | outcome 标量后广播到 response token |
| 资源代价 | 多一套 value model 与优化器 | 多生成回答，rollout 成本更高 |
| 适合 | 通用过程奖励/长时序 credit assignment | 数学、代码等可验证 outcome reward |

## 三个容易答错的点

- `rollout_log_probs` 属于实际生成策略；`old_log_probs` 在 decoupled 模式由训练前 actor 重算，在 bypass 模式直接取 rollout 值；`ref_log_prob` 来自冻结参考策略。三者不要混淆。异步或训推数值不一致时，这三个分布可以同时不相等——这正是 2025 年起"训推不一致 + rollout correction"成为面试热点的原因（详见本系列真题热点篇）。
- "actor 和 rollout 共置"不等于同时常驻所有状态。工程关键恰恰是训练状态、推理权重和 KV cache 的释放、reshard、同步与唤醒顺序。
- GRPO 不是一个完全独立的 Trainer。verl 通过相同主循环和 worker API，用 `algorithm.adv_estimator=grpo`、`rollout.n`、是否启用 critic/KL 等配置组合得到它。

## 读代码的第一组入口

- 统一入口与 V0/V1 分流：[`verl/trainer/main_ppo.py:167-197`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/trainer/main_ppo.py#L167-L197)（`use_v1` 分支在 184 行）
- V1 TaskRunner（强制开 TransferQueue、选 trainer mode）：[`verl/trainer/main_ppo.py:103-164`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/trainer/main_ppo.py#L103-L164)
- V1 基类初始化与主循环：[`verl/trainer/ppo/v1/trainer_base.py`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/trainer/ppo/v1/trainer_base.py)（`init` 见 217-369，`fit` 见 387-507，单步 `_step_once` 见 536-586）
- 默认 trainer：[`verl/trainer/ppo/v1/trainer_sync.py`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/trainer/ppo/v1/trainer_sync.py)
- V0 直观同步循环（deprecated）：[`verl/trainer/ppo/ray_trainer.py`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/trainer/ppo/ray_trainer.py)
- 核心算法：[`verl/trainer/ppo/core_algos.py`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/trainer/ppo/core_algos.py)（estimator 枚举在 88-110）
- 角色 worker：[`verl/workers/engine_workers.py`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/workers/engine_workers.py)（TrainingWorker 76-443，ActorRolloutRefWorker 446-817）
- Ray 资源与 worker group：[`verl/single_controller/ray/base.py`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/single_controller/ray/base.py)
