---
title: "29. Prototypical Networks：让少样本分类退化成“离哪个中心最近”"
description: "Prototypical Networks 用 episodic training 学一个 embedding，在每个新任务中把某类 support embeddings 的均值当作 prototype，再按 query 到各 prototype 的距离分类。它没有内循环梯度，也没有复杂外部记忆，却以非常强的“每类形成单簇”归纳偏置得到稳定的 few-shot baseline。"
date: 2026-08-23
tags:
  - deep-learning
  - paper-reading
  - ilya-reading-list
  - meta-learning
lang: zh-CN
featured: false
draft: false
series: ilya-sutskever-reading-list
seriesOrder: 29
---
> **论文：** Jake Snell, Kevin Swersky, Richard S. Zemel, 2017　**原文：** [arXiv:1703.05175](https://arxiv.org/abs/1703.05175)　**出处状态：** 元学习主题的编辑候选，**不是已确认的 Ilya 推荐项**

## 一句话定位

Prototypical Networks 用 episodic training 学一个 embedding，在每个新任务中把某类 support embeddings 的均值当作 prototype，再按 query 到各 prototype 的距离分类。它没有内循环梯度，也没有复杂外部记忆，却以非常强的“每类形成单簇”归纳偏置得到稳定的 few-shot baseline。

## 为什么把它列为候选

没有证据表明 Ilya 点名了这篇论文。它被放在编辑补全中的理由是：三篇候选需要覆盖元学习的不同“快适应载体”——[MANN](/blog/ilya-reading-28-memory-augmented-meta-learning/) 改状态/记忆，本文即时估计类别表示，[MAML](/blog/ilya-reading-30-maml/) 改模型参数。ProtoNet 又把 Matching Networks 的实例注意力压缩成一个可以推导、可以画图、可以复用的统计量，适合作为度量元学习的核心入口。

## 问题设定：每个 episode 都是一项小分类任务

一个 $N$-way、$K$-shot episode 包含 support set $S$：每个临时类别 $k$ 有 $K$ 个已标注样本；另有 query set 用于计算损失。训练时反复从训练类别采 episode，测试时换成从未见过的类别，但构造方式相同。

普通 mini-batch 分类学的是固定训练类权重。episodic training 学的是一个跨任务规则：“根据这次 support 构造分类器”。这仍然要求 train/test task distribution 足够相似；“能分类新类”并不等于能适应任意新任务。

## 核心贡献与核心理论

### 1. 每类均值就是即时参数

embedding 网络 $f_\phi$ 将输入映射到表示空间。类别 $k$ 的 prototype 为

$$
c_k=\frac{1}{|S_k|}\sum_{(x_i,y_i)\in S_k} f_\phi(x_i).
$$

query $x$ 的分类概率为

$$
p_\phi(y=k\mid x)=
\frac{\exp[-d(f_\phi(x),c_k)]}
{\sum_{k'}\exp[-d(f_\phi(x),c_{k'})]}.
$$

训练只需最小化 query cross-entropy；梯度穿过 prototype 均值回到 support 与 query 的 embedding。测试新类时无需再训练一组输出权重。

### 2. prototype 不是随手取平均：它对应 Bregman 几何

对平方 Euclidean 等 Bregman divergence，样本均值是使类内总散度最小的代表点；这与指数族分布的均值参数和混合模型有对应关系。因此“均值 + 合适距离”带有清楚的统计假设：每类在 learned space 中近似一个单中心簇。

平方 Euclidean 还有一个很实用的展开：

$$
-\|z-c_k\|^2
=2c_k^\top z-\|c_k\|^2-\|z\|^2.
$$

softmax 中与类别无关的 $-\|z\|^2$ 会消掉，所以 ProtoNet 等价于一个即时构造的线性分类器，权重 $2c_k$、偏置 $-\|c_k\|^2$。这解释了它为什么既像 nearest centroid，又能用标准 cross-entropy 端到端训练。

### 3. 距离选择本身就是归纳偏置

原文发现 squared Euclidean 明显优于 cosine distance。cosine 丢弃模长，而训练可能把置信度、类间 margin 编进模长；同时 Euclidean 与均值 prototype 的 Bregman 推导一致。结论不是“Euclidean 永远最好”，而是表示、聚合器与距离必须匹配。

## 怎么理解，又怎么实现

它可以看成“每集临时生成最后一层”：

1. 按 $N$-way、$K$-shot 采 support/query，且 train 与 test 的 shot 尽量一致。
2. 用同一个 encoder 编码全部样本。
3. 对 support 按临时标签分组并求均值，得到 $N$ 个 prototypes。
4. 计算每个 query 到所有 prototypes 的 squared distances。
5. 对负距离做 softmax，以 query 标签训练 encoder。
6. 测试时冻结 encoder，只用新 support 重算 prototypes。

