---
title: "15. Jointly Learning to Align and Translate：注意力从“压缩整句”走向“按需读取”"
description: "早期 seq2seq 把整条源句压进一个固定长度向量。Bahdanau attention 改为保存每个源位置的双向表示，并让 decoder 在生成每个目标词时，学习一组对齐权重、加权读取所需内容。对齐不再是外部流水线或离散隐变量，而是可端到端训练的软寻址。"
date: 2026-08-23
tags:
  - deep-learning
  - paper-reading
  - ilya-reading-list
  - attention
lang: zh-CN
featured: false
draft: false
series: ilya-sutskever-reading-list
seriesOrder: 15
---
> **论文：** Bahdanau, Cho & Bengio，ICLR 2015（2014 预印本）　**出处状态：** 27 项保留清单　**原文：** [arXiv:1409.0473](https://arxiv.org/abs/1409.0473)

## 一句话定位

早期 seq2seq 把整条源句压进一个固定长度向量。Bahdanau attention 改为保存每个源位置的双向表示，并让 decoder 在生成每个目标词时，学习一组对齐权重、加权读取所需内容。对齐不再是外部流水线或离散隐变量，而是可端到端训练的软寻址。

## 为什么会被推荐

**已知**：它在保留清单，且直接回应了 Sutskever 等人的 seq2seq 路线；没有 Ilya 的公开逐篇说明。**合理推断**：这篇论文展示了一种极具迁移性的思考方式：不要强迫固定容量状态无损保存全部输入，让下游根据当前问题查询一组记忆。它是 Pointer Networks、Transformer、图注意力和跨模态对齐的直接概念节点。

## 核心模型与公式

双向 RNN 为源词 `x_j` 产生 annotation `h_j=[→h_j;←h_j]`，因而每个位置同时包含左右上下文。生成第 `i` 个目标词前，用前一 decoder 状态与每个 annotation 计算加性打分：

`e_ij = v_aᵀ tanh(W_s s_{i-1} + W_h h_j)`，

`α_ij = softmax_j(e_ij)`，`c_i = Σ_j α_ij h_j`。

decoder 再用 `s_i=f(s_{i-1},y_{i-1},c_i)` 预测 `p(y_i|y_<i,x)`。`c_i` 可看成在软对齐分布下 annotation 的期望。因为 weighted sum 和 softmax 都可微，翻译损失能同时训练 encoder、alignment network 和 decoder。

核心不是把 `α` 画成漂亮热图，而是取消单一固定向量的信息瓶颈：源序列成为一张内容可寻址的只读内存，每个输出步都可选择不同位置。

## 怎么理解和实现

把翻译想成边写边查原文。decoder state 是当前问题，`h_j` 是带上下文的索引卡；加性网络计算匹配度，softmax 得到读头位置，context 是一次模糊读取。软读取允许同时参考多个词，例如法语冠词可能需要联合看英文冠词与名词；代价是每个目标步遍历全部源位置，复杂度 `O(T_x T_y)`。

[`src/ilya30/sequence.py`](https://github.com/keepkeen/keepkeen.github.io/blob/main/public/code/ilya30/src/ilya30/sequence.py) 实现稳定的 additive attention、padding mask 和 context 计算。测试验证 masked token 权重为零、其余权重归一化，并用构造参数让 query 精确偏向指定 annotation。它复现机制而非当年的 348M 词 WMT 训练；完整系统还需 GRU、beam search、UNK/子词处理和评测协议。

## 前序与竞争路线

[Sutskever et al. seq2seq](https://arxiv.org/abs/1409.3215) 用 LSTM encoder 的最后状态表示源句，并通过反转源词序缩短部分依赖路径；[Cho et al. Encoder–Decoder](https://arxiv.org/abs/1406.1078) 引入 GRU 和短语评分。两者都受固定向量限制。传统统计机器翻译则先估计词/短语对齐、语言模型和重排序，模块可解释但难以联合优化。

同期 [Neural Image Caption attention](https://arxiv.org/abs/1502.03044) 把软/硬注意力用于图像区域；[Luong et al.](https://arxiv.org/abs/1508.04025) 比较 dot/general/concat score 和 local attention，点积更适合矩阵乘法。[Transformer](/blog/ilya-reading-14-attention-is-all-you-need/) 最终去掉 RNN，让 self- 和 cross-attention 承担全部位置通信。单调注意力、CTC/RNN-T 则把对齐约束用于语音/流式任务，牺牲任意跳转换取在线解码和更低搜索空间。

## 论文证据、优缺点

WMT14 英法实验中，训练到长度 50 的 RNNsearch 得到 26.75 BLEU，延长训练版本 28.45；对应固定向量 RNNencdec 为 17.82。只评估无未知词句子时 RNNsearch-50 达 34.16，接近使用额外单语数据的 Moses 35.63。按句长曲线显示 fixed-vector 模型随长度明显恶化，attention 模型到 50 词以上仍较稳。

优点是缓解瓶颈、可端到端学习非单调软对齐、对变长输入自然，且权重提供可诊断信号。局限是二次对齐成本、RNN decoder 仍串行；softmax 分布可能过散或错位；训练时 teacher forcing 与推理暴露偏差仍在；权重可视化不等于忠实因果解释。原实验 30k 词表导致大量 UNK，后来的 BPE/wordpiece 解决的是另一层问题。

## 跨领域应用

摘要、问答、图像描述、语音、时间序列检索、外部记忆和多模态融合都可使用“query—keys—weighted values”。迁移时应问：记忆单元是什么、query 来自何处、是否允许非单调回看、必须软读还是硬选、mask 表示哪些合法约束。

## 阅读检查

- 固定向量瓶颈发生在何处，attention 如何绕开？
- `α_ij` 为什么可解释为概率，却不能自动视作正确的人类对齐？
- additive 与 dot-product attention 的主要计算差异是什么？
- 若任务必须流式输出，双向 encoder 和任意软对齐会带来什么问题？
