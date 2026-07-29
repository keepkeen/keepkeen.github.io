---
title: "一次 verl 训练如何跑起来"
description: "沿 prompt、rollout、reward、advantage、参数更新和权重同步追踪端到端训练链路。"
date: 2026-07-26
tags:
  - verl
  - llm-rl
  - training-pipeline
lang: zh-CN
featured: false
draft: false
series: verl-interview-guide
seriesOrder: 4
---

## 启动阶段

1. `python -m verl.trainer.main_ppo ...` 启动 Hydra。
2. Hydra 将根 YAML、组件 YAML 和命令行 override 合成一个配置树。
3. `validate_config` 检查 batch、并行度、critic/ref 是否需要等约束。
4. `ray.init` 将环境变量、依赖和 profiling 设置传播到 actors。
5. 远程 `TaskRunnerV1.run` 初始化 TransferQueue，按 `trainer.v1.trainer_mode` 选择 Trainer。
6. Trainer 初始化 tokenizer/dataset/dataloader、ResourcePool、WorkerGroup、LLM server、checkpoint engine 和 RewardLoop。
7. `AgentLoopManagerTQ` 接入 rollout client、teacher client 和 reward handles。

入口证据：[`verl/trainer/main_ppo.py:34-94,103-164,167-193`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/trainer/main_ppo.py#L34-L193)；组件初始化列表见 [`verl/trainer/ppo/v1/trainer_base.py:217-225`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/trainer/ppo/v1/trainer_base.py#L217-L225)。

当前默认同步链更精确地说是：初始化 TQ → `PPOTrainerSync.init` 创建 WorkerGroup、LLM server、RewardLoop 与 CheckpointEngine → `AgentLoopManagerTQ.create` → `fit` → 注册并异步提交 prompt → `ReplayBuffer.sample` 等待足够终态 groups并返回轻量 `KVBatchMeta` → Trainer 按 partition/key 驱动 old/ref/value/advantage/critic/actor → step 结束同步新权重。Trainer 的核心控制对象不是一份始终常驻 driver 的完整训练 batch。

## 初始化顺序为什么重要

actor、critic 等训练 worker 先占据资源并建立进程组；rollout server 通常后初始化，这样 vLLM/SGLang 在决定 KV cache 容量时能看到更准确的可用显存。共置场景还必须明确谁在何时 offload/reshard，不能让训练 optimizer state 与推理 KV cache 无控制地同时占满显存。

## 同步训练 step 的概念链路

无论 V0/V1，核心依赖关系相同：

<div class="wide-media">
  <img class="wide-media-image" src="/images/verl-interview-guide/training-sequence.svg" alt="verl 同步训练 step 时序" loading="lazy" />
</div>

V0 的线性参考实现位于 [`verl/trainer/ppo/ray_trainer.py:1440-1665`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/trainer/ppo/ray_trainer.py#L1440-L1665)。V1 将生产/消费拆入 TransferQueue 和 replay buffer。多数基础 estimator 复用相同数学函数，但 V1 的轨迹整理、支持边界和 estimator 前置数据并不完全等价于 V0。

## 1. prompt 与 uid

`RLHFDataset` 从 Parquet 或 Hugging Face Dataset 读取数据，并用与 rollout 对齐的模板/tokenizer 做长度检查；实际取样主要返回 raw messages 与 reward/tool metadata，最终 chat template 与 token 构造在 AgentLoop 侧完成。Trainer 给每个原始 prompt 一个 `uid`。

当 `rollout.n > 1` 时，V1 在同一 prompt `uid` 下启动多个 session，trajectory key 形如 `{uid}_{session_id}_{index}`。GRPO/RLOO 仍按 `uid` 聚合候选；若丢失关联，优势估计会把不同题目的回答混组。

代码入口：[`verl/utils/dataset/rl_dataset.py:72-85,197-275,386-411`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/utils/dataset/rl_dataset.py#L72-L411)。

## 2. rollout 与多轮 AgentLoop

LLMServerManager 管理 vLLM/SGLang 等服务副本；AgentLoopWorker 接收 prompt，调用 server client，累积 response ids、逐轮 token、mask 和工具结果。单轮任务也是一个最简单的 agent loop。

多轮时不能最后把 messages 重新套一遍 chat template 代替真实 rollout token，因为模板、空格或特殊 token 的差异会使训练时 log-prob 对应的 token 序列不同于采样策略，破坏 on-policy 一致性。

## 3. reward

reward 可来自：

- 规则函数：数学答案匹配、代码单测、格式检查、工具任务是否完成。
- reward model：另一个模型对回答评分。
- 多种 score 的组合与 shaping，例如超长惩罚。

RewardManager 最终把结果整理为 token-shaped score。纯 outcome reward 常写在最后一个有效 response token。GAE、ReMax、REINFORCE++ 通过时间递推或 reward-to-go 传播；GRPO/RLOO 则先汇总序列 reward，再把组相对标量广播到有效 action token，它们不提供细粒度 temporal credit assignment。RewardLoop 可以和 rollout 流式衔接。

## 4. log-prob 与 value

- rollout log-prob：真实生成轨迹的策略概率。
- actor old log-prob：固定 PPO 更新的分母；decoupled 模式在训练该 batch 前重算，bypass 模式直接使用 rollout 值，当前 `separate_async` 强制 bypass。
- reference log-prob：仅在 KL 约束需要时计算。
- values：仅在 GAE/critic 路径需要。

计算前经常按有效序列长度重新平衡 batch，避免某些 data-parallel rank 被长回答拖慢。

## 5. reward shaping 与 advantage

若使用 reward-side KL，先从 token score 中扣除 KL penalty。随后根据 `algorithm.adv_estimator` 进入 estimator。response mask 决定哪些 token 有效；padding 和 EOS 后内容不能进入统计。V1 对多轨迹 GRPO 还有额外语义：只用每个 `{uid, session_id}` 的最终输出做组相对计算，再把标量广播到该 session 的其他输出；非 GRPO estimator 走普通公共路径，不能据此类推。

特别注意 ReMax：公共 estimator 强制需要 `reward_baselines`，完整 greedy-baseline rollout 与字段写入目前只见 V0 `RayPPOTrainer`；默认 V1 `_compute_advantage` 没有准备该字段，因此不能只设置 `algorithm.adv_estimator=remax`。使用前必须核查 recipe 是否切到 `trainer.use_v1=false`，或目标版本的 V1 是否已补齐 baseline 数据链路。

## 6. critic 与 actor 更新

GAE 时先用 returns 更新 critic，再用 advantage 更新 actor。actor 内部按 mini-batch/micro-batch 或 token budget 切分，重新前向得到 current log-prob，计算 ratio、clipped objective、entropy/KL 等，再反向和 optimizer step。

“先 critic 还是先 actor”不是核心算法定义，但会影响显存切换和实现。面试时应强调依赖是 advantage 已确定；critic 与 actor 是不同优化目标。

## 7. 权重同步与下一轮

actor 更新后，rollout 必须看到新版本权重。V1 统一由 `CheckpointEngineManager` 协调：共置基础 manager 当前强制 naive backend，并配合 replica sleep/wake；`separate_async` 另建面向 standalone rollout 的 manager，要求 NCCL/NIXL/Mooncake 等非-naive backend。典型生命周期是休眠/释放 rollout → actor 训练 → 恢复 rollout weights → 同步 → actor 参数可 offload → 恢复 KV cache。

异步模式不必每 step 全部等待，但需要模型版本号、同步频率、replay buffer 和 off-policy threshold 共同控制陈旧度。

## 三类 mask

| mask | 作用 |
|---|---|
| `attention_mask` | prompt + response 中哪些 token 真实存在 |
| `response_mask` | response 尾段中哪些 token 参与 RL reward/advantage/loss |
| SFT `loss_mask` | 哪些 assistant token 参与监督损失 |

工具返回、环境 observation 等 token 可以存在于上下文并影响后续生成，但通常应在 response loss mask 中排除，避免模型被训练去“预测环境”。

## 如何调试一条样本

对同一 `uid` 打印或落盘以下字段：prompt ids/text、response ids/text、attention/response mask、reward components、old/ref log-prob、value、advantage、model version。先核对 token 与 mask，再看数学指标；很多“算法不收敛”实际是模板、截断、reward 落点或分组问题。
