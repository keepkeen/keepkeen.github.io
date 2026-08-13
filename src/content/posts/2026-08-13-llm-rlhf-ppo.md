---
title: "RLHF 与 PPO：从四模型数据流到训练指标"
description: "拆解 actor、critic、reference 与 reward model，分优势正负解释 PPO clip，覆盖 KL 的 k1/k2/k3 估计器、“KL 能否换交叉熵”与训练排障。"
date: 2026-08-13
tags:
  - reinforcement-learning
  - llm
  - interview
lang: zh-CN
draft: false
series: llm-reinforcement-learning-interview
seriesOrder: 5
---
## 1. RLHF 三阶段

经典 InstructGPT 流程：

1. **SFT**：用高质量 demonstration 教模型基本任务和格式；
2. **Reward Model**：对同一 prompt 的多个回答做人类排序，用比较数据训练标量评分器；
3. **PPO**：策略在线生成回答，RM 打分，PPO 在 KL 约束下更新策略。

RLHF 不是 PPO 的同义词。人类反馈可训练 RM，也可生成偏好对供 DPO 使用；PPO 也可以使用规则 verifier、环境 reward 或 AI feedback。

## 2. PPO-RLHF 中的四个模型

| 模型 | 常用符号 | 更新吗 | 作用 |
|---|---|---:|---|
| Actor/Policy | $\pi_\theta$ | 是 | 生成 token，并最大化估计 advantage |
| Reference | $\pi_{ref}$ | 否 | 通过 KL 限制策略远离 SFT 分布 |
| Reward Model | $r_\phi$ | 一轮 PPO 中通常否 | 给整条回答或过程状态打任务/偏好分 |
| Critic/Value | $V_\psi$ | 是 | 估计每个前缀未来 return，构造 advantage |

此外还有 $\pi_{old}$：它通常是 actor 的批次快照或保存下来的 old log-prob，不是第五个长期语义模型。

### 为什么 RM 和 critic 不能合并理解

- RM 面向“外部目标”，由偏好/规则训练；
- critic 面向“当前策略的期望回报”，由 rollout return 训练；
- actor 变化后，critic 的 target 也变化；RM 代表的目标通常不因此改变。

可以共享 backbone 或工程部署，但学习语义不同。

## 3. 一条 PPO-RLHF 数据流

对 prompt batch：

1. rollout actor 生成 response，保存 token、mask、old log-prob；
2. reward function/RM 给 outcome 或 process 分；
3. reference model 计算 response token 的 ref log-prob；
4. 将 KL penalty 合入 token reward，终点叠加任务 reward；
5. critic 对各前缀输出 value；
6. 从后向前算 return 与 GAE；
7. actor 用 PPO clipped loss 更新若干 epoch；
8. critic 用 value loss 更新；
9. 检查 KL、clip fraction、entropy、reward、长度与能力回退；
10. 同步新权重给 rollout engine，再采下一批。

面试时从数据流回答，远强于只念四个模型名。

## 4. KL 正则

经典 KL-regularized objective：

$$
\max_\pi\ \mathbb E_{y\sim\pi(\cdot\mid x)}[r(x,y)]
-\beta D_{KL}(\pi(\cdot\mid x)\|\pi_{ref}(\cdot\mid x)).
$$

采样路径上常用 token 级近似：

$$
r_t^{KL}=-\beta
\left(\log\pi_\theta(a_t\mid s_t)-\log\pi_{ref}(a_t\mid s_t)\right),
$$

在最终 token 再加任务 reward。

KL 太弱：策略容易利用 RM 漏洞、风格漂移、重复或能力退化。KL 太强：actor 被 reference 锁住，任务 reward 学不动。可以固定 $\beta$，也可根据 target KL 自适应调节。

### 两个“接近”不要混淆

- $\pi_\theta$ vs $\pi_{old}$：PPO ratio 控制**一次 update**不要太激进；
- $\pi_\theta$ vs $\pi_{ref}$：KL 控制**整个后训练过程**不要远离参考分布。

所以“已经有 clip，为什么还要 KL”的答案是：它们参照对象、时间尺度和目标都不同。

### KL 的三种蒙特卡洛估计器：k1、k2、k3（2026 实录已点名）

真 KL 是对整个词表的期望，逐 token 精确算太贵，工程上都用采样估计。我们要估计的是反向 KL：

$$
D_{KL}(\pi_\theta\|\pi_{ref})
=\mathbb E_{a\sim\pi_\theta}\left[\log\frac{\pi_\theta(a\mid s)}{\pi_{ref}(a\mid s)}\right].
$$

对每个采到的 token 记 $r=\dfrac{\pi_{ref}(a\mid s)}{\pi_\theta(a\mid s)}$（注意：分子是“另一个分布”，分母是“采样分布”），三种估计器为：

