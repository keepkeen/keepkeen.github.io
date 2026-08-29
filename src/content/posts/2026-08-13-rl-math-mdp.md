---
title: "强化学习数学地基与 MDP"
description: "用概率、期望、log-derivative trick、return、value 与 Bellman 方程建立大模型 RL 的共同语言。"
date: 2026-08-13
updatedDate: 2026-08-29
tags:
  - reinforcement-learning
  - llm
  - interview
lang: zh-CN
draft: false
series: llm-reinforcement-learning-interview
seriesOrder: 2
---
## 1. 强化学习与监督学习差在哪里

监督学习给定固定样本 $(x,y)$，优化预测与标签的差。强化学习面对的是：模型的动作会改变后续看到的数据，反馈可能延迟，数据分布还会随着策略更新而改变。

三个差别最重要：

1. **序列性**：今天的 action 会改变明天的 state；
2. **信用分配**：最后成功，到底应该奖励前面哪一步；
3. **分布依赖策略**：训练数据 $\tau$ 来自 $\pi_\theta$，参数变了，数据分布也变。

这也是为什么大模型 RL 不能只被理解成“换了一个 loss”。

## 2. 概率与期望的最低准备线

### 2.1 条件概率与轨迹概率

在有限时域 MDP 中，轨迹

$$
\tau=(s_0,a_0,r_0,s_1,a_1,r_1,\ldots,s_T)
$$

的概率可写为

$$
p_\theta(\tau)
=\rho_0(s_0)\prod_{t=0}^{T-1}
\pi_\theta(a_t\mid s_t)P(s_{t+1}\mid s_t,a_t).
$$

$\rho_0$ 是初始状态分布，$P$ 是环境转移，只有策略 $\pi_\theta$ 依赖模型参数。

### 2.2 log-derivative trick

若 $p_\theta(x)>0$：

$$
\nabla_\theta p_\theta(x)
=p_\theta(x)\nabla_\theta\log p_\theta(x).
$$

因此

$$
\nabla_\theta \mathbb E_{x\sim p_\theta}[f(x)]
=\mathbb E_{x\sim p_\theta}
\left[f(x)\nabla_\theta\log p_\theta(x)\right].
$$

这一步把“对采样分布求导”变成“对 log-prob 求导”，是 REINFORCE、PPO、GRPO 的共同地基。

### 2.3 importance sampling

当样本来自旧分布 $q$，却想估计新分布 $p$ 下的期望：

$$
\mathbb E_{x\sim p}[f(x)]
=\mathbb E_{x\sim q}
\left[\frac{p(x)}{q(x)}f(x)\right].
$$

比率 $p/q$ 能校正分布差异，但比率极端时方差会很大。PPO 的 ratio 与 clipping、异步 RL 的 policy lag，都从这里来。

## 3. MDP 五元组

马尔可夫决策过程写作

$$
\mathcal M=(\mathcal S,\mathcal A,P,R,\gamma).
$$

