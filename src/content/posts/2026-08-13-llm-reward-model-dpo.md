---
title: "Reward Model、DPO 与偏好学习"
description: "从 Bradley–Terry 到 DPO 推导，解释 beta、reference、长度偏置与训练退化，附拒绝采样与 IPO/KTO/ORPO/SimPO 家族取舍。"
date: 2026-08-13
updatedDate: 2026-08-29
tags:
  - reinforcement-learning
  - llm
  - interview
lang: zh-CN
draft: false
series: llm-reinforcement-learning-interview
seriesOrder: 6
---
## 1. 偏好数据长什么样

最常见记录是三元组：

$$
(x,y_w,y_l),
$$

$x$ 是 prompt，$y_w$ 是 preferred/chosen response，$y_l$ 是 rejected response。

数据来源可包括：

- 人工对同一 prompt 的候选排序；
- 规则或单元测试产生的偏好；
- LLM judge/RLAIF；
- 当前/历史 policy rejection sampling；
- 线上隐式反馈，但要处理曝光、位置和选择偏差。

偏好对不是“一个好回答 + 一个随机坏回答”就够了。负样本太容易会让模型学到长度、格式、拒答词等 shortcut；太难且标签噪声大又会降低有效信号。

## 2. Bradley–Terry Reward Model

标量 Reward Model 对 $(x,y)$ 输出 $r_\phi(x,y)$。Bradley–Terry 假设：

$$
P(y_w\succ y_l\mid x)
=\sigma\left(r_\phi(x,y_w)-r_\phi(x,y_l)\right).
$$

pairwise loss：

$$
L_{RM}=-\mathbb E
\log\sigma\left(r_\phi(x,y_w)-r_\phi(x,y_l)\right).
$$

只要求相对差，不唯一确定绝对 reward offset；实际还要监控 score scale、校准、不同领域和长度切片。

### RM 训练流程

1. 同 prompt 采多个候选，避免 prompt 质量混入比较；
2. 定义 rubric 与 tie/不可比较规则；
3. 标注并检查 annotator agreement；
4. 按 prompt/user/task 去重后切 train/val/test；
5. 训练 sequence-level 或 token/process-level scorer；
6. 评估 pairwise accuracy、校准、OOD 和 shortcut；
7. 用独立人工/规则集验证 reward 与真实目标相关；
8. policy 优化后重新做 adversarial audit，因为输入分布变了。

## 3. scalar RM、process RM 与 verifier

| 类型 | 输出 | 优点 | 风险 |
|---|---|---|---|
| Outcome/scalar RM | 整条回答一个分 | 标注和部署简单 | credit 粗；易学长度/风格 shortcut |
| Process RM | 每一步或前缀分 | 更密集、可定位错误 | 步骤边界与标签昂贵；代理偏差 |
| Rule verifier | exact match、单测、约束结果 | 便宜、确定、可扩展 | 只覆盖可形式化目标；可能被 exploit |
| Generative judge | rubric + 解释/判决 | 能处理开放任务 | prompt、位置、自我偏好和一致性问题 |

