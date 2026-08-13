---
title: "策略梯度、Actor-Critic 与 GAE"
description: "从 REINFORCE 推导到 baseline、Actor-Critic、GAE 和 importance sampling，为 PPO 打牢公式与数值直觉。"
date: 2026-08-13
tags:
  - reinforcement-learning
  - llm
  - interview
lang: zh-CN
draft: false
series: llm-reinforcement-learning-interview
seriesOrder: 4
---
策略梯度是 PPO、GRPO 和多数 LLM 在线 RL 的共同祖先。本章目标是让你能从期望回报推到实际 loss，而不是直接背 PPO 公式。

## 1. 为什么直接优化 policy

价值方法先学 $Q$，再用 $\arg\max_a Q(s,a)$ 选动作。在 LLM 中，动作是整个词表，策略本身已经是一个可微概率分布，直接提高高回报 token 的概率更自然。

定义目标：

$$
J(\theta)=\mathbb E_{\tau\sim p_\theta(\tau)}[R(\tau)].
$$

利用 log-derivative trick：

$$
\begin{aligned}
\nabla_\theta J
&=\sum_\tau \nabla_\theta p_\theta(\tau)R(\tau)\\
&=\mathbb E_{\tau\sim p_\theta}
\left[R(\tau)\nabla_\theta\log p_\theta(\tau)\right].
\end{aligned}
$$

环境转移不依赖 $\theta$，所以

$$
\nabla_\theta\log p_\theta(\tau)
=\sum_t\nabla_\theta\log\pi_\theta(a_t\mid s_t).
$$

得到 REINFORCE 形式：

$$
\nabla_\theta J
=\mathbb E\left[
\sum_t\nabla_\theta\log\pi_\theta(a_t\mid s_t)G_t
\right].
$$

做梯度下降时常写 loss：

$$
L_{PG}=-\mathbb E_t
\left[\log\pi_\theta(a_t\mid s_t)\hat A_t\right].
$$

## 2. 为什么可以减 baseline

对只依赖 state、不依赖当前 action 的 $b(s)$：

$$
\mathbb E_{a\sim\pi}
\left[b(s)\nabla_\theta\log\pi_\theta(a\mid s)\right]
=b(s)\nabla_\theta\sum_a\pi_\theta(a\mid s)=0.
$$

所以用 $G_t-b(s_t)$ 不改变期望梯度，却能降方差。最常见 baseline 是 $V^\pi(s_t)$，此时得到 advantage。

错误说法是“baseline 必须是奖励均值”。它可以是 value model、组内均值、leave-one-out 均值等；关键是不能以破坏无偏性的方式依赖当前 action。

## 3. REINFORCE 的问题

- 必须采完整轨迹才能得到 $G_t$；
- 长轨迹和稀疏 reward 方差高；
- 每个 token 常共享相近的终局信号，credit 粗糙；
- on-policy 数据昂贵，更新一次后很快过期。

它的优点也很重要：结构简单、无需 critic，RLOO、REINFORCE++、GRPO 等都在重新探索 critic-free 路线。

## 4. Actor-Critic

- Actor：策略 $\pi_\theta$，决定动作；
- Critic：$V_\phi(s)$ 或 $Q_\phi(s,a)$，估计回报/优势。

Actor loss：

$$
L_{actor}=-\mathbb E_t
\left[\log\pi_\theta(a_t\mid s_t)\hat A_t\right].
$$

Critic loss：

$$
L_{value}=\frac12\mathbb E_t
\left(V_\phi(s_t)-\hat V_t^{target}\right)^2.
$$

critic 不等于 reward model：

| 模型 | 输入 | 输出 | 训练目标 | 是否随策略状态变化 |
|---|---|---|---|---|
| Reward Model | prompt + 完整/部分回答 | 偏好或质量分 | 人类/AI 比较数据 | 通常在一轮 RL 中冻结 |
| Value/Critic | 当前 state/前缀 | 从此继续的期望 return | rollout return/TD target | 要跟当前策略共同更新 |

RM 判断“这条回答总体有多好”；critic 估计“从这个前缀继续，当前策略平均能拿多少分”。

## 5. GAE

TD residual：

$$
\delta_t=r_t+\gamma V(s_{t+1})-V(s_t).
$$

Generalized Advantage Estimation：

$$
\hat A_t^{GAE(\gamma,\lambda)}
=\sum_{l=0}^{T-t-1}(\gamma\lambda)^l\delta_{t+l}.
$$

