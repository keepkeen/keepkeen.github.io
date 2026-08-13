---
title: "大模型强化学习面经：45 张答案卡"
description: "覆盖经典 RL、PPO、DPO、GRPO、Agentic RL、系统排障和项目表达，并配两轮追问与评分标准。"
date: 2026-08-13
tags:
  - reinforcement-learning
  - llm
  - interview
lang: zh-CN
draft: false
series: llm-reinforcement-learning-interview
seriesOrder: 10
---
> 用法：先遮住答案口述 60～90 秒，再看“追问”。能写公式、做数值例子、说明工程故障，才算真正掌握。

## 0. 这份题库来自哪里

检索窗口为 **2025-01-01 至 2026-08-13**。公开亲历面经显示，国内大模型 RL 岗的考察已经从“讲 PPO/GRPO”推进到：

- 公式与数值直觉：clip、GAE、importance ratio、DPO beta；
- 策略角色：current、old、rollout/behavior、reference；
- 方法演进：GRPO、DAPO、GSPO 及组内同分问题；
- Agentic RL：多轮奖励、工具返回 mask、轨迹信用分配；
- 系统：verl/TRL/Ray、显存、policy lag、长尾 rollout；
- 排障：KL、entropy、clipfrac、reward hacking、全零 advantage。

代表性样本包括[百度后训练一面](https://www.nowcoder.com/discuss/863890669662674944)、[百度后训练二面](https://www.nowcoder.com/discuss/864605093486682112)、[字节 Agentic RL](https://www.nowcoder.com/feed/main/detail/28b254940eb940189188d795f4606c52)、[蔚来大模型 RL](https://www.nowcoder.com/discuss/863132498270695424)和[滴滴 RL 面经](https://www.nowcoder.com/feed/main/detail/3fd2957eb8274e0cb4afcac39ed182d3)。题目是归纳后的训练卡，不宣称每一道都由某一家公司原样提问。

---

## A. 经典 RL 地基

### 1. 什么是 MDP？LLM 如何映射到 MDP？

**答：** MDP 由 \((\mathcal S,\mathcal A,P,R,\gamma)\) 构成，满足给定当前状态和动作后，下一状态分布与更早历史无关。语言模型中，状态可视为 prompt 加已生成前缀，动作是下一个 token，转移是把 token 追加到前缀，策略是 softmax 分布，终止时由 RM 或 verifier 给 reward。

**追问：** 多轮 Agent 的环境 observation 如何进入状态？上下文截断后还满足 Markov 性吗？

### 2. \(V^\pi\)、\(Q^\pi\) 和 advantage 的区别？

**答：** \(V^\pi(s)\) 是从状态出发按策略行动的期望回报；\(Q^\pi(s,a)\) 固定第一步动作；\(A^\pi(s,a)=Q^\pi(s,a)-V^\pi(s)\) 表示该动作相对该状态平均水平好多少。advantage 作为相对信号能降低策略梯度方差。

**追问：** baseline 为什么不改变策略梯度期望？要求写出 \(\mathbb E_{a\sim\pi}[\nabla\log\pi(a|s)b(s)]=0\)。

### 3. Monte Carlo 与 TD 有什么区别？

**答：** MC 等完整轨迹后用真实 return，偏差低、方差高；TD 用 \(r+\gamma V(s')\) bootstrap，方差低但有估计偏差，可以在线更新。GAE 在多步 TD 残差之间调节偏差—方差。

**追问：** 为什么 reward-to-go 比整条轨迹总回报方差更低？

### 4. on-policy 与 off-policy 怎么区分？

**答：** 数据策略与待优化策略一致或足够接近，是 on-policy；可以重复利用其他策略产生的数据，是 off-policy。PPO 每轮采样后只做有限次更新，属于近似 on-policy；DPO 使用固定偏好数据，属于离线偏好优化。

**追问：** 为什么异步 rollout 会让本来近似 on-policy 的算法更 off-policy？

### 5. exploration 与 entropy 的关系？

**答：** entropy 衡量策略分布的不确定性，熵奖励可避免过早坍缩并鼓励探索。但它不是探索本身：采样温度、任务覆盖、组内多样性和环境分支同样重要，过高熵会损害确定性输出。

**追问：** 为什么只看全序列平均 entropy 可能误判？

---

## B. 策略梯度、Actor-Critic 与 GAE

### 6. 推导 REINFORCE 的核心公式。

**答：** 对 \(J(\theta)=\mathbb E_{\tau\sim p_\theta}[R(\tau)]\) 使用 log-derivative trick：

\[
\nabla J=\mathbb E_\tau[R(\tau)\nabla\log p_\theta(\tau)]
=\mathbb E_\tau\left[\sum_t G_t\nabla\log\pi_\theta(a_t|s_t)\right]
\]

环境转移不依赖 \(\theta\)，因此只剩策略概率项。

**追问：** 为什么通常最大化 objective，而代码里写负号作为 loss？

### 7. Actor-Critic 为什么比纯 REINFORCE 稳？

**答：** critic 估计 \(V\) 或 \(Q\)，actor 使用 advantage 更新。baseline 降低高方差，但引入 critic 估计偏差和额外训练成本。critic loss 通常是 value target 的回归损失。

**追问：** critic 学坏会怎样影响 actor？GRPO 为什么想去掉 critic？

### 8. GAE 公式及 \(\lambda\) 的作用？

**答：**

\[
\delta_t=r_t+\gamma V(s_{t+1})-V(s_t),\quad
\hat A_t=\sum_{l\ge0}(\gamma\lambda)^l\delta_{t+l}
\]

\(\lambda=0\) 接近一步 TD，低方差高偏差；\(\lambda\to1\) 接近长 return，高方差低偏差。

**追问：** terminal、truncated、padding 三种位置如何处理 bootstrap 与 mask？

### 9. importance sampling 为什么出现？

**答：** 当数据来自行为策略 \(\pi_b\)，却要估计目标策略 \(\pi_\theta\) 的期望时，用 \(\rho=\pi_\theta/\pi_b\) 校正分布差异。ratio 极端时方差大，因此 PPO 裁剪，异步训练还要限制样本陈旧度。

**追问：** 为什么实现里用 `exp(new_logp - old_logp)`，而不是先算两个概率再除？

---

## C. RLHF 与 PPO

### 10. 讲完整 RLHF PPO 流程。

**答：** 先做 SFT；用偏好对训练 reward model；从 prompt 采样回答；RM 给 sequence reward，并可加 reference KL 惩罚；critic 估值并用 GAE 得 advantage；actor 用 PPO clipped objective 更新，critic 回归 return；更新若干 epoch 后重新 rollout。

**追问：** policy、old policy、reference policy、critic、reward model 各自是否训练？

### 11. PPO clipped objective 为什么取 min？

**答：**

\[
L=\mathbb E[\min(r_tA_t,\operatorname{clip}(r_t,1-\epsilon,1+\epsilon)A_t)]
\]

`min` 取较保守的收益下界。正 advantage 时阻止概率涨得过多；负 advantage 时阻止概率降得过多。只背“限制 ratio”不够，必须根据 advantage 符号解释。

**追问：** \(A=-2,r=1.4,\epsilon=0.2\) 时两项和最终 objective 各是多少？答案为 \(-2.8,-2.4,-2.8\)。

### 12. PPO 中 KL 与 clip 是不是重复？

**答：** 不完全重复。clip 约束 current 相对采样 old policy 的单次更新；对 reference 的 KL 保持模型接近初始对齐策略。二者比较对象和目的不同。

**追问：** approximate KL(current, old) 与 reference KL 分别如何监控？

### 13. PPO 的主要问题是什么？

**答：** 需要 actor、critic、reference、reward 多模型协同；critic 训练不稳；on-policy rollout 昂贵；超参和系统复杂；sequence reward 到 token 的归因较粗；RM 还可能被利用。

**追问：** GRPO 具体省掉了什么，又引入了什么问题？

### 14. 为什么要加 reference KL？

**答：** 限制策略远离 SFT 模型，降低语言退化、reward hacking 和灾难性偏移风险。它不是越小越好；过强会阻止学习，过弱则约束不足。

**追问：** KL 放在 reward 中与放在 loss 中有什么实现差异？

### 15. PPO 训练中哪些指标最关键？

**答：** 任务 reward/独立评测、reference KL、approx KL、clipfrac、entropy、advantage 分布、value loss/explained variance、gradient norm、response length，再加 rollout 与训练吞吐。

**追问：** reward 上升、KL 平稳、独立评测下降意味着什么？

---

## D. Reward Model 与 DPO

### 16. Reward Model 如何训练？

**答：** 对同一 prompt 的 chosen/rejected 回答得到标量 \(r_c,r_r\)，用 Bradley–Terry 概率 \(P(c\succ r)=\sigma(r_c-r_r)\)，损失为 \(-\log\sigma(r_c-r_r)\)。只要求相对排序，不要求 reward 绝对校准。

**追问：** 偏好不一致、长度偏置和标注噪声如何处理？

### 17. DPO 的核心损失是什么？

**答：**

\[
L_{DPO}=-\log\sigma\left(\beta\left[
\log\frac{\pi_\theta(y_w|x)}{\pi_{ref}(y_w|x)}-
\log\frac{\pi_\theta(y_l|x)}{\pi_{ref}(y_l|x)}
\right]\right)
\]

它直接提高 chosen 相对 rejected 的隐式奖励差，不显式训练 RM，也不做在线 rollout。

**追问：** 为什么 DPO 不是普通二分类？reference 在其中起什么作用？

### 18. DPO 中 beta 大小如何理解？

**答：** beta 缩放相对 log-ratio 的偏好强度，并与隐式 KL 正则联系。具体“beta 越大越保守还是越激进”的口头结论容易受实现/公式约定影响，最安全是先写所用公式，再分析 logit 和梯度。

**追问：** 用实际 trainer 的定义核对，不要脱离公式背结论。

### 19. chosen 和 rejected 的 log-prob 都下降，DPO 还能有效吗？

**答：** DPO 优化的是两者相对 margin；只要 chosen 相对 rejected 改善，损失可下降。但二者都下降可能暴露长度、归一化或整体似然退化问题，因此还要监控 chosen/rejected reward、margin、长度与 SFT/NLL 指标。

**追问：** 何时加入 NLL/SFT 正则？

### 20. DPO 数据为什么最好贴近当前策略分布？

**答：** 若偏好对来自差异很大的旧策略或外部模型，训练面对的负样本分布与部署策略不匹配，可能学到容易但无用的区分。可迭代地从当前 checkpoint 采样、标注偏好再训练。

**追问：** rejection sampling 在构建偏好对时有什么作用和偏差？

### 21. PPO、DPO、GRPO 如何选择？

**答：** 有高质量离线偏好对且希望流程简单，先 DPO；有在线环境/RM 且需要持续探索，PPO；有可验证 reward、同 prompt 可采多个答案且想省 critic，GRPO。最终选择还取决于预算、环境、分布更新和安全约束。

**追问：** Agent 多轮任务为什么通常不能只靠静态 DPO？

---

## E. GRPO、RLVR 与 2025–2026 新方法

### 22. GRPO 的完整数据流？

**答：** 每个 prompt 从 rollout policy 采样 \(G\) 个回答；verifier/RM 给 reward；组内中心化并可标准化得到 relative advantage；对回答 token 计算 current/old ratio 与 clipped objective；加 reference KL；按 token 或 sequence 聚合后更新 policy。

**追问：** 训练时的 \(\pi_\theta\)、\(\pi_{old}\)、\(\pi_{rollout}\)、\(\pi_{ref}\) 是否总是相同？

### 23. GRPO 与 PPO 的关键区别？

**答：** GRPO 用同 prompt 多答案的组内 reward 作为 baseline，通常不训练 critic；PPO 使用 critic/GAE 估计 token-level advantage。GRPO 省显存和系统复杂度，但多采样昂贵，组内同分、长度偏置和粗粒度信用分配更突出。

**追问：** “GRPO 的 GAE 怎么算”该如何纠正？标准 GRPO 通常没有 critic，也不需要 GAE。

### 24. 为什么组内减均值有效？

**答：** 同一 prompt 的绝对难度被抵消，保留回答之间的相对好坏，相当于 prompt-conditioned baseline。这样无需单独学习 value model。

**追问：** 只有两个样本且 reward 很接近时，估计会有什么问题？

### 25. 全对组/全错组为什么学不到？

**答：** 组内 reward 方差为零，中心化后的 advantage 全为零。标准化也不能凭空创造学习信号。可做难度课程、过滤/重采样、混入过程奖励、扩大组或跨样本 baseline，但要注意改变目标分布。

**追问：** 只删除全错题会带来什么选择偏差？

### 26. group std 标准化有什么隐患？

**答：** 小方差组会被放大，组大小较小时 std 估计噪声大，不同难度 prompt 的权重发生变化。可只中心化、使用稳定尺度、按 batch 归一化或采用 Dr.GRPO/RLOO 类思路。

**追问：** epsilon 只能防数值除零，能解决统计偏差吗？不能。

### 27. DAPO 相比朴素 GRPO 解决什么？

**答：** DAPO 的代表性改动包括 Clip-Higher、动态采样、token-level policy-gradient loss 和 overlong reward shaping，分别针对探索受限、全同分无梯度、长短回答权重及截断样本。

**追问：** 每个改动对应哪条监控指标？

### 28. GSPO 为什么使用 sequence-level ratio？

**答：** GSPO 将重要性采样单位与序列级 reward/advantage 对齐，缓解 token-level ratio 噪声，尤其针对 MoE 中 rollout 与训练路由差异导致的训练不稳定。

**追问：** sequence ratio 如何处理长度归一化？为什么不能直接连乘概率？

### 29. 什么是 RLVR？

**答：** Reinforcement Learning with Verifiable Rewards，使用规则、单元测试、数学答案检查器或环境状态等可验证信号训练。优点是信号客观且可扩展；局限是覆盖范围、验证器漏洞和稀疏信用分配。

**追问：** 开放式写作没有唯一答案时，如何组合 RM、规则与人评？

### 30. reward hacking 如何发现？

**答：** 比较训练 reward 与隐藏评测/人评；检查长度、格式、工具调用与 reward 相关性；对高分轨迹人工抽样；构造 verifier 对抗样本；分开记录奖励各分项。

**追问：** 修复 verifier 后为什么不能直接沿用旧 rollout？

### 31. on-policy distillation 与普通蒸馏有何不同？

**答：** 学生从自己的当前策略采样，教师对这些 on-policy token 提供稠密分布监督。相比离线蒸馏，它减少训练—部署状态分布错配；相比稀疏 RLVR，信号更稠密，但依赖强教师并增加推理成本。

**追问：** 它与 SFT、RL 的 state distribution 有何区别？

---

## F. Agentic RL 与训练系统

### 32. 工具返回为什么通常不算 policy loss？

**答：** 工具返回由环境产生，不是策略采样的动作；把它当目标会让模型学习复述环境。它应进入后续上下文，但 response/loss mask 默认只覆盖 assistant 生成 token。

**追问：** 如果另一个可训练 Agent 产生 observation 呢？需要为对应策略单独计算 loss。

### 33. trajectory reward 如何分配给多轮动作？

**答：** 基线方案是整轨迹广播；更细方案包括 turn return/GAE、过程 verifier、同状态多分支比较和回溯 critic。选择取决于是否有中间可验证信号、能否训练稳定 critic和采样预算。

**追问：** 如何避免过程 reward 鼓励冗余工具调用？

### 34. 多轮 Agent 的 rollout 长尾怎么处理？

**答：** 设置步数/成本预算；按长度动态 batching；异步 worker；partial rollout 暂存与恢复；慢工具隔离和超时；监控 P95/P99。异步后必须限制 policy lag 并记录 behavior version。

**追问：** partial rollout 恢复至少要保存哪些状态？

### 35. policy lag 是什么，怎么监控？

**答：** 轨迹由旧版本 behavior policy 生成，而 trainer 已更新到新版本。记录样本版本差/年龄、current-behavior log-ratio 分布、clipfrac 和有效样本率；限制最大版本差或丢弃过旧样本。

**追问：** 权重同步更频繁为什么也可能降低吞吐？

### 36. reward 上升但真实成功率下降怎么排查？

**答：** 先冻结配置保留异常样本；检查 reward 分项、长度/成本相关性、verifier 漏洞、数据泄漏和 RM 分布外问题；用隐藏测试、人评和环境最终状态复核；修复后做单变量对照。

**追问：** 为什么只调低学习率通常治标不治本？

### 37. loss NaN 的排查顺序？

**答：** 检查原始 reward、组 std、advantage、log-prob 和 mask 分母；再看 `exp(log-ratio)`、softmax 稳定性、混合精度、梯度范数和异常长度。保存首个异常 batch，而不是只看平均曲线。

**追问：** 全 padding response 会在哪一步产生 NaN？

### 38. 说说 TRL、verl、slime、OpenRLHF 的差别。

**答：** TRL 适合快速验证算法；verl/OpenRLHF 更强调分布式 actor/critic/reward/rollout 编排；slime 强调可扩展生成与训练解耦、Agent rollout 定制。回答时必须落到自己用过的 worker、资源放置、权重同步和数据结构。

**追问：** 不允许只背框架宣传语，请画出一次 batch 的数据流。

### 39. 如何估算训练显存？

**答：** 分参数、梯度、master weight、优化器状态、激活、临时 buffer 和碎片；再乘上 actor/critic 等模型角色。明确精度与 ZeRO/FSDP stage 后估算，不能只按参数量乘 2 bytes。

**追问：** rollout 阶段为什么还要单独估 KV cache？

### 40. 设计一个代码 Agent 的 RL 方案。

**答：** 先 SFT 学会编辑/执行格式；在隔离仓库中多轨迹 rollout；以隐藏测试和仓库最终状态为 outcome reward，格式、成本、安全为辅助；assistant action token 算 loss，工具输出只进上下文；从 trajectory GRPO 建基线，再做失败类型与 turn credit；评测 pass rate、回归率、工具成本和越权率；禁止修改测试并审计文件 diff。

**追问：** 如果测试运行十分钟，如何降低 rollout 成本？

---

## G. 项目与行为题

### 41. 没做过 RL 项目，如何回答“你的 RL 经验”？

**答：** 不虚构生产经验。说明完成了哪些可复现实验：从 tabular TD、REINFORCE/GAE 数值测试，到 DPO/GRPO 损失手写，再到一个小模型可验证任务；给出代码、曲线、故障记录和消融。重点是展示完整闭环和边界认知。

### 42. 你做的实验为什么能证明算法有效？

**答：** 需要固定数据与种子，设置 SFT/无 RL 基线，只改变一个因素，报告均值和方差，使用独立验证集，并检查 reward 与真实任务指标一致。

### 43. 训练失败时最有价值的记录是什么？

**答：** 首个异常 batch、代码和配置版本、数据/环境版本、关键张量分布、修复前后单变量对照。失败复盘比“最后跑通了”更能证明工程能力。

### 44. 为什么选择 RL 岗？

**答：** 将个人经历连接到“序列决策、可验证反馈和系统闭环”，说清自己喜欢的问题类型；再用具体学习与项目证据支撑。不要只说行业热门或薪资高。

### 45. 遇到论文与框架实现不一致怎么办？

**答：** 先固定符号和 reduction，做最小数值例子；读官方实现与测试；打印逐 token 张量；确认 mask、长度归一化、KL 位置和 old/reference 语义；最后记录差异是公式等价、实现选择还是 bug。

---

## 口述评分标准

每题按 0～3 分：

- **0 分**：完全不会；
- **1 分**：能说关键词，公式或因果错误；
- **2 分**：定义、公式和基本直觉正确；
- **3 分**：还能回答追问、做数值例子、联系指标与工程。

45 题共 135 分。建议门槛：

- 第 10 天：70 分；
- 第 20 天：100 分；
- 第 28 天：115 分以上，且 P0 题无 0 分。
---

原始讲义与可运行材料：[GitHub 源文件](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/AI%E7%AE%97%E6%B3%95/%E5%BC%BA%E5%8C%96%E5%AD%A6%E4%B9%A0/09_%E9%9D%A2%E7%BB%8F%E9%A2%98%E5%BA%93%E4%B8%8E%E7%AD%94%E6%A1%88%E5%8D%A1.md)。
