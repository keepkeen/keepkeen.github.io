---
title: "GRPO、RLVR 与新方法坐标系"
description: "讲清组内相对优势、四种 policy、全同分退化、DAPO、GSPO、on-policy distillation 及方法选择。"
date: 2026-08-13
tags:
  - reinforcement-learning
  - llm
  - interview
lang: zh-CN
draft: false
series: llm-reinforcement-learning-interview
seriesOrder: 7
---
## 1. 为什么 GRPO 出现

PPO 需要 critic 为每个前缀估计 value。对大语言模型，critic 往往与 policy 同规模，带来显存、通信、训练误差和系统复杂度。

GRPO（Group Relative Policy Optimization）的核心替代是：对同一个 prompt 采样一组回答，用组内相对 reward 构造 baseline/advantage，省掉独立 critic。[DeepSeekMath](https://arxiv.org/abs/2402.03300) 首次系统提出 GRPO，后续 DeepSeek-R1 将大规模 reasoning RL 带入主流讨论。[DeepSeek-R1](https://github.com/deepseek-ai/DeepSeek-R1)

## 2. 标准 GRPO 数据流

对 prompt $x$：

1. 从 rollout/old policy 采样 $G$ 条回答 $y_1,\ldots,y_G$；
2. verifier 或 RM 给每条回答 reward $r_i$；
3. 计算组内相对 advantage；
4. policy/ref 对 response token 计算 log-prob；
5. 用 PPO-style ratio、clip 和 KL 更新 policy；
6. 无 critic、无 GAE；
7. 同步新 policy，再产生下一批 rollout。

最常见 advantage：

$$
\hat A_i=\frac{r_i-\mu_r}{\sigma_r+\epsilon},
\qquad
\mu_r=\frac1G\sum_{j=1}^G r_j.
$$

同一回答的 response token 通常共享 $\hat A_i$。

## 3. GRPO objective

token ratio：

$$
\rho_{i,t}(\theta)=
\exp\left(
\log\pi_\theta(y_{i,t}\mid x,y_{i,<t})
-\log\pi_{old}(y_{i,t}\mid x,y_{i,<t})
\right).
$$

简化 objective：

$$
J_{GRPO}=\mathbb E
\left[
\frac1G\sum_{i=1}^G\frac1{|y_i|}
\sum_t
\min\left(
\rho_{i,t}\hat A_i,
\operatorname{clip}(\rho_{i,t},1-\epsilon,1+\epsilon)\hat A_i
\right)
-\beta KL_i
\right].
$$

实际实现会在 KL 放置、聚合口径、advantage 标准化、clip 上下界和 mask 上不同。面试应先声明版本，再回答。

### 标准 GRPO 有没有 GAE

没有。原始 GRPO 用 group-relative reward 估计 advantage，不训练 value critic，也不需要 GAE。如果某框架或 Agent 变体加入 turn/token value、GAE 或 process reward，那是扩展实现。遇到“GRPO 的 GAE 怎么算”应先纠正语义，再说明可能指 PPO/Agent 变体。

## 4. 四个策略角色

| 角色 | 是否更新 | 作用 |
|---|---:|---|
| $\pi_\theta$ | 是 | trainer 正在更新的策略 |
| $\pi_{old}$ | 每批/每轮刷新 | ratio denominator，代表该 batch 的行为策略快照 |
| $\pi_{rollout}$ | 周期同步 | 推理引擎实际采样策略；异步时可能落后 |
| $\pi_{ref}$ | 通常冻结 | KL 参考，保持语言/能力分布 |

理想同步训练中 $\pi_{rollout}=\pi_{old}$。当 rollout 慢、batch 大、权重同步稀疏时，两者可能不同，样本出现 policy lag。

## 5. RLVR

Reinforcement Learning with Verifiable Rewards 使用可程序验证的反馈，例如：

- 数学最终答案 exact match；
- 代码单元测试、编译和运行结果；
- SQL/数据库终态；
- 工具任务是否达到目标状态；
- 格式、约束、安全规则。

优点：奖励便宜、可扩展、比开放式 judge 更确定。局限：

- verifier 只看结果，可能忽略错误推理或投机路径；
- 数据过易时 group 全对，过难时全错；
- reward 可被格式、测试漏洞或数据泄漏 hack；
- pass@1 上升不一定证明学到超出 base model 的新推理能力，也可能是重新分配已有解法概率。

所以必须同时报告 pass@1/pass@k、采样预算、平均 token、分难度表现、base model coverage 和去污染结果。

## 6. GRPO 的结构性失败

### 6.1 全对或全错 group

若 $r_1=\cdots=r_G$，则 $\sigma_r=0$ 且 centered reward 全为 0，advantage 没有区分度，policy gradient 近似为 0。

修复思路：

- 调整数据难度，保留成功率处于中间区间的 prompt；
- 增大/自适应 group sampling；
- dynamic sampling：过滤并补采无信息 group；
- 引入过程/部分奖励，但要防代理偏差；
- curriculum 随模型能力移动难度分布。

### 6.2 难度与标准差偏置

除以组内标准差会把相同 reward gap 在不同 prompt 上缩放成不同梯度。小方差 group 可能被放大，二元奖励下不同成功率对应的尺度也不同。

不要把 normalization 当作无害预处理。要比较：只中心化、固定尺度、leave-one-out、batch normalization 等消融。

### 6.3 trajectory reward 到 token 的 credit gap

整条回答一个 $\hat A_i$，所有 token 共享，意味着正确答案中的错误/冗余 token 也被鼓励，失败答案中的有用步骤也被惩罚。长链推理与 Agent 中尤其明显。

可选方向：process verifier、turn-level reward、retrospective critic、branch comparison、step value。但每种方法都引入额外模型或标签误差。

### 6.4 长度偏置

两种常见聚合：

- **per-sequence mean**：先对每条回答 token 求均值，再平均回答；每条回答总权重相等，长回答每 token 权重更小；
- **global token mean**：所有有效 token 一起平均；每 token 权重相等，长回答总权重更大。

不存在脱离任务的“绝对正确”口径。必须说明你希望每条样本等权，还是每个 token 等权，并监控平均长度和 token efficiency。

### 6.5 entropy collapse

reward 过尖、采样温度过低、学习率或更新 epoch 过大，可能让少数模式快速占满概率，group 多样性消失。表现为 entropy、unique completion、pass@k 下降，而训练 reward 可能仍上涨。

### 6.6 reward hacking

模型优化的是可见 proxy，不是人的真实意图。典型表现：输出更长、重复特定格式、利用 judge 偏好、绕过测试、伪造工具结果。缓解需要 adversarial verifier、独立评测、长度控制、规则组合与人工抽查，而不是只调 KL。

## 7. DAPO

[DAPO](https://arxiv.org/abs/2503.14476) 是算法与系统配方，不只是给 GRPO 换名。公开的四个关键点：

1. **Clip-Higher**：正向更新使用更高上界，避免低概率好 token 被过早限制，维持探索；
2. **Dynamic Sampling**：过滤/补采全对全错等无梯度 group，提高有效样本比例；
3. **Token-Level Policy Gradient Loss**：按全 batch 有效 token 聚合，改变长短回答权重；
4. **Overlong Reward Shaping**：对超长截断做软惩罚，避免 abrupt zero reward 带来噪声。

DAPO 公开 recipe 还移除了 KL reward penalty，但这不等于“所有任务都应该去 KL”。是否保留参考约束要由 reward 可靠性、能力回退和任务开放程度验证。

## 8. GSPO

[GSPO](https://arxiv.org/abs/2507.18071) 将重要性比率与 clipping 从 token 粒度推到 sequence 粒度。长度归一化 sequence ratio 可写成：

$$
\rho_i^{seq}=\exp\left[
\frac1{|y_i|}\sum_t
\left(\log\pi_\theta(y_{i,t})-\log\pi_{old}(y_{i,t})\right)
\right].
$$

它试图让 ratio 粒度与 sequence reward 对齐，并减小长序列中 token ratio 高方差；Qwen 团队还强调其对 MoE RL 稳定性的价值。[Qwen 官方说明](https://qwenlm.github.io/blog/gspo/)

不要把 GSPO 说成“只改成整句 reward”——GRPO 本来就常用整句 reward；关键是 sequence-level importance ratio、clipping 与优化。

## 9. 其他方法放进坐标系

| 方法 | 主要改变的轴 | 解决的问题 | 备考优先级 |
|---|---|---|---|
| Dr. GRPO | advantage/length normalization | std 与长度引入的偏置 | P1，理解动机 |
| RLOO | leave-one-out baseline | critic-free、减少 self-inclusion | P1 |
| REINFORCE++ | global/batch normalization 与稳定技巧 | 简化 critic-free RLHF | P1 |
| VAPO | 恢复 value-based advantage | 高难长推理的精细估值 | P2 |
| GFPO | 多采样后按长度/token efficiency 过滤 | 减少冗长推理 | P2 |
| GSPO | sequence ratio 与 sequence clip | token-ratio 高方差、MoE 稳定 | P0/P1 |
| OPD | student on-policy state + teacher token 分布 | 比终点 reward 更密集的监督 | P1 |

面试时不要按年份背缩写。统一问六个问题：

1. 样本由谁生成？
2. reward/teacher signal 在什么粒度？
3. baseline/advantage 怎么估？
4. importance ratio 和 clip 在 token、turn 还是 sequence？
5. KL 约束谁与谁？
6. 它修复哪个可观测失败，代价是什么？

## 10. On-Policy Distillation

OPD 让 student 用当前策略生成自己会遇到的前缀，再由更强 teacher 在这些 state 上提供 token-level distribution supervision。它结合：

- on-policy state distribution：针对 student 自身错误状态；
- dense teacher signal：每个 token 都有分布信息，不必等终局 verifier；
- 无需单独 value critic，但需要 teacher inference。

可优化 teacher 与 student 的 forward/reverse KL。两者倾向不同：

- $D_{KL}(p_{teacher}\|p_{student})$ 更偏覆盖 teacher 支持的模式；
- $D_{KL}(p_{student}\|p_{teacher})$ 更贴合 student 已采到的区域，可能更 mode-seeking。

OPD 不是“没有 reward 的 GRPO”。它的监督对象是 teacher distribution，计算瓶颈和偏差来自 teacher；RLVR 的信号来自任务终态 verifier。[Thinking Machines 官方文章](https://thinkingmachines.ai/blog/on-policy-distillation/)

## 11. 训练指标清单

- reward：mean/std/quantile、per-task、zero-variance group 比例；
- accuracy：pass@1、pass@k、分难度；
- policy：KL、entropy、ratio、clip fraction、grad norm；
- sampling：unique answers、有效 group、temperature、平均/最大长度；
- efficiency：tokens/reward gain、rollout tokens/s、trainer tokens/s、GPU idle；
- freshness：policy version、sample age、rollout-old KL；
- integrity：格式错误、verifier disagreement、长度相关性、人工抽查。

## 12. 本章验收

1. 从同 prompt 的 $G$ 个回答写出 group advantage；
2. 解释 GRPO 为什么省 critic、又失去什么；
3. 纠正“标准 GRPO 使用 GAE”；
4. 解释四个 policy 角色和 policy lag；
5. 解释全对全错、std bias、credit gap、长度偏置、entropy collapse；
6. 用六轴坐标系比较 DAPO、GSPO、OPD；
7. 给出一个 RLVR 实验必须报告的指标集合。
---

原始讲义与可运行材料：[GitHub 源文件](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/AI%E7%AE%97%E6%B3%95/%E5%BC%BA%E5%8C%96%E5%AD%A6%E4%B9%A0/06_GRPO_RLVR%E4%B8%8E%E6%96%B0%E6%96%B9%E6%B3%95.md)。