反向递推：

$$
\hat A_t=\delta_t+\gamma\lambda(1-d_t)\hat A_{t+1},
$$

$d_t=1$ 表示 episode 在该步终止，必须截断跨 episode 传播。

### $\lambda$ 的直觉

- $\lambda=0$：只用一步 TD residual，更依赖 critic，方差低、bias 可能高；
- $\lambda\to1$：接近 Monte Carlo advantage，bias 低、方差高；
- $\gamma$ 控制远期 reward 权重，$\lambda$ 控制多步 TD residual 的混合。

不要回答“$\lambda$ 越大越准确”。critic 误差、轨迹长度和 reward 噪声共同决定最优点。

## 6. GAE 数值例子

设 $\gamma=1,\lambda=0.5$，两步奖励 $r=[0,1]$，价值 $V=[0.2,0.6,0]$，第二步终止：

$$
\delta_1=1+0-0.6=0.4,
$$

$$
\delta_0=0+0.6-0.2=0.4.
$$

反向计算：

$$
\hat A_1=0.4,
$$

$$
\hat A_0=0.4+0.5\times0.4=0.6.
$$

如果漏掉 done mask，下一条样本的 advantage 会串进来，是常见实现 bug。

## 7. on-policy、off-policy 与 ratio

on-policy：采样数据的行为策略与要优化的目标策略相同或足够接近。off-policy：数据来自其他策略或更旧版本。

PPO 一般称 on-policy，但同一批 rollout 会做多轮 minibatch update，因此新旧策略逐渐分离；importance ratio 用于校正：

$$
r_t(\theta)=
\frac{\pi_\theta(a_t\mid s_t)}
{\pi_{old}(a_t\mid s_t)}
=\exp(\log\pi_\theta-\log\pi_{old}).
$$

异步 LLM RL 中，rollout engine 可能还在用更旧权重 $\pi_{rollout}$。要明确：

- $\pi_\theta$：正在训练的当前策略；
- $\pi_{old}$：生成该训练 batch 或冻结 ratio denominator 的策略快照；
- $\pi_{rollout}$：推理引擎实际采样策略，理想上与 old 同步，异步时可能滞后；
- $\pi_{ref}$：KL 参考模型，通常长期冻结。

## 8. entropy 与 exploration

策略熵：

$$
H(\pi(\cdot\mid s))=-\sum_a\pi(a\mid s)\log\pi(a\mid s).
$$

训练目标可加 $+c_H H$（若最大化 objective）鼓励探索。LLM RL 中需同时观察 token entropy、答案多样性、正确率、格式率和长度；只追 entropy 会产生胡言乱语，只压 entropy 会过早坍缩。

## 9. 常见实现细节

- response mask：prompt、padding、工具 observation 通常不参与 policy loss；
- advantage detach：估计出的 advantage 不应反传进 reward/critic 路径，除非算法明确如此；
- normalization：batch whitening 会改变梯度尺度，要记录统计口径；
- sequence length：按 token 平均与按序列平均给长回答不同权重；
- EOS/truncation：自然结束、环境终止和 max-token 截断要区分。

## 10. 本章验收

1. 从轨迹概率推到 REINFORCE；
2. 证明 action-independent baseline 不改变期望梯度；
3. 区分 RM 与 critic；
4. 从后向前计算一条 GAE；
5. 解释 $\gamma$ 与 $\lambda$ 的不同角色；
6. 区分 $\pi_\theta,\pi_{old},\pi_{rollout},\pi_{ref}$；
7. 说明 PPO 为什么仍可能产生 off-policy/policy-lag 问题。

原始参考：[GAE](https://arxiv.org/abs/1506.02438)、[Policy Gradient Theorem](https://proceedings.neurips.cc/paper_files/paper/1999/file/464d828b85b0bed98e80ade0a5c43b0f-Paper.pdf)、[Spinning Up 策略优化导读](https://spinningup.openai.com/en/latest/spinningup/rl_intro3.html)。
---

原始讲义与可运行材料：[GitHub 源文件](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/AI%E7%AE%97%E6%B3%95/%E5%BC%BA%E5%8C%96%E5%AD%A6%E4%B9%A0/03_%E7%AD%96%E7%95%A5%E6%A2%AF%E5%BA%A6_REINFORCE_ActorCritic_GAE.md)。
