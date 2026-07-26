---
title: "十分钟读懂 verl：架构、算法与训练主线"
description: "用一条完整数据流快速理解 verl 的核心价值、关键抽象，以及 PPO 与 GRPO 的差异。"
date: 2026-07-26
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

LLM 强化学习的一轮训练至少包含五种性质不同的工作：准备 prompt、批量生成回答、计算规则或模型奖励、计算旧策略/参考策略/价值、更新策略。生成偏推理系统，训练偏分布式优化器；它们的并行方式和显存形态完全不同。verl 的价值是把这条流水线写成清晰控制流，同时复用成熟训练与推理引擎。

最简数据流如下：

<div style="overflow-x: auto; margin: 1.5rem 0;">
  <img src="/images/verl-interview-guide/overview-flow.svg" alt="verl 最简训练数据流" style="display: block; min-width: 760px; width: 100%; height: auto;" loading="lazy" />
</div>

## 五个最重要的设计点

1. **HybridFlow / single-controller**：算法顺序在一个 driver 中表达，重计算由 worker group 执行。改算法主要改控制流或 loss，不必重写底层分布式通信。
2. **角色与实现解耦**：Actor、Rollout、Ref、Critic 是逻辑角色；FSDP/Megatron、vLLM/SGLang 是具体执行后端；ResourcePool 决定角色占哪批 GPU。
3. **Hybrid engine**：训练 actor 与推理 rollout 可以共用 GPU。生成阶段使用 KV cache 和推理权重，训练阶段释放/休眠推理资源并恢复训练状态，更新后再同步权重。
4. **算法组件化但有支持边界**：PPO、GRPO、RLOO、REINFORCE++ 等复用 estimator、policy loss、KL、采样和过滤组件；能在 registry 中找到函数，不代表当前 V1 已准备好它需要的全部字段，ReMax 就是反例。
5. **V1 数据解耦**：当前默认 V1 用 TransferQueue 按 trajectory key 组织数据，并提供 sync、共置异步、分离异步三种 trainer mode；V0 则主要让完整 `DataProto` 经过 driver。

## 面试中如何用 90 秒介绍

> verl 是一个面向 LLM RL 后训练的分布式框架，开源自 HybridFlow。它的核心不是发明 PPO，而是把算法控制流、模型计算和设备资源解耦。driver 描述 rollout、reward、advantage、actor/critic update；Ray WorkerGroup 把逻辑调用派发到多进程；训练后端可用 FSDP2 或 Megatron，生成后端可用 vLLM/SGLang。actor 与 rollout 可完全共置；`separate_async` 则在保留 hybrid replicas 的同时增加独立 rollout GPU/server。PPO 与 GRPO 共用一套骨架，主要差别是 advantage 和 critic：PPO/GAE 依赖 value model，GRPO 用同 prompt 多回答的组内相对奖励，通常不要 critic。当前默认 V1 又通过 TransferQueue 降低 driver 完整 batch 搬运，并支持同步和异步模式。

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

- `rollout_log_probs` 属于实际生成策略；`old_log_probs` 在 decoupled 模式由训练前 actor 重算，在 bypass 模式直接取 rollout 值；`ref_log_prob` 来自冻结参考策略。三者不要混淆。
- “actor 和 rollout 共置”不等于同时常驻所有状态。工程关键恰恰是训练状态、推理权重和 KV cache 的释放、reshard、同步与唤醒顺序。
- GRPO 不是一个完全独立的 Trainer。verl 通过相同主循环和 worker API，用 `adv_estimator=grpo`、`rollout.n`、是否启用 critic/KL 等配置得到它。

## 读代码的第一组入口

- 统一入口与 V0/V1 分流：[`verl/trainer/main_ppo.py:33-193`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/trainer/main_ppo.py#L33-L193)
- V1 基类初始化与主循环：[`verl/trainer/ppo/v1/trainer_base.py:120-630`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/trainer/ppo/v1/trainer_base.py#L120-L630)
- 默认 trainer：[`verl/trainer/ppo/v1/trainer_sync.py`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/trainer/ppo/v1/trainer_sync.py)
- V0 直观同步循环：[`verl/trainer/ppo/ray_trainer.py:1440-1665`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/trainer/ppo/ray_trainer.py#L1440-L1665)
- 核心算法：[`verl/trainer/ppo/core_algos.py`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/trainer/ppo/core_algos.py)
- 角色 worker：[`verl/workers/engine_workers.py`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/workers/engine_workers.py)
- Ray 资源与 worker group：[`verl/single_controller/ray/base.py`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/single_controller/ray/base.py)
