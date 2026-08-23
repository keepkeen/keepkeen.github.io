---
title: "27. CS231n（2016）：从梯度检查到训练 ImageNet 网络的实践底座"
description: "CS231n 不是单篇论文，而是一条“亲手写出并调通网络”的训练路径：数据划分、线性分类器、loss、解析/数值梯度、反向传播、初始化、正则、优化、卷积尺寸、经典架构、可视化、检测/分割、RNN 和工程瓶颈。它把书单中的许多局部突破装回一个能工作的完整流程。"
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
seriesOrder: 27
---
> **材料：** Stanford Winter 2016 课程，Fei-Fei Li、Andrej Karpathy、Justin Johnson　**出处状态：** 27 项保留清单　**历史主页：** [CS231n 2016](https://cs231n.stanford.edu/2016/)　**历史大纲：** [2016 syllabus](https://cs231n.stanford.edu/2016/syllabus.html)　**持续更新笔记：** [cs231n.github.io](https://cs231n.github.io/)

## 一句话定位

CS231n 不是单篇论文，而是一条“亲手写出并调通网络”的训练路径：数据划分、线性分类器、loss、解析/数值梯度、反向传播、初始化、正则、优化、卷积尺寸、经典架构、可视化、检测/分割、RNN 和工程瓶颈。它把书单中的许多局部突破装回一个能工作的完整流程。

## 为什么会被推荐

**已知**：公开保留清单指向 CS231n；2016 版本由 Karpathy 等授课。没有 Ilya 的逐项解释。**合理推断**：只读前沿论文容易会说名词却不会诊断训练。CS231n 强迫学习者从 kNN/linear classifier 和 gradient check 开始，理解每个张量、loss 与 update，再看 AlexNet/ResNet；这是建立可迁移工程直觉的高性价比材料。

## 课程的核心知识链

1. **问题与数据**：train/validation/test 必须分离；kNN 暴露距离度量、维数灾难和 cross-validation；linear score `s=Wx+b` 建立参数化模型。
2. **目标**：multiclass SVM hinge 与 softmax cross-entropy 对 margin/概率做不同假设；L2/dropout/Data augmentation 控制泛化。
3. **计算图**：链式法则按局部 Jacobian 反传；中心差分只用于小规模 gradient check，不能替代 analytic backprop。
4. **优化**：SGD、momentum、RMSProp/Adam、学习率、初始化和激活分布；先做 chance-loss、tiny-batch overfit 和 update ratio 等 sanity checks。
5. **CNN**：local connectivity 与 weight sharing 编码平移结构；输出尺寸 `(W-F+2P)/S+1`；感受野、stride、padding、pooling 与通道共同决定计算和空间信息。
6. **系统与任务**：AlexNet/VGG/GoogLeNet/ResNet，定位检测、可视化、风格/对抗样例、RNN captioning、transfer learning 和分布式/硬件瓶颈。

课程价值不在背架构年份，而在调试顺序：先验证数据和 loss，再数值梯度，再让小数据过拟合，最后扩大规模；训练失败时区分实现 bug、优化困难、正则过强和数据分布问题。

## 代码怎么安排

本项目不复制课程作业答案。核心 NumPy 机制分别在 [`vision.py`](https://github.com/keepkeen/keepkeen.github.io/blob/main/public/code/ilya30/src/ilya30/vision.py)、[`sequence.py`](https://github.com/keepkeen/keepkeen.github.io/blob/main/public/code/ilya30/src/ilya30/sequence.py) 和 [`attention.py`](https://github.com/keepkeen/keepkeen.github.io/blob/main/public/code/ilya30/src/ilya30/attention.py)：softmax/cross-entropy、gradient check、卷积/空洞卷积、残差、RNN/LSTM 与 attention。tests 将解析梯度和数值梯度对照，并检查卷积尺寸。

建议实际动手顺序：先在 CIFAR-10 小 batch 上让线性/两层网过拟合；手写 `im2col` 或朴素 conv 理解索引；再用 PyTorch 复现小 ResNet。完整 ImageNet 训练成本高，理解机制不要求复刻 2016 的 GPU/框架栈。

## 与论文书单的连接

[AlexNet](/blog/ilya-reading-08-alexnet/) 是课程历史转折点；[ResNet](/blog/ilya-reading-11-resnet/) 解释如何继续加深；[dilated convolution](/blog/ilya-reading-12-dilated-convolutions/) 改造 dense prediction 感受野；RNN/LSTM 和 attention 把视觉扩到 captioning。CS229/统计学习提供更广数学底座，Goodfellow–Bengio–Courville 的 *Deep Learning* 给系统教材，CS224n 聚焦语言。

2016 课程使用 Caffe/Torch/Theano/TensorFlow 并围绕 CNN/RNN；[当前笔记](https://cs231n.github.io/) 已加入 Transformer captioning、自监督、diffusion、CLIP/DINO。历史版本适合理解基本机制，现代学习还需补 ViT、foundation models、数据治理、calibration、公平/安全和高效训练。

## 优点、局限与跨领域

优点是讲解直观、公式与代码相连、调试建议耐久、课程作业形成闭环。局限是部分页面多年增补导致“2016 内容”和当前内容混合；早期框架/API 过时；以视觉和 supervised ImageNet 为中心；课程例子不能替代概率、线代与系统训练。

其工作流可迁移到任何 ML 领域：建立最简单 baseline，锁定评价协议，检查梯度和数据，先过拟合小样本，再逐项加复杂度并做消融。卷积本身未必跨领域适用，但这套实验卫生几乎普适。

## 阅读检查

- 数值 gradient check 应在什么规模和精度下使用，为什么不用于正式训练？
- chance loss、tiny-set overfit 分别能排除哪些 bug？
- 卷积的 local connectivity 和 weight sharing 分别带来什么归纳偏置？
- 2016 课程需要补哪些现代主题，哪些训练调试原则仍未过时？
