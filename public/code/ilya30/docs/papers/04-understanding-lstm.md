# 04. Understanding LSTM Networks：门控如何建立一条较稳定的记忆路径

> **材料类型：** 可视化教程（Christopher Olah，2015）　**出处状态：** 27 项保留清单　**原文：** [Understanding LSTM Networks](https://colah.github.io/posts/2015-08-Understanding-LSTMs/)

## 一句话定位

这篇教程用图和逐项公式解释 LSTM：它把记忆状态设计成加法更新，并用遗忘、写入和输出三个门控制信息流，从而缓解普通 RNN 中反复非线性变换造成的长距离梯度消失。

## 为什么会出现在清单中

**已知**：它与字符 RNN、RNN 正则化连续出现在部分清单中。**合理推断**：读者需要在看系统实验前理解门控记忆的计算图。Olah 的贡献是解释质量；它让“LSTM 能记很久”变成一条可沿公式检查的状态和梯度路径，而非架构神话。

## 问题背景、相关工作和同期方案

普通 RNN 每步都把旧状态乘矩阵再过饱和非线性。跨很多步的梯度是 Jacobian 连乘，容易趋零或爆炸。[Hochreiter 与 Schmidhuber 1997](https://www.bioinf.jku.at/publications/older/2604.pdf) 提出 LSTM 和 constant error carousel；[Gers 等人的 forget gate](https://direct.mit.edu/neco/article/12/10/2451/6415/Learning-to-Forget-Continual-Prediction-with-LSTM) 让模型主动清空过时状态；peephole 连接让门观察 cell。2014 年的 [GRU](https://arxiv.org/abs/1406.1078) 合并若干门，参数更少。2015 年大规模架构搜索发现 forget gate 和 output gate 很关键，但没有一个变体在所有任务上绝对最好（[Jozefowicz et al.](https://proceedings.mlr.press/v37/jozefowicz15.html)）。

## 核心公式与直觉

常见 LSTM 先由当前输入 `x_t` 和旧隐藏状态 `h_{t-1}` 计算：

- `f_t = σ(W_f[x_t,h_{t-1}]+b_f)`：保留多少旧记忆；
- `i_t = σ(W_i[...]+b_i)`，`g_t = tanh(W_g[...]+b_g)`：写入幅度与候选内容；
- `c_t = f_t ⊙ c_{t-1} + i_t ⊙ g_t`：加法更新 cell；
- `o_t = σ(W_o[...]+b_o)`，`h_t = o_t ⊙ tanh(c_t)`：向外暴露多少记忆。

理解重点在 `c_t` 的加法主干。忽略门自身对旧状态的间接依赖时，`∂c_t/∂c_{t-1}=f_t`。若一段时间内 `f_t≈1`，梯度可以较完整地传过；普通 RNN 则每步都必须穿过权重矩阵和 tanh。LSTM 改善了优化条件，但没有数学上保证无限记忆：多个小于 1 的 `f_t` 相乘仍会衰减，门饱和也会让门参数难学。

## 怎么实现和调试

实现时把四个仿射变换合并成一次矩阵乘法，再切成四块，效率更高。常见错误包括：候选 `g` 误用 sigmoid、cell 与 hidden 混淆、批维和特征维切错、初始 forget bias 设置不当、对 recurrent state 随意 dropout。可视化 `f/i/o` 的分布、cell 范数和梯度范数，比只看最终损失更容易定位问题。

[`src/ilya30/sequence.py`](../../src/ilya30/sequence.py) 给出与上述公式一一对应的 NumPy 单步实现，并用“遗忘门全 1、输入门全 0 时 cell 原样保持”这一不变量做测试。

## 优点和局限

LSTM 的优点是流式、每步复杂度固定、状态大小与序列长度无关，并能通过门学习不同时间尺度。相较 vanilla RNN，它在语言、语音、手写和时间序列上更稳。代价是每步约四组门计算、训练仍然顺序执行、固定维状态可能挤压详细历史。门的数值可解释性有限：看到 `f_t` 高只能说明保留当前 cell 分量，不能自动赋予它人类语义。

相对于注意力，LSTM 用固定状态压缩过去，内存和流式延迟有优势；注意力保留逐位置记忆，检索细节和并行训练更强，代价随上下文增加。混合模型、状态空间模型和线性注意力都在重新权衡这组成本。

## 跨领域应用

门控状态适用于金融与工业传感器、医疗纵向记录、控制、在线异常检测和音频流。迁移时要先判断任务是否需要精确回看特定历史位置；若需要，外部记忆或注意力通常比把一切压进 `c_t` 更自然。

## 阅读检查

- 加法 cell 更新与普通 RNN 的反复非线性更新有何本质差别？
- 遗忘门为什么既帮助记忆，也可能导致梯度衰减？
- `c_t` 与 `h_t` 分别承担什么角色？
- 何种部署约束会让 LSTM 比全注意力更合适？
