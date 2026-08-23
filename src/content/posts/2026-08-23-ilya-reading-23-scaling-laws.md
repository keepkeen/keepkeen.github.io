---
title: "23. Scaling Laws：把“做多大、喂多少数据、练多久”变成可拟合的工程问题"
description: "论文在约 10³–10⁹ 非 embedding 参数、22M–23B tokens 和跨多个数量级 compute 的训练中发现：语言模型 cross-entropy 对模型规模 N、数据 D、最优 compute C 近似幂律，并由此推导固定预算的 compute-efficient frontier。它把 scaling 从信念变成可实验估计，但具体指数不是自然常数，后来已被 Chinchilla 修正。"
date: 2026-08-23
tags:
  - deep-learning
  - paper-reading
  - ilya-reading-list
  - scaling-laws
lang: zh-CN
featured: false
draft: false
series: ilya-sutskever-reading-list
seriesOrder: 23
---
> **论文：** Kaplan et al.，2020　**出处状态：** 27 项保留清单　**原文：** [arXiv:2001.08361](https://arxiv.org/abs/2001.08361)

## 一句话定位

论文在约 `10³–10⁹` 非 embedding 参数、`22M–23B` tokens 和跨多个数量级 compute 的训练中发现：语言模型 cross-entropy 对模型规模 `N`、数据 `D`、最优 compute `C` 近似幂律，并由此推导固定预算的 compute-efficient frontier。它把 scaling 从信念变成可实验估计，但具体指数不是自然常数，后来已被 Chinchilla 修正。

## 为什么会被推荐

**已知**：它是保留清单中最晚的材料之一；没有逐篇推荐语。**合理推断**：这篇改变了研究决策方式。若小模型曲线能预测大模型，就可在昂贵训练前分配参数、数据、batch 和 steps；同时它揭示“架构小改良”必须与强 scaling baseline 比，避免把更多 compute 的收益错算成算法贡献。

## 核心经验规律

在其他资源充足时，论文拟合：

`L(N)≈(N_c/N)^0.076`，`L(D)≈(D_c/D)^0.095`，

`L(C_min)≈(C_c/C_min)^0.050`。

指数很小意味着收益稳定但递减：参数翻倍只把相应 loss 乘约 `2^-0.076≈0.95`。模型宽深比、head 数和 FFN 比在合理范围内影响较小；极浅/极端形状除外。联合式 `L(N,D)` 描述容量受限与数据受限如何共同形成 overfitting。

训练 compute 近似 `C≈6ND`（一次 token 的 forward 约 `2N`，backward 再约两倍），忽略 embedding、attention context 和硬件利用率等次要项。critical batch size 随 loss 变化，超过它继续增 batch 主要换 wall-clock parallelism，而不再按比例节省总 compute。

## 原论文的最优分配

基于 learning curves 与其计数约定，论文得到 `N_opt∝C^0.73`、`D_opt∝C^0.27`（其中 batch 约 `C^0.24`、serial steps 仅约 `C^0.03`）。结论是应训练更大的模型、用相对少的数据并远早于完全收敛停止。GPT-3 的训练配置明显受此思路影响。

这不是“永远少喂数据”的定理。它来自 WebText2、1024 context、特定 tokenizer/optimizer、非 embedding 参数和较小尺度拟合；`C≈6ND` 也不包含数据质量、推理成本和多次超参试验。

[`src/ilya30/systems.py`](https://github.com/keepkeen/keepkeen.github.io/blob/main/public/code/ilya30/src/ilya30/systems.py) 实现带可选不可约 loss floor 的 log-space power-law 拟合、`6ND` 估算和固定预算网格搜索。测试用合成数据恢复指数，并展示改变 floor/拟合区间会系统改变外推。输出附残差，避免只报一条直线。

## Chinchilla 为什么不同

[Hoffmann et al. 2022](https://arxiv.org/abs/2203.15556) 用 isoFLOP profiles 重新实验，得到模型与 token 都大约按 `C^0.5` 增长；同训练 compute 下，70B Chinchilla 用 1.4T（论文/博客常四舍五入为 1.3T）tokens 胜过 280B Gopher。这使“约 20 tokens/parameter”的经验成为一段时期的规划基线，而非普适常数。

[Pearce & Song 的 reconciliation](https://arxiv.org/abs/2406.12907) 发现 Kaplan 排除 embedding 参数并在小尺度分析，是 `0.73` 与 `0.50` 差异的主要来源；在小模型中 embedding 占比巨大，参数口径扭曲斜率。不同训练曲线拟合、compute 估算和数据也有影响。因此正确读法是：**幂律现象很耐久，系数必须按当前架构、口径和范围重测。**

## 相关与后续问题

早期神经语言模型和视觉已有经验 scaling；论文把三资源联合和临界 batch 系统化。[Data-constrained scaling](https://arxiv.org/abs/2305.16264) 显示有限语料重复到约 4 epochs 可能几乎无损，之后边际价值衰减；[Broken Neural Scaling Laws](https://arxiv.org/abs/2210.14891) 处理转折、饱和和非单调区间。任务准确率还可能因阈值显得“涌现”，即使底层 loss 平滑。

训练最优也不等于生命周期最优：大量推理时，小模型多训练可能总成本更低；数据质量、合成数据、蒸馏、稀疏 MoE、context length 和 memory bandwidth 都会改变预算约束。安全、偏差和事实性也不能从 cross-entropy 单变量外推。

## 优缺点与跨领域

优点是预测性强、实验范围大、提供资源分配公式并推动可量化规划。局限是观察性经验律、外推脆弱；loss floor 与数据分布决定拟合；最大模型仍远小于今天；只优化 average next-token loss，忽略下游效用、风险、能耗和推理。

视觉、语音、强化学习、扩散和科学模型都能做类似 scaling study。方法应是：预注册资源口径；多尺度、重复种子；保留 holdout 最大规模；比较单/折断幂律；报告置信区间和残差；只在观测范围附近做决策。

## 阅读检查

- 小指数为什么仍能在多个数量级产生巨大收益？
- Kaplan 与 Chinchilla 的 compute-optimal 结论分别是什么，差异主要从何而来？
- `C≈6ND` 忽略了哪些今天可能不再次要的成本？
- 训练 compute 最优为何可能不是大量部署后的总成本最优？
