---
title: "verl 必备背景：RLHF、PPO 与推理训练协同"
description: "从策略、奖励和优势函数出发，解释 PPO、GAE、GRPO、KL 与生成训练协同。"
date: 2026-07-26
tags:
  - verl
  - llm-rl
  - ppo
  - rlhf
lang: zh-CN
featured: false
draft: false
series: verl-interview-guide
seriesOrder: 2
---

## 从预训练到 RL 后训练

预训练学习“下一个 token 的统计规律”；SFT 用高质量示范让模型学会按指令回答；RL 阶段让模型针对不能直接写成监督标签的目标优化，例如答案正确性、偏好、安全、工具使用成功率。实际项目常是：预训练模型 → SFT/指令模型 → 奖励设计 → RL → 评测与回归。

SFT 与 RL 都计算生成 token 的 log-prob，但梯度信号不同：

- SFT 对示范中的 assistant token 做 masked negative log-likelihood。
- RL 对模型自己采样的 response token 做 advantage-weighted policy gradient。
- SFT 是常见的 RL 起点，但在 verl 代码中是独立 trainer，不是 PPO/GRPO 必经步骤。

统一地看，两者都在有效生成 token 上优化 log-prob：SFT 的权重主要来自示范 `loss_mask`；PPO 类 RL 的权重还包含 advantage、old/current ratio、clip，以及可选 importance sampling 或 KL 项。

## 策略、轨迹、奖励和优势

- 策略 $\pi_\theta$：给定已有 token，预测下一个 token 的分布。
- 轨迹：prompt 与模型生成的 response token 序列。
- reward：对回答质量的评分，可是最终 outcome，也可是逐步 process reward。
- return：从某个 token 往后的累计折扣奖励。
- value $V(s_t)$：critic 对状态未来 return 的估计。
- advantage $A_t$：这次动作比 baseline 好多少。它降低 policy-gradient 方差，并决定增大还是减小该 token 概率。

## PPO 为什么保存旧策略概率

策略梯度想提高高优势动作的概率，但一次更新过猛会让策略崩坏。PPO 使用新旧策略概率比：

$$
r_t(\theta)=\exp(\log\pi_\theta(a_t|s_t)-\log\pi_{old}(a_t|s_t))
$$

并优化裁剪目标：

$$
L=\mathbb{E}[\min(r_tA_t,\operatorname{clip}(r_t,1-\epsilon,1+\epsilon)A_t)]
$$

因此需要区分：

- `rollout_log_probs`：真实生成这条轨迹的 rollout policy 概率。
- `old_log_probs`：PPO ratio 的固定分母；V1 decoupled 模式在训练该 batch 前由 actor 重算，bypass 模式才直接使用 `rollout_log_probs`。
- 当前 actor 的 log-prob：带梯度，真正被优化。
- `ref_log_prob`：冻结参考模型，用来限制 actor 偏离起点。

同步且每 step 更新权重时，rollout 与 old 可能很接近；异步时可能同时存在 rollout policy、训练前固定的 old anchor、mini-batch 更新中的 current actor 三个版本。这个差异是 rollout correction 和 staleness 控制的起点。

代码入口：[`verl/trainer/ppo/core_algos.py`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/trainer/ppo/core_algos.py) 中的 policy loss registry 和 vanilla PPO loss；[`verl/workers/utils/losses.py`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/workers/utils/losses.py) 中的聚合与基础 loss。

## GAE：PPO 常见的 advantage

GAE 使用 TD 残差：

$$
\delta_t=r_t+\gamma V(s_{t+1})-V(s_t)
$$

再反向递推：

$$
A_t=\delta_t+\gamma\lambda A_{t+1}
$$

`lambda` 在偏差与方差之间折中。因为需要 $V$，GAE 通常启用 critic。verl 先用未白化的 GAE 得到 `returns = raw_advantages + values`，再只对白化后的 advantage 供 actor 使用；critic target 不使用白化 advantage。多轮中只在有效 action token 更新 TD/λ 状态，内部 observation/tool token 会跳过 TD 更新但保留跨越该位置的递推状态，mask 为 0 的位置不进入 whitening 或 loss。实现见 [`verl/trainer/ppo/core_algos.py:215-263`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/trainer/ppo/core_algos.py#L215-L263)。

## GRPO：用同题多答案代替 value baseline

对每个 prompt 生成多条回答，获得 outcome reward $R_i$，组内计算：

$$
A_i=\frac{R_i-\mu_g}{\sigma_g+\epsilon}
$$

然后把每条回答的标量 advantage 广播到它的有效 response token。关闭标准差归一后只做中心化，接近 Dr.GRPO 的做法。组依据 `uid`，不是仅靠 batch 中相邻位置猜测。实现见 [`verl/trainer/ppo/core_algos.py:267-329`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/trainer/ppo/core_algos.py#L267-L329)。

GRPO 省掉 critic，但并非免费：同 prompt 多采样会增加 rollout 成本，而且组内奖励没有差异时梯度接近零，这也是 DAPO 动态过滤全对/全错组的动机之一。

## KL 约束的两种放置

verl 支持两条不同路径：

1. reward-side：`token_reward = token_score - beta * k(old_log_prob, ref_log_prob)`，再计算 advantage；`k` 是配置选择的逐 token KL 估计量，并非默认显式计算完整词表 KL。
2. loss-side：actor loss 对 current log-prob 与 ref log-prob 的估计 KL 加权。

它们作用位置和梯度路径不同。任一开启通常都需要 reference policy；若无意识地同时开，可能重复约束。`kl/k1`、`abs`、`mse/k2`、`low_var_kl/k3` 是不同估计形式，当前 `full` 分支尚未实现。启用条件见 [`verl/trainer/ppo/utils.py:75-80`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/trainer/ppo/utils.py#L75-L80)，KL 实现见 [`verl/trainer/ppo/core_algos.py`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/trainer/ppo/core_algos.py)。

## 为什么生成与训练难以协同

训练需要参数、梯度、优化器状态和 activation；推理需要适合 tensor parallel 的权重布局、KV cache 和 CUDA graph。RL 又要求每轮训练后 rollout 看到足够新的 actor 权重。因此系统必须解决：

- 权重从训练分片到推理布局的转换与同步；
- 共置时训练/推理显存的互斥使用；
- 分离时跨节点传输成本；
- 异步时样本陈旧度和 on-policy 假设；
- 变长序列造成的负载不均衡。

这正是 verl 相比“写一个 PPO loss”更重要的工程部分。
