---
title: "GRPO、RLVR 与新方法坐标系"
description: "组内相对优势、结构性失败、DeepSeek R1 四阶段管线、MoE 训推不一致机制，以及 DAPO/GSPO/CISPO/OPD 六轴坐标系。"
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

> "RLVR 是否真的扩展了推理边界"已成为独立的高频开放题（pass@k 反超、spurious rewards、蒸馏对比三组证据），完整论证与面试答法见 [12 章 §3](/blog/llm-rl-frontier-topics/)。

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

**机制层（被追问"熵为什么单调下降"时的满分答案）**：熵的变化由"动作概率与 logit 更新量之间的协方差"驱动，而 policy gradient 下 logit 更新量正比于 advantage——高概率且高优势的 token 压低熵，低概率高优势的 token 抬高熵；实测该协方差长期为正，因此熵单调下降。同一工作给出经验定律 $R=-a\,e^{H}+b$：**性能是拿熵换来的**，熵耗尽时天花板可预测（$H\to0$ 时 $R=-a+b$）。针对性控制手段是只干预"元凶"token：**Clip-Cov**（随机 detach 一小部分最高协方差 token 的梯度）与 **KL-Cov**（对协方差 top-k% 的 token 加 KL 惩罚），比全局 entropy bonus 更精准，已合入 verl（`loss_mode=clip_cov/kl_cov`）。（[arXiv:2505.22617](https://arxiv.org/abs/2505.22617)）

### 6.6 reward hacking

模型优化的是可见 proxy，不是人的真实意图。典型表现：输出更长、重复特定格式、利用 judge 偏好、绕过测试、伪造工具结果。缓解需要 adversarial verifier、独立评测、长度控制、规则组合与人工抽查，而不是只调 KL。

## 7. 案例必考：DeepSeek R1 训练管线

“讲讲 R1 的训练流程/奖励怎么设计”在 2026 实录里出现频率极高（DeepSeek 专项、字节、美团北斗样本都问过），值得单独背熟。以下按 [R1 论文](https://arxiv.org/abs/2501.12948)口径（[中文精译](https://arthurchiao.art/blog/deepseek-r1-paper-zh/)）。

### 7.1 R1-Zero：证明纯 RL 能长出推理

- 起点是 DeepSeek-V3-Base，**不做任何 SFT**，直接大规模 GRPO；
- 奖励全部**基于规则**，两项相加：**accuracy reward**（数学答案 exact match、代码用例通过）+ **format reward**（推理过程必须包在 `<think></think>` 标签里）。**刻意不用神经 RM**——大规模 RL 下 learned RM 容易被 hack，且省掉重训 RM 的管线；
- 训练中自发涌现：反思、自我验证、更长的思考链、“aha moment”；
- 遗留问题：可读性差、中英文混杂——这就是 R1 存在的理由。

### 7.2 R1：四阶段管线（SFT→RL→SFT→RL）

| 阶段 | 做什么 | 为什么 |
|---|---|---|
| ① 冷启动 SFT | 数千条高质量长 CoT（few-shot 提示生成、R1-Zero 可读输出人工后处理）微调 V3-Base | 修可读性、定格式，给 RL 一个稳定起点并加速收敛 |
| ② 推理导向 RL | 与 R1-Zero 相同的大规模 GRPO；在 accuracy 之上**加语言一致性奖励**（CoT 中目标语言词占比，直接相加） | 主攻数学/代码/逻辑；语言一致性略降跑分但符合人类偏好 |
| ③ 拒绝采样 + SFT | 用 ② 的 checkpoint 采样，规则+生成式 RM 过滤（去语言混杂/超长段落/代码块），得约 60 万推理样本；再混约 20 万非推理样本（写作、事实 QA、翻译、自我认知，部分来自 V3 的 SFT 数据）；**对 V3-Base 重新微调**两个 epoch | 把 RL 学到的推理蒸回干净底座，同时补通用能力 |
| ④ 全场景 RL | 推理任务继续用规则奖励；通用任务用 RM 评 helpfulness/harmlessness | 最终对齐：推理不退、无害性达标 |

记忆口诀：**两轮 SFT+RL 交替；奖励“能规则就规则，不能规则才 RM”**。

### 7.3 高频追问

1. **阶段③为什么回到 V3-Base 重训，而不是在 RL checkpoint 上继续？** 论文做法是用干净的大 SFT 数据集重塑底座，避免 RL 累积的风格/分布偏置直接带进最终模型；
2. **冷启动为什么能加速？** 省去 RL 从零摸索输出格式的阶段，探索集中在“推理质量”而不是“怎么说话”；
3. **蒸馏还是小模型直接 RL？** 论文明确对比：用 R1 的 80 万样本蒸馏 Qwen/Llama 小模型，**好于**对同规模小模型直接做大规模 RL——小模型自主探索出推理模式的能力有限，大模型发现的模式可以迁移；但蒸馏封顶于教师，蒸馏后再做 RL 还能涨；
4. **R1 的奖励设计为什么不给过程分？** 规则 verifier 只看终局，防 PRM 被 hack 与标注成本；代价是 credit 粗，靠 GRPO 组内对比缓解。

## 8. DAPO

[DAPO](https://arxiv.org/abs/2503.14476) 是算法与系统配方，不只是给 GRPO 换名。公开的四个关键点：

1. **Clip-Higher**：正向更新使用更高上界，避免低概率好 token 被过早限制，维持探索；
2. **Dynamic Sampling**：过滤/补采全对全错等无梯度 group，提高有效样本比例；
3. **Token-Level Policy Gradient Loss**：按全 batch 有效 token 聚合，改变长短回答权重；
4. **Overlong Reward Shaping**：对超长截断做软惩罚，避免 abrupt zero reward 带来噪声。

DAPO 公开 recipe 还移除了 KL reward penalty，但这不等于“所有任务都应该去 KL”。是否保留参考约束要由 reward 可靠性、能力回退和任务开放程度验证。

## 9. GSPO 与 MoE：训推不一致的深水区

[GSPO](https://arxiv.org/abs/2507.18071) 将重要性比率与 clipping 从 token 粒度推到 sequence 粒度。长度归一化 sequence ratio 可写成：

$$
\rho_i^{seq}=\exp\left[
\frac1{|y_i|}\sum_t
\left(\log\pi_\theta(y_{i,t})-\log\pi_{old}(y_{i,t})\right)
\right].
$$

它试图让 ratio 粒度与 sequence reward 对齐，并减小长序列中 token ratio 高方差；Qwen 团队还强调其对 MoE RL 稳定性的价值。[Qwen 官方说明](https://qwenlm.github.io/blog/gspo/)

不要把 GSPO 说成“只改成整句 reward”——GRPO 本来就常用整句 reward；关键是 sequence-level importance ratio、clipping 与优化。

### 为什么 MoE 让 GRPO 崩（“GRPO 训 MoE 为什么出问题”标准答案）

机制链，五步讲完：

1. **路由是离散决策**：top-k 选专家在连续参数空间上不连续，微小扰动可让同一 token 换专家处理；
2. **两个扰动源**：(a) 参数更新一步后 router 变化（expert-activation volatility / router drift）；(b) **训推两套引擎**（vLLM/SGLang 做 rollout，Megatron/FSDP 算训练侧 log-prob）在算子实现、数值精度、tie-breaking 上的微小差异。有分析报告称一次前向中约 94% 的 token 至少有一层路由在训推两侧不一致（[长琴整理](https://yam.gift/2026/01/17/NLP/LLM-Training/2026-01-17-RL-MoE-Stable/)）；
3. **概率跳变**：换了专家等于换了子网络，新旧/训推 log-prob 出现跳跃式偏差，token 级 importance ratio 不再反映“参数变化”，而是掺入“结构变化”噪声；
4. **clip 机制反噬**：ratio 大量出界 → 频繁触发裁剪 → 有效梯度被裁掉，留下的多是噪声梯度；
5. **结果**：reward 曲线突然崩塌（公开复现里 GRPO 在 MoE 上可跌破 base model）。

修复路线三类（[GSPO 论文](https://arxiv.org/abs/2507.18071)、[MoE RL 稳定性综述](https://arxiv.org/abs/2510.23027)）：

| 路线 | 代表 | 代价 |
|---|---|---|
| 系统强行对齐：训练时重放 rollout 的路由决策 | Routing Replay（Qwen 早期方案）、R3 | 额外显存与通信，限制模型真实容量 |
| 算法钝化：把 ratio 粒度提到序列级/几何平均，对 token 级路由抖动不敏感 | GSPO、GMPO | 改变优化目标；Qwen3 系列已用 GSPO 替代 Routing Replay |
| 数学修正：对训推分布差做重要性修正或屏蔽漂移 token | TIS、IcePop | 需要额外记录 rollout 侧概率 |

追问预演：为什么 dense 模型训推引擎差异可以忽略？——dense 的差异只有浮点精度，是连续小量；MoE 的路由把连续小量放大成离散跳变，性质不同。

## 10. 其他方法放进坐标系

| 方法 | 主要改变的轴 | 解决的问题 | 备考优先级 |
|---|---|---|---|
| Dr. GRPO | advantage/length normalization | std 与长度引入的偏置 | P1，理解动机 |
| RLOO | leave-one-out baseline | critic-free、减少 self-inclusion | P1 |
| REINFORCE++ | global/batch normalization 与稳定技巧 | 简化 critic-free RLHF | P1 |
| VAPO | 恢复 value-based advantage | 高难长推理的精细估值 | P2 |
| GFPO | 多采样后按长度/token efficiency 过滤 | 减少冗长推理 | P2 |
| GSPO | sequence ratio 与 sequence clip | token-ratio 高方差、MoE 稳定 | P0/P1 |
| CISPO | 裁 IS 权重（detach 后当系数）而非裁 token 更新 | clip 把低概率“分叉”token（Wait/However 等）的梯度整个裁没 | P1，投 MiniMax 前 P0 |
| OPD | student on-policy state + teacher token 分布 | 比终点 reward 更密集的监督 | P1 |

面试时不要按年份背缩写。统一问六个问题：

1. 样本由谁生成？
2. reward/teacher signal 在什么粒度？
3. baseline/advantage 怎么估？
4. importance ratio 和 clip 在 token、turn 还是 sequence？
5. KL 约束谁与谁？
6. 它修复哪个可观测失败，代价是什么？

CISPO 补充（[MiniMax-M1](https://arxiv.org/abs/2506.13585)）：PPO/GRPO 的 `min+clip` 让 ratio 出界的 token **梯度为零**，而这些常是引导推理分支的低概率关键词；CISPO 写成 $-\,\mathbb E[\operatorname{sg}(\operatorname{clip}(\rho))\cdot\hat A\cdot\log\pi_\theta]$——裁剪后的权重 stop-gradient 当常数系数，梯度全部经 $\log\pi_\theta$ 流回，**每个 token 都保留梯度**；通常只设较宽的单侧上界，advantage 不裁。追问点：把 `sg` 去掉会怎样（梯度穿过 ratio，回到高方差）；与 DAPO Clip-Higher 的区别（放宽出界阈值 vs 出界也不丢梯度）。

## 11. On-Policy Distillation

OPD 让 student 用当前策略生成自己会遇到的前缀，再由更强 teacher 在这些 state 上提供 token-level distribution supervision。它结合：

- on-policy state distribution：针对 student 自身错误状态；
- dense teacher signal：每个 token 都有分布信息，不必等终局 verifier；
- 无需单独 value critic，但需要 teacher inference。

可优化 teacher 与 student 的 forward/reverse KL。两者倾向不同：

- $D_{KL}(p_{teacher}\|p_{student})$ 更偏覆盖 teacher 支持的模式；
- $D_{KL}(p_{student}\|p_{teacher})$ 更贴合 student 已采到的区域，可能更 mode-seeking。

OPD 不是“没有 reward 的 GRPO”。它的监督对象是 teacher distribution，计算瓶颈和偏差来自 teacher；RLVR 的信号来自任务终态 verifier。[Thinking Machines 官方文章](https://thinkingmachines.ai/blog/on-policy-distillation/)

## 12. 训练指标清单

- reward：mean/std/quantile、per-task、zero-variance group 比例；
- accuracy：pass@1、pass@k、分难度；
- policy：KL、entropy、ratio、clip fraction、grad norm；
- sampling：unique answers、有效 group、temperature、平均/最大长度；
- efficiency：tokens/reward gain、rollout tokens/s、trainer tokens/s、GPU idle；
- freshness：policy version、sample age、rollout-old KL；
- integrity：格式错误、verifier disagreement、长度相关性、人工抽查。

## 13. 本章验收

1. 从同 prompt 的 $G$ 个回答写出 group advantage；
2. 解释 GRPO 为什么省 critic、又失去什么；
3. 纠正“标准 GRPO 使用 GAE”；
4. 解释四个 policy 角色和 policy lag；
5. 解释全对全错、std bias、credit gap、长度偏置、entropy collapse；
6. 背出 R1-Zero 的两项规则奖励与 R1 四阶段管线，并答出“蒸馏 vs 小模型直接 RL”的论文结论；
7. 用五步机制链讲清“GRPO 训 MoE 为什么崩”，并给出三类修复路线（Routing Replay / GSPO / TIS 类）；
8. 用六轴坐标系比较 DAPO、GSPO、CISPO、OPD；
9. 给出一个 RLVR 实验必须报告的指标集合。
---

原始讲义与可运行材料：[GitHub 源文件](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/AI%E7%AE%97%E6%B3%95/%E5%BC%BA%E5%8C%96%E5%AD%A6%E4%B9%A0/06_GRPO_RLVR%E4%B8%8E%E6%96%B0%E6%96%B9%E6%B3%95.md)。
