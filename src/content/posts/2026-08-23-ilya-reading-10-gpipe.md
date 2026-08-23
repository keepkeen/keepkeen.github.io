---
title: "10. GPipe：用微批次把超大模型流水化"
description: "GPipe 把连续网络层切到 K 个设备，再把一个 mini-batch 切成 M 个 micro-batch 依次穿过这些分区。设备处理不同微批次形成流水线；所有微批梯度累积后只做一次同步更新，避免异步权重陈旧。"
date: 2026-08-23
tags:
  - deep-learning
  - paper-reading
  - ilya-reading-list
  - distributed-systems
lang: zh-CN
featured: false
draft: false
series: ilya-sutskever-reading-list
seriesOrder: 10
---
> **论文：** Huang et al.，NeurIPS 2019（2018 预印本）　**出处状态：** 27 项保留清单　**原文：** [arXiv:1811.06965](https://arxiv.org/abs/1811.06965)

## 一句话定位

GPipe 把连续网络层切到 `K` 个设备，再把一个 mini-batch 切成 `M` 个 micro-batch 依次穿过这些分区。设备处理不同微批次形成流水线；所有微批梯度累积后只做一次同步更新，避免异步权重陈旧。

## 为什么会被推荐

**已知**：论文在保留清单。**合理推断**：清单不把“模型思想”和“规模化系统”分开。容量超过单设备内存后，能否训练取决于分区、调度、通信和重计算；GPipe 是理解大模型为何可行的最小系统范例。它也与 Scaling Laws 形成因果链：经验规律鼓励扩大模型，流水并行提供实施手段。

## 核心机制与最小实现

设网络有 `L` 层，按连续层划成 `K` 个 cell，每个 cell 放一台加速器。若整个 batch 一次前向，只有一台设备工作，其余等待。拆成 `M` 个微批后，cell 1 处理微批 2 时，cell 2 可处理微批 1。

GPipe 对所有微批先流水前向，再流水反向，累积梯度并在 batch 末同步更新。每个微批的前后向看见同一版本权重，因此与不分区的同步 mini-batch SGD 语义一致。填充/排空产生 bubble，均衡阶段的相对开销约为 `(K-1)/(M+K-1)`；论文经验是 `M≥4K` 时较小。

激活通常比边界张量占更多内存。GPipe 只保存分区边界激活，反向时重新计算分区内部前向（rematerialization/checkpointing），以额外计算换内存。论文给出的峰值激活量级从未分区的 `O(NL)` 降到 `O(N + (L/K)(N/M))`，其中 `N` 为 batch 大小。

[`src/ilya30/systems.py`](https://github.com/keepkeen/keepkeen.github.io/blob/main/public/code/ilya30/src/ilya30/systems.py) 提供离散流水调度和 bubble 计算；它可检查 `M=1` 时流水并无吞吐优势，以及增大 `M` 如何摊薄填充等待。

## 当时与后来的其他路线

数据并行复制模型并切数据，模型放不下一台设备时无能为力；tensor/SPMD parallelism 切单层矩阵，需频繁集体通信；流水并行只在分区边界传激活，但受 bubble 和负载不均衡影响。[PipeDream](https://dl.acm.org/doi/10.1145/3341301.3359646) 交错多个 batch 的前后向以提高利用率，却引入权重陈旧和多版本参数。后来的 [Megatron pipeline](https://proceedings.mlr.press/v139/narayanan21a.html) 使用 1F1B 调度降低激活峰值，并与 tensor/data parallel 组合；ZeRO/FSDP 切优化器、梯度和参数状态，解决另一部分内存。

这些方法可组合，不是互斥“赢家”。现代大模型通常同时使用数据、张量、流水、序列/上下文并行和重计算。

## 论文证据

单 TPU 上重计算使可放入的 AmoebaNet 从 8200 万增至 3.18 亿参数；8 个分区可容纳 18 亿。128 个 TPUv3 分区的容量实验可容纳 839 亿参数 Transformer，相对单设备约 298 倍；“可容纳”不等于论文完整训练了一个 839 亿模型。实际任务包括 5.57 亿参数 AmoebaNet（ImageNet top-1 84.4%）和最多 60 亿参数的 102 语言翻译模型。

`M=32` 时，Transformer 从 2 到 8 个分区的归一化吞吐从 1.8 提到 6.3；无高速互联的 P100 上，2 到 8 个分区约 3.3 倍加速。AmoebaNet 因层成本不均，扩展较差，说明调度公式不能替代真实负载分析。

## 优点和局限

优点是框架无关思想简单、同步语义稳定、跨分区通信少，模型容量近似随设备数扩展。局限是网络需能切成近似顺序的均衡段，单层仍必须放入单设备；微批太小会降低算子效率并破坏 BatchNorm 统计；F-then-B 调度保存较多边界激活，bubble 不能完全消失。重计算增加 FLOPs，最优点取决于设备内存、网络带宽和层形状。

## 跨领域应用

任何由深层阶段构成、单设备放不下的视觉、语音、多模态或科学模型都可流水化。更普遍的系统原则是同时画三张图：计算依赖图、张量生命周期和通信边界。只看参数量无法判断模型能否训练。

## 阅读检查

- micro-batch 与 mini-batch 在参数更新语义上是什么关系？
- 为什么 `M` 大能减 bubble，却可能降低单微批算子效率？
- rematerialization 省了什么内存，付出什么成本？
- “支持 83.9B 参数”为什么不能改写成“训练了 83.9B 模型”？