- $\mathcal S$：状态空间；
- $\mathcal A$：动作空间；
- $P(s'\mid s,a)$：转移概率；
- $R(s,a,s')$：即时奖励；
- $\gamma\in[0,1)$：折扣因子。

马尔可夫性质不是“未来与过去无关”，而是**给定当前 state 后，过去不再为预测下一状态提供额外信息**：

$$
P(s_{t+1}\mid s_0,a_0,\ldots,s_t,a_t)
=P(s_{t+1}\mid s_t,a_t).
$$

如果 state 没有包含完成决策所需的信息，问题实际是 POMDP。LLM Agent 的有限上下文、压缩记忆和不可见用户状态都可能造成部分可观测。

## 4. reward、return 与 discount

即时奖励是 $r_t$；从 $t$ 开始的折扣回报是

$$
G_t=\sum_{k=0}^{T-t-1}\gamma^k r_{t+k}.
$$

不要混淆：

- reward：某一步收到的标量；
- return：未来 reward 的累计；
- value：在某策略下 return 的期望；
- advantage：某 action 相对当前 state 平均水平好多少。

在有限长度的 LLM 回答中，任务 reward 常只在末尾给，工程上又常用 $\gamma=1$。这不代表 discount 没用：多轮 Agent 可能需要偏好更快完成、处理无限或很长 horizon，并降低远期估计方差。

## 5. policy、value、Q 与 advantage

策略：

$$
\pi(a\mid s)=P(a_t=a\mid s_t=s).
$$

状态价值：

$$
V^\pi(s)=\mathbb E_\pi[G_t\mid s_t=s].
$$

动作价值：

$$
Q^\pi(s,a)=\mathbb E_\pi[G_t\mid s_t=s,a_t=a].
$$

优势函数：

$$
A^\pi(s,a)=Q^\pi(s,a)-V^\pi(s).
$$

直觉：reward 说“最终得了 1 分”；advantage 说“在这个状态下，这个动作比策略平均动作好多少”。这正是面试里“reward 和 advantage 有什么区别”的完整答案。

## 6. Bellman 方程

Bellman expectation equation：

$$
V^\pi(s)=\mathbb E_{a\sim\pi,s'\sim P}
\left[R(s,a,s')+\gamma V^\pi(s')\right].
$$

$$
Q^\pi(s,a)=\mathbb E_{s'\sim P}
\left[R(s,a,s')+\gamma\mathbb E_{a'\sim\pi}Q^\pi(s',a')\right].
$$

Bellman optimality equation：

$$
Q^*(s,a)=\mathbb E_{s'}
\left[R(s,a,s')+\gamma\max_{a'}Q^*(s',a')\right].
$$

Bellman 方程的核心不是背公式，而是“一步 reward + 下一状态的价值”。动态规划、TD、Q-learning、critic 都是不同形式的 Bellman backup。

## 7. 两步数值例子

假设一条轨迹奖励为 $[0,2,3]$，$\gamma=0.9$，终点后价值为 0：

$$
G_2=3,
$$

$$
G_1=2+0.9\times 3=4.7,
$$

$$
G_0=0+0.9\times 4.7=4.23.
$$

从后往前递推比为每个位置重复求和更稳定，也对应代码中的 reverse scan。

## 8. LLM 的 MDP 建模

### 单轮生成

- $s_t=(x,y_{<t})$；
- $a_t=y_t$；
- $\pi_\theta(a_t\mid s_t)$ 是 next-token distribution；
- trajectory 是完整 completion；
- reward 可由 RM、规则或 verifier 在终点给出。

### 多轮工具 Agent

更合理的 state 包括：用户目标、已生成上下文、工具列表、工具结果、环境状态、剩余预算。action 可以在两个粒度定义：

- token-level：每个 token 一个 action，适合反向传播；
- turn/step-level：一次 reasoning + tool call 一个 action，适合环境建模和 credit assignment。

两个粒度需要映射，不能假设 trajectory reward 自动等于每个 token 的真实贡献。

## 9. 高频误区

- **“MDP 的 state 就是模型输入 token”**：单轮近似可以；Agent 中还应包含外部环境状态和工具反馈。
- **“reward 越密越好”**：密集代理 reward 可能更容易被 hack，且标注或 judge 本身有偏差。
- **“$\gamma$ 越大越好”**：大 $\gamma$ 重视远期但提高估计方差，也可能强化拖延。
- **“advantage 就是 reward normalization”**：advantage 是相对 baseline 的价值差；标准化只是估计和优化技巧。
- **“语言模型不是 RL，因为环境不变”**：策略生成的数据分布会变；Agent 环境还会显式转移。

## 10. 本章验收

闭卷完成：

1. 写出 MDP 五元组和轨迹概率；
2. 解释 state 与 observation；
3. 从 $\nabla p=p\nabla\log p$ 推出 score-function estimator；
4. 解释 reward、return、value、Q、advantage；
5. 计算三步 discounted return；
6. 把普通 LLM 和工具 Agent 分别写成 MDP。

基础入口可参考 Sutton 与 Barto 的教材及 OpenAI Spinning Up 的概念导读。[Sutton–Barto](https://mitpress.mit.edu/9780262352703/reinforcement-learning/)、[Spinning Up](https://spinningup.openai.com/en/latest/spinningup/rl_intro.html)
---

原始讲义与可运行材料：[GitHub 源文件](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/AI%E7%AE%97%E6%B3%95/%E5%BC%BA%E5%8C%96%E5%AD%A6%E4%B9%A0/01_%E6%95%B0%E5%AD%A6%E5%9C%B0%E5%9F%BA%E4%B8%8EMDP.md)。
