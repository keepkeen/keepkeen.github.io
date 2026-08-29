---
title: "从 Monte Carlo、TD 到 Q-learning"
description: "系统理解 bootstrap、TD error、SARSA、Q-learning、探索与价值学习，再连接到 LLM 的 critic 和 advantage。"
date: 2026-08-13
updatedDate: 2026-08-29
tags:
  - reinforcement-learning
  - llm
  - interview
lang: zh-CN
draft: false
series: llm-reinforcement-learning-interview
seriesOrder: 3
---
LLM 后训练主流是策略梯度，但价值学习仍是必修：PPO 的 critic 在做 value estimation，GAE 由 TD residual 组成，on/off-policy、replay buffer 与 DQN 也会在 RL/Infra 岗出现。

## 1. 一张表先定位

| 方法 | 需要环境模型 $P,R$ | 更新目标 | 是否等 episode 结束 | 典型用途 |
|---|---:|---|---:|---|
| Dynamic Programming | 是 | 完整 Bellman 期望 | 否 | 小型已知 MDP、理论 |
| Monte Carlo | 否 | 实际 return $G_t$ | 是 | 无偏回报估计、REINFORCE |
| TD(0) | 否 | $r_t+\gamma V(s_{t+1})$ | 否 | critic、在线估值 |
| SARSA | 否 | $r+\gamma Q(s',a')$ | 否 | on-policy 控制 |
| Q-learning | 否 | $r+\gamma\max_{a'}Q(s',a')$ | 否 | off-policy 控制 |

## 2. 动态规划：知道模型时怎么解

### 2.1 Iterative policy evaluation

固定策略 $\pi$，反复做 Bellman expectation backup：

$$
V_{k+1}(s)=\sum_a\pi(a\mid s)
\sum_{s'}P(s'\mid s,a)
\left[R(s,a,s')+\gamma V_k(s')\right].
$$

当变化足够小，得到 $V^\pi$。

### 2.2 Policy improvement

根据当前价值贪心改进：

$$
\pi_{new}(s)=\arg\max_a
\sum_{s'}P(s'\mid s,a)
\left[R(s,a,s')+\gamma V^\pi(s')\right].
$$

Policy iteration 在“评估—改进”间交替；value iteration 把两步压成 optimality backup：

$$
V_{k+1}(s)=\max_a\sum_{s'}P(s'\mid s,a)
\left[R(s,a,s')+\gamma V_k(s')\right].
$$

大模型环境未知且状态巨大，无法枚举 DP，但 critic 和 bootstrapping 仍继承了 Bellman 结构。

## 3. Monte Carlo：用完整轨迹当标签

MC 在 episode 结束后计算实际回报：

$$
V(s_t)\leftarrow V(s_t)+\alpha(G_t-V(s_t)).
$$

优点：不需要环境模型，目标 $G_t$ 不 bootstrap；缺点：必须等终局，长轨迹方差高。

“无偏”不等于“低方差”。如果任务成功与否受采样偶然性影响，单条 return 是很噪的标签。

## 4. TD：一步真实奖励加一步估计

TD(0) 目标：

$$
y_t=r_t+\gamma V(s_{t+1}).
$$

TD error：

$$
\delta_t=r_t+\gamma V(s_{t+1})-V(s_t).
$$

更新：

$$
V(s_t)\leftarrow V(s_t)+\alpha\delta_t.
$$

TD 不必等 episode 结束，通常方差较小；但目标依赖当前估计，产生 bias。这个 bias–variance 取舍会在 n-step return 与 GAE 中继续出现。

## 5. n-step return 与 $\lambda$-return

n-step target：

$$
G_t^{(n)}=sum_{k=0}^{n-1}\gamma^k r_{t+k}
+\gamma^n V(s_{t+n}).
$$

- $n=1$ 接近 TD，bias 大一些、variance 小；
- $n$ 到 episode 末尾接近 MC，bias 小、variance 大。

$\lambda$-return 用几何权重混合各个 n-step target。GAE 可以看作 advantage 侧对应的高效递推形式。

## 6. SARSA 与 Q-learning

### 6.1 SARSA：跟着行为策略学

一条 transition 是 $(s_t,a_t,r_t,s_{t+1},a_{t+1})$：

$$
Q(s_t,a_t)\leftarrow Q(s_t,a_t)+\alpha
\left[r_t+\gamma Q(s_{t+1},a_{t+1})-Q(s_t,a_t)\right].
$$

target 使用行为策略实际选出的 $a_{t+1}$，所以是 on-policy。

### 6.2 Q-learning：用行为数据逼近贪心目标

$$
Q(s_t,a_t)\leftarrow Q(s_t,a_t)+\alpha
\left[r_t+\gamma\max_{a'}Q(s_{t+1},a')-Q(s_t,a_t)\right].
$$

行为策略可以是 $\epsilon$-greedy，但 target 假设下一步选最大 Q，因此是 off-policy。

### 6.3 一个关键区别

在有悬崖风险的环境里，SARSA 会把探索动作的真实风险算进去，学到更保守的路径；Q-learning 学的是最终贪心策略，可能更贴近最短路径。面试时不要只背“一个 on、一个 off”，要说明 target 不同。

## 7. DQN 为什么需要 replay buffer 和 target network

用神经网络近似 $Q_\theta$ 时，损失常写为：

$$
L(\theta)=\mathbb E
\left[
\left(r+\gamma\max_{a'}Q_{\bar\theta}(s',a')-Q_\theta(s,a)\right)^2
\right].
$$

- replay buffer 打散相邻 transition 的相关性并复用历史数据；
- target network $Q_{\bar\theta}$ 延迟更新，避免 target 与 prediction 同时快速移动；
- 代价是数据更 off-policy，策略版本和覆盖范围需要管理。

LLM RL 通常不直接在词表上做 DQN：动作空间巨大、序列很长、生成策略天然可微，policy gradient 更直接。但 RL Infra 岗会把 replay buffer、样本版本与异步 actor learner 放在一起问。

## 8. exploration 与 exploitation

常见探索方式：

- $\epsilon$-greedy：以 $\epsilon$ 随机，否则贪心；
- stochastic policy：按分布采样；
- entropy bonus：鼓励策略分布不塌缩；
- optimistic initialization/UCB：对不确定动作乐观。

LLM 中 temperature、top-p 与多样采样控制 rollout 探索，但它们不是训练目标本身。temperature 太低可能 group 奖励无差异；太高则产生大量无效或格式错误轨迹。

## 9. 与 LLM 后训练的连接

1. PPO critic 的目标通常由 return 或 GAE-derived target 构造，本质是 value regression。
2. GRPO 省掉 critic，不等于“没有 baseline”；它用同 prompt 的组内奖励统计量当 baseline。
3. 异步 rollout 类似 actor–learner：样本由旧策略生成，版本差越大越 off-policy。
4. Agent 的 tool step 可以产生 transition；长程任务可考虑 step/turn-level value 或 critic。
5. 纯 outcome reward 下，中间 token reward 常为 0；credit 并不会因为把终奖复制给所有 token 就自动变准确。

## 10. 手算题

设 $\gamma=0.9$，当前 transition 为 $r=1$，$V(s)=2$，$V(s')=3$：

$$
\delta=1+0.9\times3-2=1.7.
$$

若 $\alpha=0.1$：

$$
V(s)\leftarrow2+0.1\times1.7=2.17.
$$

若下一状态两个动作 Q 值为 $2.5,3.2$，Q-learning target 是 $1+0.9\times3.2=3.88$；若行为策略实际选了 Q=2.5 的动作，SARSA target 是 $3.25$。

## 11. 本章验收

1. 用一句话区分 MC 与 TD；
2. 写 TD error；
3. 从 target 解释 SARSA/Q-learning 的 on/off-policy；
4. 解释 replay buffer 和 target network 分别解决什么；
5. 说明 critic 与 Bellman/TD 的关系；
6. 解释 GRPO 没有 critic 但仍有 baseline。
---

原始讲义与可运行材料：[GitHub 源文件](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/AI%E7%AE%97%E6%B3%95/%E5%BC%BA%E5%8C%96%E5%AD%A6%E4%B9%A0/02_%E4%BB%B7%E5%80%BC%E5%AD%A6%E4%B9%A0_MC_TD_Q-learning.md)。
