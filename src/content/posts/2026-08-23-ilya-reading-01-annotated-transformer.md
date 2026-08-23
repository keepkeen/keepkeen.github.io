---
title: "01. The Annotated Transformer：把论文变成可执行的解释"
description: "这份材料逐行实现 Transformer，把论文里分散的结构、掩码、训练日程和解码细节连接成一台能运行的机器。它本身没有提出 Transformer，却解释了“公式都看懂了，为什么代码仍容易写错”。"
date: 2026-08-23
tags:
  - deep-learning
  - paper-reading
  - ilya-reading-list
  - transformer
lang: zh-CN
featured: false
draft: false
series: ilya-sutskever-reading-list
seriesOrder: 1
---
> **材料类型：** 代码导读（2018，2022 年重写）　**出处状态：** 27 项保留清单　**原文：** [Harvard NLP 页面](https://nlp.seas.harvard.edu/annotated-transformer/)　**代码：** [harvardnlp/annotated-transformer](https://github.com/harvardnlp/annotated-transformer)

## 一句话定位

这份材料逐行实现 Transformer，把论文里分散的结构、掩码、训练日程和解码细节连接成一台能运行的机器。它本身没有提出 Transformer，却解释了“公式都看懂了，为什么代码仍容易写错”。

## 为什么会出现在清单中

**已知**：它出现在公开的 27 项部分清单中。**合理推断**：整套材料不只要求认识架构名，还要求能从论文落到实现。Transformer 的主公式很短，真正决定结果的还有张量布局、因果掩码、残差与归一化顺序、学习率预热、标签平滑、批处理和解码。该导读恰好补上论文与工程之间的空隙。没有证据表明 Ilya 留下过更具体的逐篇理由。

## 它解决了什么问题

[Attention Is All You Need](/blog/ilya-reading-14-attention-is-all-you-need/) 给出完整模型和实验，却以研究论文的密度组织内容。2017 年的官方 Tensor2Tensor 实现面向研究系统，阅读成本高。Sasha Rush 把模型压到约 400 行教学代码，并让正文、公式和相邻代码共同出现。这个做法后来成为“可执行论文”的代表案例，也正式发表于 [ACL 2018 Workshop for NLP Open Source Software](https://aclanthology.org/W18-2509/)。

## 核心贡献和思想

核心贡献是**可检查的解释**。读者可以沿数据流验证六件事：

1. 编码器把源序列变成逐位置表示；解码器同时看编码器记忆和已生成前缀。
2. 缩放点积注意力计算 `softmax(QKᵀ/√d_k)V`；缩放抑制高维点积方差过大造成的 softmax 饱和。
3. 多头注意力先在多个投影子空间独立路由信息，再拼接；它不是把同一张注意力图重复多次。
4. 解码器用上三角因果掩码遮住未来位置；填充掩码解决批内长度不同。
5. 位置前馈网络对每个位置独立应用同一组两层 MLP，注意力负责位置间通信。
6. 训练还依赖嵌入缩放、位置编码、残差、LayerNorm、dropout、标签平滑、Adam 和 warm-up/inverse-square-root 学习率。

## 怎样理解与实现

最有效的理解方式是把 Transformer 看成两种操作交替：**路由**与**变换**。注意力根据当前内容决定从哪些位置取信息；前馈层在每个位置上变换取回的信息。残差路径保留旧表示，使一层只需学习增量。

实现时先检查形状。若批量为 `B`、头数为 `H`、长度为 `T`、每头维度为 `D`，注意力分数应为 `B×H×T_q×T_k`，softmax 必须沿 `T_k`。掩码要在 softmax 前把禁用位置设为负无穷。训练阶段目标序列右移一位，否则答案会泄漏给当前位置。

一个容易忽略的历史差异：原论文使用“残差相加后 LayerNorm”（post-norm）；当前 Annotated Transformer 的 `SublayerConnection` 为代码简洁把归一化放在子层之前（pre-norm）。页面自己也在注释中说明这一点。pre-norm 后来常用于稳定深层训练，但复现实验时不能把两者当作完全相同的模型。

本项目在 [`src/ilya30/attention.py`](https://github.com/keepkeen/keepkeen.github.io/blob/main/public/code/ilya30/src/ilya30/attention.py) 独立实现缩放点积注意力、因果掩码、多头拆分和正弦位置编码；章节 14 再把这些部件放回原论文的完整论证。

## 它证明了什么

这是一份复现和教学工作，证据是代码能训练合成复制任务与德英翻译，并复现合理的注意力图和翻译质量。它没有建立新的架构优越性结论；模型效果的主要实验证据属于 Transformer 原论文。把“代码跑通”与“科学主张被独立复现”区分开很重要。

## 优点、缺点和适用边界

优点是解释紧贴执行路径，读者能定位每个公式在程序中的位置；训练循环、损失归一化和掩码等论文常省略的部分也可见。缺点是页面会随依赖升级而变化，2022 版已不是 2018 版的历史快照；教学实现选择可读性，不能代表高吞吐内核、KV cache 或分布式训练。代码中的 pre-norm 与原文 post-norm 差异也说明，注释代码仍需要版本意识。

## 能否迁移到其他领域

模型本身已经迁移到视觉、语音、蛋白质、时间序列和强化学习。更普遍的迁移价值是方法论：对任何“公式短、实现暗含条件多”的论文，都可以构造一份最小可执行导读，让形状、不变量、数值检查和实验设置成为解释的一部分。

## 阅读检查

- 能否解释 padding mask 与 causal mask 分别防止什么？
- 能否指出 softmax 的轴，并说明轴错了为什么代码仍可能运行？
- 能否用一句话区分原论文的 post-norm 与当前导读的 pre-norm？
- 能否说明训练可并行而自回归解码仍顺序执行的原因？

## 相关材料

- [Transformer 原论文](https://arxiv.org/abs/1706.03762)：科学主张的来源。
- [Tensor2Tensor](https://github.com/tensorflow/tensor2tensor)：当时更接近研究生产环境的官方实现。
- [OpenNMT](https://aclanthology.org/P17-4012/)：同期模块化神经机器翻译工具，展示另一种工程组织方式。
