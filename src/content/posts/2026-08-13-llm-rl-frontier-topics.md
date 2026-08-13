---
title: "多模态 RL、奖励模型前沿与 RL Scaling"
description: "Visual-RFT 与 IoU 可验证奖励、DeepSeek-GRM/SPCT、RLVR 边界争议的答题模板，以及 ScaleRL 的天花板/效率二分。"
date: 2026-08-13
tags:
  - reinforcement-learning
  - llm
  - interview
lang: zh-CN
draft: false
series: llm-reinforcement-learning-interview
seriesOrder: 13
---
> 建立日期：2026-08-13。本章收录已经进入面试但尚未沉淀成"标准八股"的四个前沿方向。对 CV/检测背景的候选人，§1 是把原领域经验翻译成 RL 叙事的桥梁，优先级等同 P0。

## 1. 多模态 RL：把可验证奖励搬到视觉任务

### 1.1 Visual-RFT：R1 范式的第一次全面视觉迁移

[Visual-RFT](https://arxiv.org/abs/2503.01785)（ICCV 2025）把 DeepSeek-R1 的"规则可验证奖励 + GRPO"完整搬到视觉感知：以 Qwen2-VL-2B/7B 为底座，模型对每个图文输入采样 G 条带推理过程的回答，用**任务特定的可验证奖励**做组内对比更新，覆盖开放词表检测、少样本检测、推理定位（reasoning grounding）、细粒度分类。

**IoU 奖励的设计（检测任务，值得背下细节）**：

1. 模型输出若干 bbox 及置信度，按置信度排序；
2. 逐一与 ground truth 匹配计算 IoU，低于阈值 $\tau$ 记无效、未匹配记 0；
3. 总奖励 $R_d$ = IoU 项 + 置信度项（匹配上的框置信度应高）+ 格式项（输出结构合法）。

设计动机：数学题的奖励是 0/1，而检测天然有 IoU 这种**连续、免费、和评测指标同源**的质量度量——"把评测指标直接当奖励"是整篇工作的可迁移思想。分类任务则用类别对错（CLS 奖励）。

**关键数字**：one-shot 细粒度分类上 RFT +24.3%、同数据 SFT 反而 −4.3%（差 28.6 个点）——极少样本下"模仿范式"失效而"奖励范式"成立；开放词表检测能迁移到 LVIS 稀有类。

### 1.2 面试题："多模态 RL 和文本 RL 有什么不同"

四个差异点足够撑起追问：

1. **奖励可验证性反而更好**：感知任务有几何/结构真值（IoU、mask 重叠、关键点距离），比开放文本容易造 verifier；难的是"视觉推理中间步骤"仍无真值；
2. **视觉输入是 observation 不是 action**：图像 token 不算 policy loss（与工具返回同语义，见 07 章）；
3. **训推一致性多一层**：视觉编码器在 rollout 引擎与训练引擎间的数值差异叠加在 LLM 侧之上（MoE 的路由问题在 VLM 上同样存在，见 06 章 §9）；
4. **难度课程是二维的**：图像难度（遮挡/小目标/域偏移）× 指令难度，动态采样要在联合分布上做。

### 1.3 给 CV/异常检测背景候选人的叙事模板

把你的原领域资产翻译成 RL 语言，面试一句话版本：

> "我熟悉的评测指标本身就是可验证奖励的现成来源——检测的 IoU/mAP、异常检测的像素级 PRO/AUROC，阈值化之后就是 verifier。我做过的误报代价分析对应 reward shaping，bad case 驱动迭代对应 reward hacking 审计。"

可展开的设计题预演：**"为工业缺陷检测设计一个 RLVR 方案"**——底座 VLM + 缺陷定位任务；奖励 = 定位 IoU（连续项）+ 缺陷类别对错（离散项）+ 报告格式项；失败模式要主动说：模型可能学会"多框刷召回"（用置信度项和多余框惩罚制衡）、训练集缺陷类型过拟合（按对象/缺陷类型隔离切分验证泛化，正是异常检测评测的常规操作）。

## 2. 奖励模型前沿：从 scalar 到 generative

### 2.1 DeepSeek-GRM 与 SPCT

[DeepSeek-GRM](https://arxiv.org/abs/2504.02495) 把 RM 从"输出一个分"改造成"生成式批改员"（pointwise GRM）：对每个待评回答先**生成评分原则（principle）**，再写**自由形式批评（critique）**，最后给 1–10 离散分——全程可读、可审计。

训练方法 **SPCT（Self-Principled Critique Tuning）**分两阶段：拒绝式微调（rejective fine-tuning）打底 + 规则在线 RL，让模型学会**按输入自适应生成评分原则**而不是套一套固定 rubric。

**推理时扩展（reward 侧的 test-time scaling）**：并行采样 k 份"原则→批评→分数"判决，把各判决分数求和投票，再用一个 meta RM 过滤低质量判决。27B 的 GRM 在 Vote@32+MetaRM 下整体分从贪心的 69.9 升到 72.8，可比肩大一个量级的模型——**给 RM 加推理算力比加参数更划算**是这篇的核心论点。

### 2.2 四类奖励来源的对比表（面试常考选型）

| 来源 | 形态 | 优点 | 主要风险 | 何时选 |
|---|---|---|---|---|
| 规则 verifier | exact match/单测/IoU | 便宜、确定、可大规模 | 只覆盖可形式化目标，可被钻空子 | RLVR 主力（R1 路线） |
| scalar RM | 单个分数 | 打分吞吐高，适合在线 rollout | 不可解释、易学 shortcut、分布外退化 | 通用偏好、高吞吐场景 |
| 生成式 RM（GRM/SPCT） | 原则+批评+分数 | 可解释、可推理时扩展、跨域适应 | 推理贵、判决方差、judge 类偏置仍在 | 开放域质量评估、做数据飞轮的过滤器 |
| LLM-as-Judge（提示式） | rubric 打分 | 零训练成本 | 位置/长度/自我偏好，一致性差 | 快速原型；正式训练前换上面三种 |

追问预演：GRM 和 LLM-as-Judge 的区别？（前者为评分**专门训练过**（SPCT），且以原则生成为一等公民；后者是通用模型加提示。）为什么 rollout 打分常仍用 scalar？（一次训练要打几百万分，生成式太贵——常见组合是 scalar 在线打分 + GRM 离线审计。）

## 3. 开放争议："RLVR 到底有没有让模型更聪明"

2026 年面试的高频开放题。答题结构：先摆两边证据，再给判别方法，落到自己的实验设计——考的是评测素养，不是站队。

### 3.1 质疑方证据

- **pass@k 反超**（[NeurIPS 2025](https://arxiv.org/abs/2504.13837)）：RLVR 模型在 k=1 时胜过 base，但 k 放大后 base 反超；RLVR 模型的推理路径几乎都已在 base 的采样分布内；训练越久可解问题边界越窄。六种主流算法的"采样效率差距"相近且都远未达 base 上限——按此口径，RLVR 是**搜索压缩**（把 pass@k 的能力压进 pass@1），不是能力扩展。
- **机制解释**（[Reasoning Boundary Paradox](https://arxiv.org/pdf/2510.02230)）：负迁移（学会某些题会压低另一些题的正确解概率）+ 赢者通吃（高似然解被不断强化、低似然正确解被挤出支撑集）。
- **Spurious Rewards**：随机奖励、仅格式奖励也能显著提升 Qwen2.5-Math（"代码式推理"行为从 65%→90%），但在 Llama3/OLMo2 上不复现——后续研究指向 Qwen 预训练数据污染；在去污染数据上只有真实奖励带来增益。含义：**你的 RLVR 增益可能是训练动力学副产品，不是 verifier 的功劳**。
- **蒸馏对照**：同一系列研究显示蒸馏能引入 base 没有的推理模式、真正扩边界（与 06 章 §7.3 的 R1 结论一致）。

### 3.2 支持方与折中

- 用 **CoT-pass@k**（要求推理链和答案都对）替代 pass@k 后，RLVR 的增益更"真"——它至少提升了逻辑完整性；
- **Agentic/工具任务**上边界扩展的证据更强（组合工具产生 base 单靠采样到不了的终态）；
- 实务共识：增益主体是搜索压缩，少部分是能力扩展，比例取决于任务、verifier 覆盖与基座。

### 3.3 面试答法模板

> "两边证据我都可以摆：pass@k 反超和 spurious rewards 支持'压缩说'，CoT-pass@k 和 agentic 任务支持'扩展说'。所以我不会只报 pass@1：我会画 pass@k 曲线看边界有没有缩、在去污染/分布偏移集上复测、跑一个随机奖励对照排除训练动力学副产品，必要时和蒸馏基线对比。对业务来说，如果目标就是单次成功率和成本，压缩本身已经值钱；如果要新能力，就考虑蒸馏+RL 组合并做探索保护（熵控制、数据课程）。"

## 4. RL Scaling：把 RL 做成可预测的工程

[ScaleRL](https://arxiv.org/abs/2510.13786)（40 万 GPU 时的系统研究）给 RL 训练拟合出 sigmoid 计算量—性能曲线：

$$
R_C=R_0+\frac{A-R_0}{1+(C_{mid}/C)^B}
$$

$A$ 是**渐近天花板**，$B$ 与 $C_{mid}$ 是**计算效率**（爬坡快慢与半程算力）。选 sigmoid 而非幂律，因为 pass rate 有界饱和。

**最有面试价值的结论是"天花板/效率二分"**：

- 抬天花板 $A$ 的：损失类型（CISPO 优于 DAPO/GRPO 口径）、FP32 logits 头、数据/prompt 过滤；
- 只改效率 $B$ 的：损失聚合方式、优势归一化、课程学习、off-policy 方案——它们让你更快到顶，但顶就在那里。

ScaleRL 配方本身：PipelineRL 式异步（8 步 off-policyness）+ 中断式长度控制 + FP32 logits + prompt 级损失聚合 + batch 级优势归一化 + CISPO 损失 + 零方差样本过滤；作者用小规模拟合外推，成功预测了单次 10 万 GPU 时训练的最终表现。

用法与连接：

- 面试题"你怎么判断一个 RL 改进值不值得上大规模"→ 小算力跑到拐点附近、拟合 sigmoid、看改动动的是 $A$ 还是 $B$，动 $A$ 才值得抢算力（字节 Seed JD 里的 "RL Scaling" 方向问的就是这类方法学）；
- 与 06 章熵定律的呼应：$R=-a\,e^H+b$ 同样是"天花板可预测"的故事——熵耗尽即到顶，所以熵管理是 scaling 的前提之一。

## 5. 本章验收

1. 能为一个视觉任务（检测/分割/异常检测）设计可验证奖励，主动说出两种被钻空子的方式和制衡项；
2. 能讲清 SPCT 两阶段与 GRM 的推理时投票机制，并回答"为什么在线打分常仍用 scalar RM"；
3. 能双面陈述 RLVR 边界争议，给出四件判别工具（pass@k 曲线、去污染复测、随机奖励对照、蒸馏基线）；
4. 能用"天花板 vs 效率"二分评价一个 RL 改进，并说明 sigmoid 拟合外推的用法。

主要来源：[Visual-RFT](https://arxiv.org/abs/2503.01785)、[DeepSeek-GRM/SPCT](https://arxiv.org/abs/2504.02495)、[RLVR 边界研究](https://arxiv.org/abs/2504.13837)、[Reasoning Boundary Paradox](https://arxiv.org/pdf/2510.02230)、[ScaleRL](https://arxiv.org/abs/2510.13786)、[熵机制](https://arxiv.org/abs/2505.22617)。
---

原始讲义与可运行材料：[GitHub 源文件](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/AI%E7%AE%97%E6%B3%95/%E5%BC%BA%E5%8C%96%E5%AD%A6%E4%B9%A0/12_%E5%89%8D%E6%B2%BF%E4%B8%93%E9%A2%98_%E5%A4%9A%E6%A8%A1%E6%80%81RL_RM%E5%89%8D%E6%B2%BF%E4%B8%8EScaling.md)。
