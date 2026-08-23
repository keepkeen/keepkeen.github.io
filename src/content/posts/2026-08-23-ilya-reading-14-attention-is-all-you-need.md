---
title: "14. Attention Is All You Need：把序列计算改造成全局可寻址的并行图"
description: "Transformer 去掉 encoder/decoder 中的循环和卷积，用多头自注意力在一层内连接任意位置，再用逐位置 MLP 变换内容。它将训练的关键顺序依赖从 O(n) 降为常数层级，使大规模并行训练和短路径长程依赖同时成为可能。"
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
seriesOrder: 14
---
> **论文：** Vaswani et al.，NeurIPS 2017　**出处状态：** 27 项保留清单　**原文：** [arXiv:1706.03762](https://arxiv.org/abs/1706.03762)　**官方代码入口：** [Tensor2Tensor](https://github.com/tensorflow/tensor2tensor)

## 一句话定位

Transformer 去掉 encoder/decoder 中的循环和卷积，用多头自注意力在一层内连接任意位置，再用逐位置 MLP 变换内容。它将训练的关键顺序依赖从 `O(n)` 降为常数层级，使大规模并行训练和短路径长程依赖同时成为可能。

## 为什么会被推荐

**已知**：论文与 Annotated Transformer 都在保留清单，说明“原始设计”和“可执行理解”被当作两份不同材料；没有公开逐篇评语。**合理推断**：这是现代基础模型最直接的架构起点。更深的推荐理由可能不是“attention 很强”这一句，而是它把内存检索、关系推理、可微路由、残差优化和规模化矩阵乘法统一到一个极简块中。

## 核心算子

缩放点积注意力为：

`Attention(Q,K,V) = softmax(QKᵀ/√d_k + mask)V`。

query 表示“我要找什么”，key 表示“我有什么索引”，value 是取回内容。除以 `√d_k` 是因为独立、方差约为 1 的向量点积方差随维度增长；不缩放时 softmax 易饱和、梯度变小。mask 在 padding 或未来位置填 `-∞`，而不是在 softmax 后随便置零。

多头注意力先把 `Q/K/V` 投影到多个子空间，各自注意后拼接：`Concat(head_1,…,head_h)W^O`。它不是保证每个头自动学一种语言学关系，而是给模型多套并行相似度与内容通道；原论文消融中单头比最佳设置低 0.9 BLEU，但头数过多也下降。

一个原始 encoder layer 是 self-attention 和 position-wise FFN 两个子层，每个使用残差、dropout、LayerNorm；decoder 多一层对 encoder 的 cross-attention，并对自注意力加因果 mask。原论文是 **post-norm**：`LayerNorm(x+Sublayer(x))`。许多现代实现改成 pre-norm；不能把后者误写成 2017 论文原式。

没有循环后，顺序由位置编码注入。论文使用不同频率的 sin/cos，并测试了学习式位置嵌入，两者当时结果几乎相同；“正弦一定能外推”只是动机，不是被实验充分证明的定理。

## 为什么它有效、如何实现

对长度 `n`、维度 `d`，全局 self-attention 每层约 `O(n²d)`，但任意两位置路径长为 `O(1)`，且所有位置可并行；RNN 约 `O(nd²)`，却必须执行 `O(n)` 个顺序步骤。短中等序列且 `n<d` 时，这一交换很合算。FFN `max(0,xW1+b1)W2+b2` 为每个位置独立增加非线性计算；残差流保存状态，attention 负责跨位置通信。

[`src/ilya30/attention.py`](https://github.com/keepkeen/keepkeen.github.io/blob/main/public/code/ilya30/src/ilya30/attention.py) 独立实现稳定 softmax、mask、scaled dot-product、多头拆合和正弦位置编码。测试包括：每行权重和为 1；因果位置看不到未来；多头拆合不改变张量元素；所有 key 被 mask 时明确报错。完整教学实现见第 1 篇 [Annotated Transformer](/blog/ilya-reading-01-annotated-transformer/)。

## 它从哪里来，其他路线如何解决

[Bahdanau attention](/blog/ilya-reading-15-bahdanau-attention/) 让 RNN decoder 对 encoder 状态做可微软寻址，打破固定向量瓶颈；[Luong attention](https://arxiv.org/abs/1508.04025) 系统比较点积/双线性对齐；[Memory Networks](https://arxiv.org/abs/1410.3916) 和 [NTM](/blog/ilya-reading-21-neural-turing-machines/) 把注意力解释为外部记忆寻址。Transformer 的突破是让序列内部也全部依靠这种寻址。

同期替代路线包括 [ConvS2S](https://arxiv.org/abs/1705.03122) 的并行卷积和 [ByteNet](https://arxiv.org/abs/1610.10099) 的空洞因果卷积；它们路径随深度缩短但仍有局部核。[Sparse Transformer](https://arxiv.org/abs/1904.10509)、Longformer/线性注意力等后来降低 `n²` 成本；相对位置、RoPE、ALiBi 则改进长度与几何表达。现代状态空间模型以线性序列复杂度换取另一种长记忆机制，说明 attention 并非所有长度下唯一答案。

## 论文证据、优缺点

Transformer-big 在 WMT14 En–De 达到 28.4 BLEU，并以 8 张 P100 训练约 3.5 天；base 模型约 65M 参数、12 小时。它也在英语成分句法分析上迁移良好。BLEU、分词和当年训练成本估算不能直接与今天系统横比，但结果证明无循环架构可以胜过强 RNN/CNN 翻译系统。

优点是并行、高吞吐、全局内容寻址、模块统一且易规模化。局限是注意力矩阵的 `O(n²)` 时间/显存；位置需外加；自回归推理仍逐 token；attention 权重不是因果解释；模型缺少任务特定不变性，常需大量数据。KV cache 降低重复计算却带来随上下文增长的内存。

## 跨领域应用

图像 patch、音频帧、蛋白质残基、动作轨迹、表格字段和多模态 token 都可作为集合/序列节点。迁移时必须重新设计 token 化、位置/几何编码、mask 与计算稀疏性；仅把输入展平并不自动得到合适归纳偏置。

## 阅读检查

- `√d_k` 缩放针对什么数值问题？
- self-attention 的 `O(1)` 路径与 `O(n²)` 工作量为何不矛盾？
- post-norm、pre-norm 哪个是原论文，为什么实现时必须分清？
- 多头注意力为何比一次更宽的单头可能更有用，又为什么不是越多越好？