过程监督不自动比结果监督好。它把“终局 credit 难”换成“中间步骤标签是否真实”的问题。[Let's Verify Step by Step](https://arxiv.org/abs/2305.20050) 是经典起点。

## 4. DPO 从哪里来

考虑 KL 正则化的 reward maximization：

$$
\max_\pi\
\mathbb E_{y\sim\pi(\cdot\mid x)}[r(x,y)]
-\beta D_{KL}(\pi(\cdot\mid x)\|\pi_{ref}(\cdot\mid x)).
$$

对固定 $x$，最优策略满足：

$$
\pi^*(y\mid x)=\frac{1}{Z(x)}
\pi_{ref}(y\mid x)\exp\left(\frac{r(x,y)}{\beta}\right).
$$

反解 reward：

$$
r(x,y)=\beta\log\frac{\pi^*(y\mid x)}{\pi_{ref}(y\mid x)}+\beta\log Z(x).
$$

代入 Bradley–Terry 的 reward difference，$\log Z(x)$ 抵消。用当前策略 $\pi_\theta$ 近似 $\pi^*$，得到 DPO loss：

$$
L_{DPO}=-\mathbb E
\log\sigma\left(
\beta\left[
\log\frac{\pi_\theta(y_w\mid x)}{\pi_{ref}(y_w\mid x)}
-
\log\frac{\pi_\theta(y_l\mid x)}{\pi_{ref}(y_l\mid x)}
\right]
\right).
$$

定义 policy margin 与 reference margin：

$$
\Delta_\theta=log\pi_\theta(y_w\mid x)-\log\pi_\theta(y_l\mid x),
$$

$$
\Delta_{ref}=log\pi_{ref}(y_w\mid x)-\log\pi_{ref}(y_l\mid x),
$$

则

$$
L_{DPO}=-\log\sigma\left(\beta(\Delta_\theta-\Delta_{ref})\right).
$$

## 5. DPO 实际数据流

1. policy 和 frozen reference 分别对 chosen/rejected 做 teacher forcing；
2. 只累加 completion token log-prob，mask prompt 与 padding；
3. 计算四个 sequence log-prob；
4. 得到 policy/reference margin 和 logit；
5. stable log-sigmoid 计算 loss；
6. 只更新 policy；
7. 监控 margin、偏好准确率、chosen/rejected log-prob、长度与 held-out 能力。

这是一种离线 preference optimization：训练时不需要在线 rollout、显式 RM 或 critic。但它的推导来自 KL-regularized RL，不能因此说“DPO 与 RL 完全无关”。

## 6. $\beta$ 怎么解释

在原始 KL 约束推导中，$\beta$ 与偏离 reference 的惩罚尺度相关；在 DPO loss 里它又缩放 preference logit 与梯度。

- 过小：logit 较平，单样本梯度不易饱和，但有效偏好信号尺度和相对 reference 的行为会改变；
- 过大：少量 margin 就让 sigmoid 饱和，标签噪声和 shortcut 影响可能加剧；
- 不能只说“$\beta$ 越大 KL 越强”而忽略具体实现、loss 缩放和数据分布。

最终要看隐式 reward margin、实际 policy-reference KL、偏好 win rate 和能力回退。

## 7. 为什么 chosen 和 rejected 可能一起下降

DPO 直接优化的是**相对 margin**，不是分别保证 chosen 概率上升、rejected 概率下降。

若

$$
\log\pi_\theta(y_w)\downarrow 1,
\qquad
\log\pi_\theta(y_l)\downarrow 3,
$$

则 $\Delta_\theta$ 仍增加，DPO loss 可能变好。再加上序列归一化、共享参数和概率质量重新分配，chosen log-prob 下降并不自动代表实现错。

但 chosen 持续大幅下降可能提示：数据冲突、学习率过大、参考模型不合适、长度偏置或过强正则。需要同时看 margin 和生成质量。

## 8. 长度偏置

sequence log-prob 是 token log-prob 之和：

$$
\log\pi(y\mid x)=\sum_{t=1}^{|y|}\log\pi(y_t\mid x,y_{<t}).
$$

长序列通常累积更负的 log-prob。如果 chosen/rejected 长度系统性不同，模型可能利用长度而非质量。处理方式包括：

- 数据层做长度匹配和分桶；
- 报告长度条件下的 win rate；
- 尝试长度归一化，但明确它改变了目标；
- 使用独立长度控制与事实/任务指标；
- 检查拒答、模板和格式 shortcut。

## 9. 为什么 DPO 数据最好接近当前 policy 分布

DPO 是离线学习。若 preference pair 来自远强或远旧的模型：

- 当前 policy 可能几乎不可能生成这些回答；
- teacher-forced margin 与部署时 state distribution 脱节；
- 容易学表面 token 模式，难以修正自身 rollout 中的错误状态。

因此实务中常从当前或上一版 checkpoint 采候选，再由人工/规则/judge 排序，形成迭代数据飞轮。它不是严格要求，但能减小 distribution mismatch。

### 拒绝采样：这条飞轮的标准形态（实录常单独追问）

拒绝采样（rejection sampling / best-of-N）在后训练里有三个标准用法：

1. **造 SFT 数据**：对每个 prompt 采 N 条，用 RM/规则/verifier 打分，只留最好或过阈值的回答再做 SFT。DeepSeek-R1 第三阶段就是典型：用 RL checkpoint 生成、规则+生成式 RM 过滤，得到约 60 万条推理样本；
2. **造偏好对**：同组里取高分为 chosen、低分为 rejected，天然贴近当前策略分布；
3. **Best-of-N 基线**：推理时采 N 选优，作为“不训练能到多少”的对照，衡量 RL 真正带来的增益。

要会说的偏差：分数来自 RM 时，拒绝采样会**放大 RM 的偏置**（长度、格式偏好被反复选中），且保留分布比原分布更窄；所以过滤规则要审计，且周期性用人工/独立评测校准。

## 10. DPO 与 PPO/GRPO 怎样选

| 条件 | 更适合 DPO | 更适合 PPO/GRPO |
|---|---|---|
| 数据 | 已有高质量偏好对 | 能在线生成并可靠评分 |
| reward | 难做绝对标量，但成对比较容易 | verifier/RM 可稳定给分 |
| 环境 | 单轮静态回答 | 多轮环境、可交互状态 |
| 工程预算 | 希望简单稳定、少模型 | 有 rollout 和分布式训练资源 |
| 目标 | 行为偏好、风格、安全对齐 | 数学/代码成功率、Agent 任务终态 |
| 风险 | 离线分布偏移、长度 shortcut | reward hacking、训练不稳、成本高 |

不要按流行度选。先问：反馈长什么样、能否验证、是否需要探索、是否有环境转移。

## 11. DPO 家族：IPO、KTO、ORPO、SimPO（面试问"DPO 有什么问题/改进"时的标准答案）

答题框架：先说 DPO 的四个内置假设——**成对偏好数据、需要 reference model、用整段序列 log-prob、SFT 与偏好优化分两阶段**——每个变体各改其中一条，而不是"又一个新算法"。

| 方法 | 改了哪条假设 | 核心机制 | 需要 ref | 数据形态 |
|---|---|---|---:|---|
| IPO | 损失形状 | 把偏好 logit 回归到固定目标（平方损失），防止 DPO 在确定性偏好上把 margin 无界推大导致过拟合 | 是 | 成对 |
| KTO | 数据形态 | 前景理论式价值函数，直接学**非成对**的二元反馈（点赞/点踩） | 通常是 | 单条好/坏标签 |
| ORPO | ref 与阶段 | 无 reference；SFT loss + odds-ratio 惩罚项（odds $=\frac{\pi}{1-\pi}$）合成**单阶段**训练 | 否 | 成对（chosen 兼作 SFT 目标） |
| SimPO | ref 与长度口径 | 无 reference；用**长度归一化的平均 log-prob** 作隐式 reward，并加目标 margin $\gamma$ | 否 | 成对 |
| cDPO | 标签可信度 | 对偏好标签做 label smoothing，容忍标注噪声 | 是 | 成对（含噪） |

选型口径（社区共识，带争议）：只有点赞/点踩数据 → KTO；显存放不下 reference 或想单阶段 → ORPO/SimPO；chosen/rejected 长度差异大 → SimPO 的长度归一化最对症；担心在确定性偏好上过拟合、要训到收敛 → IPO。注意 SimPO 论文自报全面占优，但独立复现结论不一——面试别说"X 必然最强"，说"改哪条轴、代价是什么"。

追问预演：

- SimPO 去掉 reference 后靠什么防跑飞？（目标 margin + 长度归一化改变了隐式 reward 定义；没有 KL 锚，需要更小心的学习率与早停）
- ORPO 的 odds-ratio 和 DPO 的 log-ratio 差在哪？（对象不同：ORPO 是 policy 自身的 odds 对比，不含 reference；且与 SFT 联合优化）
- 为什么这些变体多数仍处理不了多轮 Agent 任务？（都是离线单轮偏好，没有环境转移与 credit assignment，见 07 章）

来源：[DPO 家族取舍](https://quant67.com/post/rl-posttraining/11-dpo-family/11-dpo-family.html)、[后训练课程·DPO 变体](https://posttrain.gaozhijun.me/docs/lecture-3/dpo-variants/)、[SimPO 论文](https://openreview.net/attachment?id=3Tzcot1LKb&name=pdf)。

## 12. RLAIF 与 judge 风险

AI feedback 能扩展标注，但要防：

- position bias：chosen 放左/右导致偏好；
- verbosity/style bias；
- self-preference：judge 偏好同族模型输出；
- prompt injection 与 rubric 漏洞；
- judge 在困难切片上不稳定；
- 同一个 judge 同时造数据和评测形成闭环自证。

最低防线：交换顺序、多 judge/规则交叉、人工校准集、置信度/弃权、按难度和领域切片。

## 13. 本章验收

1. 写 Bradley–Terry RM loss；
2. 从 KL-regularized optimum 推到 DPO loss；
3. 解释四个 sequence log-prob 和 response mask；
4. 解释 chosen/rejected 为什么可一起下降；
5. 说出长度偏置与 distribution mismatch；
6. 根据反馈形态在 SFT、DPO、PPO/GRPO 间做选择；
7. 用"改哪条假设"的框架讲清 IPO/KTO/ORPO/SimPO 并给出选型；
8. 说出拒绝采样的三个用法和它放大 RM 偏置的机制。

主要来源：[DPO 原论文](https://proceedings.neurips.cc/paper_files/paper/2023/file/a85b405ed65c6477a4fe8302b5e06ce7-Paper-Conference.pdf)、[InstructGPT](https://arxiv.org/abs/2203.02155)、[TRL DPO 官方文档](https://huggingface.co/docs/trl/main/en/dpo_trainer)。
---

原始讲义与可运行材料：[GitHub 源文件](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/AI%E7%AE%97%E6%B3%95/%E5%BC%BA%E5%8C%96%E5%AD%A6%E4%B9%A0/05_RewardModel_DPO%E4%B8%8E%E5%81%8F%E5%A5%BD%E5%AD%A6%E4%B9%A0.md)。
