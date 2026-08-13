---
title: "大模型强化学习从零到面试（09）：面经题库与 70 张答案卡"
description: "按 2025–2026 公开实录归纳的 70 张答案卡：经典地基、PPO/DPO/GRPO、R1 管线、MoE、Agentic RL、系统与前沿。"
date: 2026-08-13
tags:
  - ai
  - llm
  - rl
  - interview
featured: false
draft: false
lang: zh-CN
series: llm-rl-interview
seriesOrder: 10
---

> 本文是《大模型强化学习：从零到面试》专题第 09 章的发布版，核验日期 2026-08-13。配套零依赖参考实现与自动测试托管在 GitHub 仓库 [llm-algo-job-notes](https://github.com/keepkeen/llm-algo-job-notes)。

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

**2026-08-13 增量（第 46–63 题）**：基于新一轮实录检索补齐——[腾讯 WXG 大模型面经](https://www.nowcoder.com/discuss/891322059656052736)（手撕 PPO/AdamW、MDP 折扣计算）、[阿里一面 GRPO 深挖复盘](https://yunpan.plus/t/23865-1-1)（loss 逐项、ε 取值、reward hacking）、[AgentGuide 公司案例集](https://github.com/adongwanai/AgentGuide/blob/main/docs/04-interview/12-company-interview-cases.md)（汇编级：RM vs critic、KL 的 k1/k2/k3、GRPO×MoE、SFT vs RL、rollout 与卡数等在多家反复出现）。增量卡对应的正文详解见 04 章（KL 估计器、交叉熵）、05 章（DPO 家族、拒绝采样）、06 章（R1 管线、MoE、CISPO）。

**2026-08-13 第二轮增量（第 64–70 题，K 组）**：前沿与跨界——多模态 RL（Visual-RFT/IoU 奖励，CV 背景候选人的主战场）、熵坍缩机制（Clip-Cov/KL-Cov）、RLVR 边界争议（pass@k/spurious rewards）、生成式 RM（DeepSeek-GRM/SPCT）、GiGPO 步级信用、AReaL 异步系统、RL Scaling（ScaleRL）。正文详解见 [12 章](/blog/llm-rl-12-frontier/)与 06/07/08 章对应小节。

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

## H. KL、数值与角色辨析（2026-08 增量）

### 46. 写出 KL 的三种估计器 k1/k2/k3，各自的偏差、方差和使用场景。【P0，实录：AgentGuide 案例 2、智谱面经】

**答：** 估计 $D_{KL}(\pi_\theta\|\pi_{ref})$，样本来自 $\pi_\theta$，记 $r=\pi_{ref}/\pi_\theta$：$k_1=-\log r$，无偏、方差高、可为负；$k_2=\frac12(\log r)^2$，有偏（分布接近时近似）、方差低、恒正；$k_3=(r-1)-\log r$，无偏（$r-1$ 是期望为零的控制变量）、方差比 $k_1$ 低、恒非负。PPO 经典实现把 $k_1$ 放进逐 token reward；GRPO 把 $k_3$ 直接放进 loss。

**追问：** $k_3$ 作为 loss 反传时，梯度还是反向 KL 的梯度吗？（不严格是——值无偏 ≠ 梯度无偏；on-policy 下 "$k_2$ as loss" 才与 "$k_1$ in reward" 梯度等价，详见 04 章。）

### 47. 交叉熵和 KL 什么关系？PPO 的 KL 惩罚能换成交叉熵吗？分类任务能用 KL 吗？【实录：AgentGuide 案例 2】

**答：** $H(P,Q)=H(P)+D_{KL}(P\|Q)$。分类里 label 分布固定（one-hot 时 $H(P)=0$），优化 $Q$ 时 CE 与 KL 梯度相同，所以分类可以用 KL、等价于 CE。PPO 里不能换：惩罚项是 $KL(\pi_\theta\|\pi_{ref})$，$\pi_\theta$ 自身在变——KL 的最优点是 $\pi_\theta=\pi_{ref}$，而 CE $H(\pi_\theta,\pi_{ref})$ 的最优点是把全部概率压到 ref 的众数上，会额外降熵、推向模式坍缩。

**追问：** forward KL 与 reverse KL 的 mode-covering / mode-seeking 直觉分别对应什么？

### 48. KL "放进 reward" 和 "作为 loss" 在实现上差在哪？【P1，实录：百度二面 KL 位置】

**答：** 放进 reward：KL 项 detach，作为逐 token reward 的一部分进入 return/advantage，梯度经 policy gradient 间接传播，且会影响 credit assignment（GAE 沿时间传播它）。作为 loss：独立正则项，梯度直接穿过当前 log-prob（若用 $k_3$ 还穿过 ratio），不进 advantage。两种写法不能同时叠加，监控口径也不同：前者看 reward 分解，后者看 KL loss 曲线。

**追问：** DAPO 公开配方去掉了 KL，什么条件下你敢去？（reward 可验证、能力回退有独立测试守门。）

### 49. 为什么有了 Reward Model 还需要 Critic？【P0，实录：AgentGuide 案例 2/13"PPO 为什么有 reward model 又有 critic model"】

**答：** 两者语义不同。RM 代表**外部目标**：评"这条回答好不好"，由偏好/规则训练，在一轮 PPO 中通常冻结，给的是（多在终点的）reward。Critic 代表**当前策略的期望回报** $V^\pi(s_t)$：给每个前缀估值，用来构造 advantage 降方差、做 token 级 credit；policy 一变它的 target 就变，必须持续训练。一句话：RM 定义"什么是好"，critic 估计"照现在这个策略走下去能拿多少"——前者是目标，后者是 baseline。

**追问：** GRPO 用什么替代 critic？（同 prompt 组内均值＝prompt 条件 baseline。）RM 和 critic 能共享 backbone 吗？（工程可以，学习语义不同。）

### 50. 现场计算：动作 A 每步 reward 1；动作 B 前 3 步 0、之后每步 2。γ 多大时 B 更优？【实录：WXG 二面"算 MDP 的 γ 阈值"】

**答：** $V_A=\sum_{t\ge0}\gamma^t=\frac1{1-\gamma}$；$V_B=\sum_{t\ge3}2\gamma^t=\frac{2\gamma^3}{1-\gamma}$。$V_B>V_A\iff 2\gamma^3>1\iff\gamma>2^{-1/3}\approx0.794$。套路：写几何级数→求和→解不等式→用 $\gamma\to0$（短视选 A）和 $\gamma\to1$（远视选 B）做极限自检。

**追问：** 把"前 3 步"换成"前 k 步"，阈值怎么变？（$2\gamma^k>1$，$k$ 越大要求 $\gamma$ 越接近 1。）

## I. R1 管线与方法演进（2026-08 增量）

### 51. DeepSeek R1-Zero 是怎么训出来的？奖励怎么设计？【P0，实录：DeepSeek 专项、字节 26 届"R1 的奖励与两阶段"】

**答：** V3-Base 不做 SFT 直接大规模 GRPO。奖励纯规则、两项相加：accuracy reward（数学 exact match / 代码测试通过）+ format reward（推理包在 think 标签内）；刻意不用神经 RM，防大规模 RL 下被 hack。训练中涌现反思、自我验证、思考链变长的"aha moment"。遗留问题：可读性差、语言混杂。

**追问：** 为什么规则奖励下还能长出新行为？（组内相对优势持续放大"多想一步→更容易对"的策略。）

### 52. 讲 R1 的完整四阶段管线。【P0】

**答：** ① 冷启动 SFT：数千条长 CoT 修可读性、给 RL 稳定起点；② 推理导向 RL：同 R1-Zero 规模，奖励加语言一致性项（CoT 目标语言词占比）；③ 拒绝采样+SFT：用 RL checkpoint 采样，规则+生成式 RM 过滤，得约 60 万推理样本，混约 20 万非推理样本，**回到 V3-Base** 重新微调；④ 全场景 RL：推理用规则奖励、通用用 RM 评有用/无害。口诀"SFT→RL→SFT→RL；能规则就规则"。

**追问：** 阶段③为什么回底座重训而不是继续 RL checkpoint？冷启动到底加速了什么？（详见 06 章 §7.3。）

### 53. 拒绝采样在后训练里有哪几种用法？有什么偏差？【实录：AgentGuide 案例 2"详细讲一下拒绝采样"】

**答：** 三个用法：采 N 条筛最优做 SFT 数据（R1 阶段③约 60 万条）；组内取高低分构造 DPO 偏好对（天然贴近当前策略分布）；推理时 Best-of-N 作"不训练的上限"对照。偏差：评分来自 RM 时会反复选中 RM 的偏好（长度/格式），放大其偏置，且保留分布比原分布窄——过滤规则要审计、周期性人工校准。

**追问：** Best-of-N 和 RL 的关系？（BoN 是推理时搜索，不改参数；RL 把这种搜索的收益内化进策略。）

### 54. CISPO 相比 GRPO/PPO 改了什么？为什么？【P1，投 MiniMax 前 P0】

**答：** PPO/GRPO 的 min+clip 让 ratio 出界的 token 梯度为零，而这些常是低概率的推理"分叉"词（Wait/However/Recheck），恰是 reasoning RL 最需要学的。CISPO（MiniMax-M1）不裁 token 更新、改裁 IS 权重：$-\mathbb E[\operatorname{sg}(\operatorname{clip}(\rho))\cdot\hat A\cdot\log\pi_\theta]$——裁剪后的权重 detach 当系数，梯度全部经 $\log\pi_\theta$，每个 token 都保留梯度；通常只设较宽单侧上界，沿用组相对优势和 token-level loss。

**追问：** 去掉 stop-gradient 会怎样？（梯度穿过 ratio，方差重新变大。）与 DAPO Clip-Higher 的本质区别？（放宽阈值 vs 出界不丢梯度。）

### 55. GRPO 训 MoE 为什么容易崩？怎么救？【P0，实录：DeepSeek 专项二面、字节 Agentic RL】

**答：** 五步机制链：路由是离散决策→参数更新一步或训推两引擎（vLLM/SGLang vs Megatron）的算子精度差异就能让同 token 换专家→新旧/训推 log-prob 跳变→token ratio 掺入结构噪声、clip 频繁触发→有效梯度被裁掉、噪声留下，reward 崩塌。修复三类：Routing Replay（训练时重放 rollout 路由，费显存限容量）；GSPO/GMPO（序列级 ratio，对 token 级抖动不敏感，Qwen3 路线）；TIS/IcePop（对训推分布差做重要性修正/屏蔽漂移 token）。

**追问：** dense 模型为什么没这个问题？（引擎差异只是连续的浮点小量，MoE 的路由把它放大成离散跳变。）

### 56. 蒸馏和直接 RL，小模型该用哪个？【实录：多家问"R1 对小模型的结论"】

**答：** R1 论文的对照结论：用 R1 的 80 万样本**蒸馏**小模型，好于对同规模小模型直接做大规模 RL——小模型自主探索出推理模式的能力有限，大模型发现的模式可迁移。但蒸馏封顶于教师；蒸馏后再做 RL 还能继续涨。回答要报口径：这是该论文设定下的结论，不是普适定律。

**追问：** 什么时候小模型必须自己 RL？（领域没有强教师、目标与教师分布冲突、蒸馏数据拿不到。）

## J. 选型与系统追问（2026-08 增量）

### 57. 什么场景用 SFT，什么场景用 RL？【P0，实录：AgentGuide 案例 9/10】

**答：** 有高质量示范、目标是格式/风格/知识注入→SFT，便宜稳定，但只会模仿、无法超越数据，也修不了"自己犯错后的状态"。信号只有偏好或可验证结果、目标不可微（成功率/通过率）、需要在自身分布上纠错→RL。工程顺序几乎总是先 SFT 定格式再 RL 提能力（R1 冷启动同理）。偏好对易得而环境难建→中间态选 DPO。

**追问：** SFT 数据 scaling 会遇到什么天花板？（示范质量上限与 exposure bias——训练见的是标注前缀，部署见的是自己的前缀。）

### 58. RL 训练为什么不稳定？既然不稳定业界为什么还在用？【实录：AgentGuide 案例 9】

**答：** 不稳定的四个来源：目标在动（policy/critic/数据分布同步漂移）、信号有噪（RM 偏差、稀疏奖励、组内零方差）、系统引入偏差（policy lag、训推不一致）、超参敏感（clip/KL/LR 耦合）。仍然用它，因为它做了 SFT 做不到的三件事：优化不可微指标、超越示范数据上限（R1-Zero 是证据）、在模型自己的错误分布上学习。所以答案不是"忍受不稳定"，而是配套监控（KL/entropy/clipfrac/独立评测）和保守更新把它工程化。

### 59. PPO/GRPO 训完后模型在分布外任务上崩了，怎么防？【实录：美团北斗二面"防 OOD 崩塌"】

**答：** 先定义"崩"：领域内 reward 涨、held-out 通用能力/安全回退。手段分层：训练中——reference KL 锚定、混入通用 SFT/偏好数据（R1 阶段③的做法）、reward 加惩罚项防钻空子；训练外——每个 checkpoint 跑独立能力回归套件（通用知识+安全+原始任务），按综合分选点而不是按训练 reward 选点；必要时降低更新步数或用 LoRA 限制漂移幅度。

**追问：** 为什么只看训练 reward 选 checkpoint 危险？（reward hacking 时训练分数与真实质量背离。）

### 60. rollout 数量、batch size 和卡数是什么关系？真实采样数一定等于 rollout 数吗？【实录：AgentGuide 案例 2】

**答：** 生成通常是主要瓶颈：rollout 吞吐随推理侧卡数近似线性，但受最长样本拖尾（长尾 decode）、KV 显存和权重同步开销折损，不是严格线性。train batch 越大单步越稳但样本越陈旧（policy lag 加重），要和更新频率一起调。真实进入训练的样本数通常**小于** rollout 数：全对/全错组被过滤或补采（动态采样）、超长截断、格式非法、verifier 失败、去重都会消耗样本——所以"有效样本率"是必须监控的指标。

**追问：** 给定 N 张卡，rollout 与 train 怎么分配？（按两侧吞吐匹配原则调整 colocate/分离比例，常见生成占大头。）

### 61. 用 GRPO 提升 Function Calling，除了结果奖励还能设计哪些过程奖励？【实录：AgentGuide 案例 13 二面原题】

**答：** 可加：输出结构合法（JSON/schema 可解析）、工具名选择正确、参数字段级匹配率、多余/重复调用惩罚（次数与 token 成本）、失败后的恢复行为（重试/换工具/澄清）、中间环境断言（数据库或沙箱 checkpoint 达成）。原则：过程奖励权重要小并随训练退火，否则模型学会"表演过程"（凑格式、刷调用）而不是完成任务；终局 reward 始终是主项。

**追问：** 过程奖励诱导冗余调用怎么发现？（工具调用次数与 reward 的相关性监控+高分轨迹抽查。）

### 62. 数据难度怎么排？课程学习在 RLVR 里怎么做？【实录：滴滴样本】

**答：** 二元奖励下组内方差在成功率 50% 附近最大——信号最足的是"会一半"的题。做法：按当前模型的 pass rate 给 prompt 分桶，采样集中在约 20%–80% 区间，随能力移动窗口；线上等价形式就是动态采样（过滤零方差组）。风险：只训中间难度会造成分布偏移与遗忘，需周期性回灌全分布并在全难度评测上验收。

**追问：** 难度标定用旧模型的 pass rate，模型进步后标定过期怎么办？（周期性重估或在线以组方差为信号。）

### 63. 面试官问"你们 GRPO 的 ε 取多少、为什么"，怎么答？【实录：阿里一面原题】

**答：** 报默认再报理由：PPO 论文与主流实现默认 $\epsilon=0.2$（DAPO 将上界放宽到约 0.28 以保探索），它限制单步 ratio 在 [0.8,1.2]——经验平衡点：太小则有效梯度被裁、学得慢；太大则单步跨度大、容易被噪声带崩。正确姿势是把 ε 和 clipfrac 联动回答：clipfrac 长期高于约 20%–30% 说明更新过猛（调小 LR/epoch 或查 policy lag），长期接近 0 说明约束空转。

**追问：** 上下界为什么可以不对称？（正优势方向探索受限更伤，Clip-Higher 只放宽上界。）

## K. 前沿与跨界（2026-08 第二轮增量）

### 64. 怎么把 GRPO/RLVR 用到视觉任务上？奖励怎么设计？【多模态岗 P0，CV 背景必备】

**答：** Visual-RFT 范式：VLM 对每个图文输入采样一组带推理的回答，用任务特定可验证奖励做 GRPO。检测任务用 IoU 奖励——预测框按置信度排序、与 GT 匹配算 IoU（低于阈值记 0），总奖励 = IoU 项 + 置信度项 + 格式项；分类用类别对错。核心思想是**把评测指标直接变成奖励**：连续的 IoU 比数学 0/1 信号更细。卖点是数据效率：one-shot 下 RFT +24.3% 而 SFT −4.3%。

**追问：** 图像 token 算不算 policy loss？（不算，observation 语义。）给异常检测设计一个？（像素级 PRO/区域 IoU + 类别项 + 格式项；主动说防钻空子：多框刷召回用置信度与冗余框惩罚制衡——详见 12 章 §1.3。）

### 65. 熵为什么会单调下降？怎么精准控熵？【P1】

**答：** 机制：熵变化由"动作概率与 logit 更新量的协方差"驱动，policy gradient 下更新量正比于 advantage——高概率高优势 token 降熵、低概率高优势 token 升熵，实测协方差长期为正所以熵单调降。经验定律 $R=-a\,e^H+b$：性能是拿熵换的，熵耗尽即到天花板。精准控制：Clip-Cov（随机 detach 少量最高协方差 token 的梯度）与 KL-Cov（对协方差 top-k% token 加 KL），只治"元凶"token。

**追问：** 为什么全局 entropy bonus 效果差？（无差别鼓励随机性，会伤确定性输出；协方差视角只干预真正压熵的少数 token。）与 Clip-Higher 的关系？（都为保探索，Clip-Higher 动 ratio 上界，Cov 系动 token 选择。）

### 66. "RLVR 是让模型更聪明还是只是采样更高效"？【开放题，答题模板】

**答：** 双面证据：质疑方——pass@1 涨但大 k 下 base 反超、RLVR 路径已在 base 分布内、边界随训练收窄、随机/格式奖励也能涨 Qwen（跨家族不复现，疑似污染）；支持方——CoT-pass@k 口径下增益更真实、agentic/工具任务上有真实边界扩展。共识：增益主体是"搜索压缩"。答题落点是给判别工具：pass@k 曲线、去污染集复测、跨模型家族、随机奖励对照、蒸馏基线对比——展示评测素养而不是站队。

**追问：** 对你的训练目标意味着什么？（目标是单次成功率/成本→压缩已经值钱；要新能力→蒸馏+RL 组合并做熵保护。）

### 67. 生成式 RM（DeepSeek-GRM/SPCT）与 scalar RM 差在哪？【P1】

**答：** scalar RM 输出一个分，吞吐高但不可解释、难扩展。GRM 生成"评分原则→批评→1–10 分"，SPCT 用拒绝式微调 + 规则在线 RL 教会模型按输入自适应生成原则；推理时并行采样 k 份判决投票、meta RM 过滤低质判决——27B 模型 Vote@32 可比肩大一个量级的模型，即 **reward 侧的 test-time scaling**。代价：打分贵、判决有方差、judge 类偏置仍在。

**追问：** 在线 rollout 打分为什么常仍用 scalar？（百万级打分吞吐要求；常见组合是 scalar 在线 + GRM 离线审计/造数据。）

### 68. 多轮 Agent 的 step-level credit 怎么做到 critic-free？【Agent 岗 P0】

**答：** GiGPO 双层组：episode 级 = 标准 GRPO 轨迹组对比（宏观优势）；step 级 = 锚点状态分组——哈希识别不同轨迹中重复出现的环境状态，把同一状态出发的动作聚组、按后续 return 组内对比（微观优势），最终 $A=A_E+\omega A_S$。免 critic、零额外 rollout（哈希是"免费午餐"），ALFWorld +12%/WebShop +9% 超 GRPO。前提：状态可哈希且跨轨迹重复（网页/游戏/工具环境成立，开放对话不成立）。

**追问：** 状态不重复怎么办？（退回分支采样或过程 verifier，见 07 章方法 C/D。）ROLL 里怎么配？（`adv_estimator: gigpo`，与轨迹级 StarPO 对应两种范式。）

### 69. 异步 RL 怎么在吞吐和稳定之间取舍？（AReaL 为例）【P1】

**答：** 全异步 = rollout 与训练彻底解耦：可中断 rollout worker + 经验缓冲 + 并行奖励服务，同卡数下 2.57× 于最好的同步系统。稳定性三件套：样本版本号追踪、staleness 上限（AReaL 实验口径：8 个版本内无性能损失）、staleness-aware PPO + 超龄样本过滤。回答时报三个监控：版本差分布、current/behavior ratio、有效样本率。

**追问：** 权重同步为什么不是越频繁越好？（同步会抢带宽、打断生成，吞吐反而降——与第 35 题 policy lag 同源。）

### 70. 怎么判断一个 RL 改进"值得上规模"？【P1，投 Seed"RL Scaling"方向 P0】

**答：** ScaleRL 框架：小算力跑到拐点附近，用 sigmoid $R_C=R_0+(A-R_0)/(1+(C_{mid}/C)^B)$ 拟合，把改进分解为动天花板 $A$ 还是动效率 $B$。结论：损失类型（CISPO）、FP32 logits 头、数据过滤抬天花板；聚合方式、优势归一化、课程、off-policy 方案主要改效率。动 $A$ 的改进才值得抢算力；该方法已被验证能从小规模外推预测 10 万 GPU 时的最终表现。

**追问：** 为什么用 sigmoid 不用幂律？（pass rate 有界饱和。）和熵定律什么关系？（$R=-a e^H+b$ 同为"可预测天花板"，熵耗尽即到顶，所以熵管理是 scaling 前提。）

---

## 口述评分标准

每题按 0～3 分：

- **0 分**：完全不会；
- **1 分**：能说关键词，公式或因果错误；
- **2 分**：定义、公式和基本直觉正确；
- **3 分**：还能回答追问、做数值例子、联系指标与工程。

70 题共 210 分。建议门槛：

- 第 10 天：105 分；
- 第 20 天：155 分；
- 第 28 天：180 分以上，且 P0 题无 0 分（P0 增量卡：46、49、51、52、55、57；多模态岗加 64，Agent 岗加 68，Seed RL Scaling 方向加 70）。
