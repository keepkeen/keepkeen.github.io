---
title: "16. Identity Mappings：让残差主干真正成为无障碍信息高速路"
description: "原始 ResNet 的 shortcut 是恒等，但相加后仍经过 ReLU。本文推导：若 shortcut 和相加后的映射都为恒等，任意浅层到深层之间都有一条只含加法的前向/反向路径。将 BN、ReLU 移到卷积前的 full pre-activation block 更接近这一条件，也让 1001 层网络明显更易训练。"
date: 2026-08-23
tags:
  - deep-learning
  - paper-reading
  - ilya-reading-list
  - computer-vision
lang: zh-CN
featured: false
draft: false
series: ilya-sutskever-reading-list
seriesOrder: 16
---
> **论文：** He et al.，ECCV 2016　**出处状态：** 27 项保留清单　**原文：** [arXiv:1603.05027](https://arxiv.org/abs/1603.05027)　**作者代码：** [resnet-1k-layers](https://github.com/KaimingHe/resnet-1k-layers)

## 一句话定位

原始 ResNet 的 shortcut 是恒等，但相加后仍经过 ReLU。本文推导：若 shortcut 和相加后的映射都为恒等，任意浅层到深层之间都有一条只含加法的前向/反向路径。将 BN、ReLU 移到卷积前的 full pre-activation block 更接近这一条件，也让 1001 层网络明显更易训练。

## 为什么会被推荐

**已知**：它与 ResNet 原论文同时出现在保留清单，没有 Ilya 的公开逐篇理由。**合理推断**：这对“发明—理解—改良”很有教学价值。第 11 篇提出 `x+F(x)`，本篇用代数和消融定位真正关键的 clean path，并说明微小的算子顺序为何能决定千层网络能否优化。

## 核心推导

一般残差单元写成：

`y_l = h(x_l)+F(x_l,W_l)`，`x_{l+1}=f(y_l)`。

当 `h` 与 `f` 都是 identity：

`x_L = x_l + Σ_{i=l}^{L-1} F(x_i,W_i)`。

所以深层表示不是一长串矩阵乘积，而是较浅表示加上后续残差之和。反向有：

`∂E/∂x_l = ∂E/∂x_L · (1 + ∂/∂x_l ΣF_i)`。

括号中的 `1` 是不经过权重层的直接梯度项。它不构成“梯度绝不抵消”的严格全局保证，但解释了为什么小权重时仍有信号。

若 shortcut 改为 `λ_l x_l`，直达项变为 `∏λ_i`：每层略小于 1 会指数衰减，略大于 1 会指数放大。换成 gate 或 `1×1` 卷积，直达项同样变成一串 Jacobian 的乘积。这就是“可学习 shortcut 看起来更强，却可能更难优化”的关键。

## pre-activation 怎么实现

原始块：`conv → BN → ReLU → conv → BN → add → ReLU`。full pre-activation 块：`BN → ReLU → conv → BN → ReLU → conv → add`，加法结果直接成为下一块输入；激活和归一化只在残差分支上。下采样/增通道时仍需投影，其他块保持 identity。

[`src/ilya30/vision.py`](https://github.com/keepkeen/keepkeen.github.io/blob/main/public/code/ilya30/src/ilya30/vision.py) 的残差示例区分 post-activation 与 clean identity，并计算连续 scalar shortcut 的梯度乘积。代码刻意不复刻 1001 层训练；完整历史实现可看作者仓库。Transformer 中与 clean residual path 相似的 pre-norm 现象，可对照后来的 [LayerNorm 位置分析](https://arxiv.org/abs/2002.04745)，但两种架构不能直接等同。

## 消融与证据

在 CIFAR-10 ResNet-110 上，identity shortcut 错误率 6.61%；shortcut 全部乘 0.5、dropout 或不当 gate 常训练失败，全部换 `1×1` 卷积为 12.22%。这不是说网络里永远不能有 projection，而是不能在每个最短路径上都加变换。

full pre-activation 把原始 ResNet-1001 的 CIFAR-10 错误率从 7.61% 降到 4.92%；batch 64 的报告值为 4.62%。ImageNet 上 pre-act ResNet-200 为 20.7/5.3 top-1/top-5 error，原始 200 层为 21.8/6.0。结果支持优化与正则化收益，但均是特定训练设置的经验，不是公式单独预测出的精度。

## 相关工作与今天的理解

[Highway Networks](https://arxiv.org/abs/1505.00387) 的门控 shortcut 适合自适应路由，但本篇显示超深场景对门偏置很敏感；[DenseNet](https://arxiv.org/abs/1608.06993) 用拼接而非相加让每层直接访问所有早期特征，代价是通道和内存增长。Transformer 后来采用 residual + LayerNorm，pre-norm 与本文 pre-activation 共享“归一化/非线性不阻断主干”的思想，但算子和训练动力学并不完全相同。

[ReZero](https://arxiv.org/abs/2003.04887)、DeepNorm 和残差缩放进一步控制深度方向的 Jacobian；现代无归一化网络也可用精心初始化稳定训练。因此本篇最耐久的结论不是某个固定排列，而是：分析最短信息路径上到底乘了什么。

## 优缺点与跨领域

优点是理论直观、改动极小、训练更快，并使 BN 兼具预激活正则作用。局限是推导假设理想 identity，真实网络在 stage 边界有投影；BN 依赖 batch 统计，不适合所有小批/在线任务；超深带来的计算仍线性增加，泛化未必单调改善。

这一原则适用于语言模型、图网络、扩散 U-Net、迭代优化器和控制系统：保留不受干扰的状态主干，把复杂算子放到增量支路。跨领域时应计算 Jacobian/尺度，而不是机械照抄 BN-ReLU-Conv。

## 阅读检查

- 推导中的两个 identity 条件分别对应哪条路径？
- 每层 shortcut 乘 0.99，跨 1000 层后为何不是“小改动”？
- pre-activation 与 Transformer pre-norm 有何相似，又不能等同在哪里？
- 本文实验证明的是优化优势、表达能力优势，还是两者都证明了？
