---
title: "05. Recurrent Neural Network Regularization：dropout 应避开哪条记忆通路"
description: "论文给出一个简单规则：对深层 LSTM 的输入、层间和输出等非循环连接使用 dropout，保留时间方向的循环连接不受扰动。这样既能正则化大模型，又不在每一步反复破坏长期记忆。"
date: 2026-08-23
tags:
  - deep-learning
  - paper-reading
  - ilya-reading-list
  - rnn
lang: zh-CN
featured: false
draft: false
series: ilya-sutskever-reading-list
seriesOrder: 5
---
> **论文：** Zaremba, Sutskever & Vinyals（2014）　**出处状态：** 27 项保留清单；Ilya 是作者　**原文：** [arXiv:1409.2329](https://arxiv.org/abs/1409.2329)　**作者代码：** [wojzaremba/lstm](https://github.com/wojzaremba/lstm)

## 一句话定位

论文给出一个简单规则：对深层 LSTM 的输入、层间和输出等**非循环连接**使用 dropout，保留时间方向的循环连接不受扰动。这样既能正则化大模型，又不在每一步反复破坏长期记忆。

## 为什么会被推荐

**已知**：论文在保留清单中，Ilya 参与作者工作。**合理推断**：它代表一类重要研究能力——架构公式之外，噪声放置位置会改变模型能否学习。清单先让读者理解 LSTM，再展示怎样通过信息路径分析把一个前馈正则化方法正确移植到循环网络。

## 当时其他工作怎么做

标准 [dropout](https://jmlr.org/papers/v15/srivastava14a.html) 独立丢弃激活，前馈网络中效果显著；直接在循环边上每步重新采样噪声，会让长期信息反复受损。论文指出 Pham 等人的手写识别工作独立使用了相同方法，因此这不是唯一发现者的故事。

后续路线进一步放宽限制：

- [Gal & Ghahramani 2016](https://proceedings.neurips.cc/paper/2016/hash/076a0c97d09cf1a0ec3e19c7f2529f2b-Abstract.html) 从变分贝叶斯解释出发，在整条序列上复用同一 dropout mask，也正则化循环变换。
- [Recurrent Dropout without Memory Loss](https://aclanthology.org/C16-1165/) 把 dropout 放在候选更新而非旧 cell 主干上。
- [Zoneout](https://arxiv.org/abs/1606.01305) 随机保留旧状态，而不是把状态置零，让信息和梯度有恒等路径。

这些方案没有推翻原规则；它们分别改变噪声的时间相关性、作用分支或“丢弃”的含义。

## 核心思想和实现

对第 `l` 层 LSTM，门由 `D(h_t^{l-1})` 与未丢弃的 `h_{t-1}^l` 共同计算，其中 `D` 是 dropout。时间方向的 `h_{t-1}^l→h_t^l` 和 cell 主干保持完整。于是跨 `k` 个时间步传递的信息不会遭遇 `k` 次独立 dropout，只在穿过网络深度和输出时受有限次数扰动。

训练时用 inverted dropout：保留单元除以保留率，使测试时无需额外缩放。应分别说明 mask 是逐时间重采样还是整段锁定；原论文的核心主张是**不作用于 recurrent connections**，不能与后来“locked/variational dropout”混称。

[`src/ilya30/sequence.py`](https://github.com/keepkeen/keepkeen.github.io/blob/main/public/code/ilya30/src/ilya30/sequence.py) 实现 locked dropout，并通过测试确认同一序列的 mask 沿时间不变；同时示例如何只对层间张量应用它。

## 实验到底证明了什么

在 Penn Treebank 上，大型正则化单模型测试困惑度为 78.4，论文调优的非正则化小模型为 114.5；两者容量不同，结果同时反映“dropout 允许训练更大模型”和正则化收益，不能当作单变量消融。英法翻译中测试 BLEU 从 25.9 升至 29.03；冰岛语音帧准确率从 68.9% 升至 70.5%；图像描述 BLEU 从 23.5 升至 24.3，而十模型非正则化集成为 24.4。跨四种任务的一致方向是该论文最强的证据。

这些数字按 2014 年数据、解码器和评测口径成立。语音实验只报告 frame accuracy 而非最终 WER；翻译系统仍低于当时 33.30 BLEU 的 LIUM 短语系统。论文证明正则化配方有用，没有证明 LSTM 已解决这些任务。

## 优缺点

优点是改动小、因果直觉清楚、跨任务有效，并使更大 LSTM 不再立即过拟合。缺点是循环权重本身未受该 dropout 正则化；最佳比例、截断长度和模型宽度需联合调参；与不同容量基线比较使纯 dropout 效应难以完全分离。今天框架中的 `dropout` 参数常只作用于多层 RNN 的层间输出，正是这条历史约定，但不同库的 mask 语义仍需查文档。

## 跨领域价值

原则可迁移到任何带持久状态的系统：先画出必须长期无损传播的信息主干，再把噪声放到冗余计算或读出分支。状态空间模型、控制器、记忆网络和递归图网络都可用这一方法审查正则化，而不是机械地“每层都 dropout”。

## 阅读检查

- 为什么每步独立丢弃 recurrent state 会随序列长度累积破坏？
- 原论文方法与 variational/locked dropout 的 mask 有何差异？
- PTB 的 78.4 对 114.5 为什么不是纯粹的同容量消融？
- 如何把“保护信息主干”迁移到非 RNN 系统？