当 support 每类只有一个样本时，prototype 就是该样本；在同一 embedding 和距离设定下，它接近 Matching Networks 的 one-shot 情形。多 shot 时，ProtoNet 先压缩每类再分类，计算从“对所有实例 attention”降为“对所有类别比较”，但类内多模态会被均值抹平。

本项目在 [`meta.py`](https://github.com/keepkeen/keepkeen.github.io/blob/main/public/code/ilya30/src/ilya30/meta.py) 提供 prototype、距离 logits 和概率的 NumPy 实现，并用“prototype logits 与线性 logits 只差 query 常数”做单元测试。

## 训练协议中容易被忽略的细节

- **episode way 会改变难度。** 原文在测试 5-way 时曾用更高-way 的训练 episode，让每次更新看到更多负类，往往改善表示；比较论文时必须对齐 train way。
- **shot 应尽量匹配。** 用 1-shot episode 训练的最优 embedding 不一定适合 5-shot，因为 prototype 方差和有效决策边界不同。
- **query 不能参与 prototype。** 否则就泄漏测试分布，变成 transductive 方法；若确实用 query 联合推断，必须显式标注协议。
- **类别划分必须隔离。** few-shot 的泛化对象是未见类别，不只是未见图片；按图片随机切分会虚高结果。

## 实验到底证明了什么

原文在 Omniglot 上报告 5-way 1-shot 98.8%、5-shot 99.7%，20-way 1-shot 96.0%、5-shot 98.9%。在 miniImageNet 上，其最佳报告为 1-shot $49.42\pm0.78$%、5-shot $68.20\pm0.66$%；两个数字涉及不同的训练 way 设置。

这些结果证明，一个极简 prototype rule 配合合适 episodic embedding，在当时基准上可胜过更复杂的 learned distance/attention 方法。它们没有证明真实世界新类也都呈单峰、类别均衡，且早期 miniImageNet 工作的 split、backbone、数据增强和置信区间协议并不完全统一，现代结果不能只按百分比横比。

论文还演示 zero-shot：不用 support 图片，而用类别 metadata 的 embedding 生成 prototype。这提示 prototype 不必来自样本均值，也可以来自文本、属性或其他模态；但映射质量成为新的瓶颈。

## 其他工作怎样解决同一问题

- **[Siamese Networks](https://www.cs.cmu.edu/~rsalakhu/papers/oneshot1.pdf)** 训练成对相似度，推理直观，却没有在 episode 中联合比较多个类别。
- **[Matching Networks](https://proceedings.neurips.cc/paper/2016/file/90e1357833654983612fb05e3ec9148c-Paper.pdf)** 对 support instances 做 attention，并使用 full-context embeddings；能保留实例细节，但结构和代价更复杂。
- **[Relation Networks](https://openaccess.thecvf.com/content_cvpr_2018/papers/Sung_Learning_to_Compare_CVPR_2018_paper.pdf)** 学非线性 relation module 取代固定距离，表达力更强，也更容易过拟合小基准。
- **MAML** 通过梯度更新整套可微模型，能超出 nearest-centroid 假设，代价是双层优化。
- **后续路线** 包括显式估计不确定性的 [Gaussian Prototypical Networks](https://arxiv.org/abs/1708.02735)，以及联合利用无标签 queries 的 [Transductive Propagation Network](https://arxiv.org/abs/1805.10002)。mixture prototypes、graph inference 和预训练 foundation embeddings 也都在放松“每类等方差单中心”的假设，但 transductive 方法使用了不同的测试信息，不能与 inductive ProtoNet 不加标注地横比。

## 优点、缺点与失败条件

优点：概念和代码极简；无测试时优化；类别数可动态变化；support 顺序不影响结果；prototype 可解释；在小数据上强归纳偏置往往比复杂元学习器稳。

缺点：均值假设会压扁多模态类；少数离群点可拉动中心；同一个全局距离隐含各类相似尺度；类别不平衡、层级标签和 domain shift 会破坏 episode 假设；效果高度依赖 encoder，强预训练模型的提升不能全归给 prototype rule。它也只直接解决分类，结构化输出需重新定义“prototype”和距离。

## 跨领域应用

文本意图识别可把新意图示例均值作为意图向量；医学影像可用少量病例形成病种中心；故障诊断、声纹、物种识别、检索和跨模态分类也能复用。若一个类别天然多中心，可改成多个 prototypes；若不确定性重要，可估 covariance 或后验分布；若 support 含噪，可用 robust mean、attention 或 trimmed aggregation。迁移的核心不是照搬均值，而是明确“什么空间里，什么中心统计量足够代表一类”。

## 阅读检查

- 为什么 squared Euclidean prototype classifier 等价于一个特殊线性分类器？
- Matching Networks 与 ProtoNet 在 one-shot 时何时等价，多 shot 时差在哪里？
- train way、test way 和 query 数量为什么属于实验定义，而非无关超参数？
- 当类内分布多模态或有离群点时，应修改 embedding、prototype 还是距离？