| 估计器 | 公式 | 无偏？ | 方差 | 取值 | 谁在用 |
|---|---|---:|---|---|---|
| $k_1$ | $-\log r=\log\frac{\pi_\theta}{\pi_{ref}}$ | 无偏 | 高（重尾，可为负） | 可正可负 | PPO 经典实现，作为逐 token reward 惩罚 |
| $k_2$ | $\frac12(\log r)^2$ | 有偏（分布接近时近似 KL） | 低 | 恒 $\ge 0$ | 部分实现作为 loss |
| $k_3$ | $(r-1)-\log r$ | 无偏 | 比 $k_1$ 低 | 恒 $\ge 0$ | GRPO 论文与主流实现，作为 loss 项 |

三个可秒答的追问：

1. **$k_3$ 为什么无偏且方差更低？** $k_3=k_1+(r-1)$，而 $\mathbb E_{a\sim\pi_\theta}[r-1]=\sum_a \pi_{ref}(a)-1=0$，所以 $r-1$ 是期望为零的控制变量：不改期望、抵消波动。又因 $\log x\le x-1$，$k_3$ 恒非负。
2. **$k_1$ 的问题？** 单样本可为负、重尾；batch 小或两分布拉开后，KL 曲线剧烈抖动，自适应 KL 系数会被带偏。
3. **“放进 reward”与“作为 loss 反传”一样吗？** 不一样。$k_1$ 作为 reward 时是 detach 的系数，梯度经 policy gradient 传播；$k_3$ 作为 loss 时梯度直接穿过 $r$。近期分析（[arXiv:2510.01555](https://arxiv.org/abs/2510.01555)）指出：on-policy 下 “$k_2$ as loss” 与 “$k_1$ in reward” 梯度等价，都是反向 KL 的严格实现，而 “$k_3$ as loss”（GRPO 用法）只是一阶近似。面试答到“k3 无偏指的是**值估计**，作为 **loss 的梯度**并不严格等于反向 KL 梯度”即为满分层。

十分钟小实验（源自 [Schulman 原博客](http://joschu.net/blog/kl-approx.html)，[中文解读](https://huggingface.co/blog/NormalUhr/kl-divergence-estimator-rl-llm)）：取两个高斯分布采样 1e6 次，分别算 $k_1/k_2/k_3$ 的均值和标准差对照真 KL，亲眼看一遍“无偏但高方差”与“有偏但低方差”。

### KL 与交叉熵：能互换吗（实录原题）

恒等式：$H(P,Q)=H(P)+D_{KL}(P\|Q)$。

- **分类任务**：label 分布 $P$ 固定（one-hot 时 $H(P)=0$），对 $Q$ 优化时 CE 与 KL 只差常数，梯度相同——所以“分类能不能用 KL”答案是能，且与 CE 等价。
- **PPO 的 KL 惩罚换成 CE 行不行？** 不行。惩罚项是 $D_{KL}(\pi_\theta\|\pi_{ref})=H(\pi_\theta,\pi_{ref})-H(\pi_\theta)$，此时 $\pi_\theta$ 自己在变：最小化 KL 的最优点是 $\pi_\theta=\pi_{ref}$；而最小化 CE $H(\pi_\theta,\pi_{ref})$ 的最优点是把全部概率压到 $\pi_{ref}$ 的最高概率动作上——它额外奖励降熵，会推向模式坍缩、抹掉探索。方向也要说清：分类里常是 forward KL（真实分布在左），PPO 惩罚是 reverse KL（policy 在左），两者的 mode-seeking/covering 倾向不同。

## 5. PPO clipped objective

ratio：

$$
r_t(\theta)=\frac{\pi_\theta(a_t\mid s_t)}
{\pi_{old}(a_t\mid s_t)}.
$$

clipped surrogate：

$$
L^{clip}(\theta)=
\mathbb E_t\left[
\min\left(
r_t(\theta)\hat A_t,
\operatorname{clip}(r_t(\theta),1-\epsilon,1+\epsilon)\hat A_t
\right)
\right].
$$

训练代码做梯度下降时用 $-L^{clip}$。

### 为什么 clip 后还要 min

只写 `clip(ratio) * A` 会同时截断有利和不利的变化；PPO 要构造一个悲观 surrogate，只在“朝着过度提高目标的方向”封顶。

#### $\hat A_t>0$

这个 action 比平均好，希望增大概率，即 ratio 上升。但超过 $1+\epsilon$ 后不再给额外收益。

#### $\hat A_t<0$

这个 action 比平均差，希望减小概率，即 ratio 下降。但低于 $1-\epsilon$ 后不再给额外收益。

`min` 与 advantage 符号共同实现这两个方向。不能说“ratio 永远被裁到区间里”：当 update 朝坏方向移动时，unclipped 项仍可能被选中并提供修正梯度。

## 6. 四个数值例子

设 $\epsilon=0.2$：

| ratio | advantage | 原项 $rA$ | clip 项 | min | 含义 |
|---:|---:|---:|---:|---:|---|
| 1.3 | 2 | 2.6 | 2.4 | 2.4 | 好动作涨太多，封顶 |
| 0.7 | 2 | 1.4 | 1.6 | 1.4 | 好动作反而降，保留惩罚 |
| 0.7 | -2 | -1.4 | -1.6 | -1.6 | 坏动作降太多，不继续奖励 |
| 1.3 | -2 | -2.6 | -2.4 | -2.6 | 坏动作反而涨，保留惩罚 |

闭卷讲清这张表，才算真正理解 PPO clip。

## 7. 完整 PPO loss

常见总目标（最大化写法）：

$$
J= L^{clip}
-c_v L_{value}
+c_H H(\pi_\theta)
-\beta KL(\pi_\theta\|\pi_{ref}).
$$

其中：

$$
L_{value}=\frac12\mathbb E_t
\left(V_\psi(s_t)-\hat R_t\right)^2.
$$

工程实现可能把 KL 放入 token reward，而不是显式放在 actor loss；两种写法不能重复计算。value clipping、reward whitening、advantage normalization、entropy bonus 也取决于实现。

## 8. 为什么 PPO 仍叫 on-policy

rollout 来自 $\pi_{old}$，随后只在这批数据上做有限次更新，并尽快丢弃。ratio 和 clip 允许有限复用，但它不是依赖长期 replay buffer 的典型 off-policy 算法。

不过以下情况会让数据更 stale：

- train batch 很大，完成更新前策略已变化；
- rollout 与 trainer 异步；
- 多个 actor 使用不同版本权重；
- 同一 rollout 做太多 epoch；
- 权重同步慢或失败。

因此回答“PPO 是 on-policy”之后，要补一句：工程上只近似 on-policy，需要监控版本差、ratio、KL 与 effective sample age。

## 9. token mask 与 reward 放置

一条序列通常是 `[prompt][response][padding]`：

- actor loss：只算模型生成的 response token；
- KL：通常只算 response token；
- value：按实现对 response states 估值；
- padding：必须 mask；
- Agent tool observation：由环境给出，不是 policy action，通常不算 policy loss。

若结果 reward 只在终点给，前面 token 通过 return/GAE 获得学习信号。把终奖直接复制到每个 token 是常见近似，不代表 credit 真实准确。

## 10. 训练指标

最低监控：

- task/RM reward 的均值、分位数、分任务切片；
- KL 与 target KL；
- entropy；
- policy loss、value loss、explained variance；
- clip fraction、ratio 分布；
- response length、EOS/截断率；
- reward 与人工/真实指标的相关性；
- held-out 基础能力和安全回归。

### 典型异常

| 现象 | 可能原因 | 优先检查 |
|---|---|---|
| RM reward 涨、人工质量降 | reward hacking/RM 分布外 | 长度、格式、独立 judge、人工样本 |
| KL 暴涨 | LR/epoch 太大、old 权重错、mask 错 | ratio、版本号、ref/old 日志 |
| value loss 爆炸 | reward scale、截断、bootstrap/done 错 | return 分布、终止 mask、value target |
| entropy 很快归零 | 探索不足、reward 太尖、温度低 | token entropy、答案去重、reward 方差 |
| reward 抖动大 | 小 batch、RM 噪声、policy lag | sample age、group/task 切片、同步 |

## 11. PPO 为什么复杂

不是因为一个 clip 公式，而是同时维护：

- 在线采样；
- actor/reference/reward/critic 四组计算；
- value 与 advantage；
- 版本和权重同步；
- 多种 mask、长度与数值尺度；
- 不稳定的 learned reward。

这也是 DPO 追求离线简化、GRPO 追求去 critic 的背景。

## 12. 本章验收

1. 画 RLHF 三阶段；
2. 区分 actor/ref/RM/critic/old；
3. 从优势正负解释 PPO clip 与 min；
4. 解释 clip 与 reference KL 为何都需要；
5. 写一条 rollout 到 update 的数据流；
6. 说出五个训练指标和三个排障分支；
7. 解释 PPO 为什么是近似 on-policy、何时出现 policy lag；
8. 默写 $k_1/k_2/k_3$ 三个 KL 估计器，说明偏差—方差与各自被谁使用；
9. 回答“PPO 的 KL 能否换成交叉熵”并给出模式坍缩论证。

主要来源：[PPO 原论文](https://arxiv.org/abs/1707.06347)、[OpenAI Spinning Up PPO](https://spinningup.openai.com/en/latest/algorithms/ppo.html)、[InstructGPT](https://arxiv.org/abs/2203.02155)。
---

原始讲义与可运行材料：[GitHub 源文件](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/AI%E7%AE%97%E6%B3%95/%E5%BC%BA%E5%8C%96%E5%AD%A6%E4%B9%A0/04_RLHF%E4%B8%8EPPO.md)。
