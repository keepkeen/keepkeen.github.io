# 28. Memory-Augmented Neural Networks：把一次性学习变成“写入—检索”

> **论文：** Adam Santoro, Sergey Bartunov, Matthew Botvinick, Daan Wierstra, Timothy Lillicrap, 2016　**原文：** [arXiv:1605.06065](https://arxiv.org/abs/1605.06065)　**出处状态：** 元学习主题的编辑候选，**不是已确认的 Ilya 推荐项**

## 一句话定位

这篇论文把 few-shot classification 设计成一个有外部记忆的序列任务：模型见到新样本后立即把“表示—临时标签”绑定写入记忆，再用内容寻址找回；它不靠许多步梯度更新，而靠一次 episode 内的快速状态变化完成学习。

## 为什么把它列为候选，而不是冒充原清单

公开保留材料只说明原资料缺了一组 “Meta Learning”，没有留下标题。因此不能声称 Ilya 亲自推荐过本文。把它作为第 28 项的编辑理由是：它与清单中 [Neural Turing Machines](21-neural-turing-machines.md) 的可微外部记忆直接相连，又把“记忆架构”变成可测量的快速学习机制；作者 Santoro、Botvinick、Lillicrap 后来也沿此路线研究关系推理与记忆。

如果站在整套书单的知识结构看，它回答一个关键问题：**权重负责跨任务积累慢知识，那么单个新任务中的快知识放在哪里？** MANN 的回答是外部记忆。这个理由是编辑推断，不是 Ilya 的逐篇说明。

## 当时的问题：类别是新的，标签的含义也是临时的

传统监督学习假设训练与测试共享固定类别，靠大量带标签样本慢慢改变权重。one-shot learning 的测试 episode 却会出现从未见过的类别，而且标签会在每个 episode 中随机重排：同一个数字 `3` 这次可能代表某种字母，下次又代表另一种字母。网络不能把固定标签语义背进长期权重，只能现场学会绑定。

论文把 episode 排成错位序列：

\[
(x_1,\varnothing),(x_2,y_1),\ldots,(x_t,y_{t-1}),
\qquad \hat y_t=f(x_t,y_{t-1},\text{memory}).
\]

在时刻 \(t\)，模型看到当前图片 \(x_t\)，但只得到上一张图片的标签 \(y_{t-1}\)，必须预测当前标签 \(y_t\)。这种时间错位很重要：若把 \(x_t,y_t\) 同时输入，任务会泄漏答案；若标签在 episode 间不打乱，模型又可能退化为普通长期分类器。

## 核心贡献与理论主张

### 1. 把元学习训练成 episode 内的序列预测

每个 episode 都重新抽类别、样本和标签映射。网络的慢参数通过许多 episode 学习一套通用策略；外部记忆在 episode 内存放具体实例及临时标签。这里的 “learning to learn” 不是神秘的新优化器，而是两种时间尺度：

- **慢学习**：反向传播更新 controller、embedding 和读写策略；
- **快学习**：不更新权重，直接改变 memory state，把刚见过的信息留到之后查询。

### 2. 内容寻址负责“像不像”，LRUA 负责“写到哪里”

给定 key \(k_t\) 和第 \(i\) 个 memory slot \(M_t(i)\)，内容读权重由余弦相似度和 softmax 得到：

\[
w_t^r(i)=\frac{\exp\{K(k_t,M_t(i))\}}
{\sum_j\exp\{K(k_t,M_t(j))\}},\qquad
r_t=\sum_i w_t^r(i)M_t(i).
\]

读操作因而可以对相似样本做软检索。写操作则采用 **Least Recently Used Access（LRUA）**。一个简化但抓住本质的使用度更新是

\[
u_t=\gamma u_{t-1}+w_t^r+w_t^w,
\]

其中 \(0<\gamma<1\) 让旧使用记录衰减。写权重在“刚刚读到的位置”和“最少使用的位置”之间门控：前者用于更新已有绑定，后者用于分配新绑定。与 NTM 的位置移位寻址相比，这更贴合 few-shot cache 的需求。

### 3. 用标签重排迫使模型学习绑定算法

如果类别 7 永远对应标签 7，网络可以在参数里记类别。论文在 episode 内随机分配标签，切断这种捷径。于是有效策略是：第一次出现时保存图像表示；下一步标签到达时补全绑定；再次出现相似图像时按内容检索。这是一种通过任务构造施加的可识别性约束，后来 episodic few-shot learning 普遍沿用。

## 怎么理解，又怎么实现

可以把 MANN 想成一个可训练的键值缓存：CNN 把图片变成 key，LSTM controller 结合上一标签生成读写参数，memory slot 保存类别实例与标签绑定，读向量再参与当前分类。

一个 episode 的最小实现顺序是：

1. 清空外部记忆和 usage；随机置换本 episode 标签。
2. 编码当前样本，并把上一时刻标签一起交给 controller。
3. 以 controller 产生的 key 对所有 slots 做 cosine-softmax 读取。
4. 由 controller 输出和 read vector 预测当前标签，计算 cross-entropy。
5. 用 LRUA 选旧 slot 或空闲 slot，把当前绑定写入；进入下一步。
6. 整个 episode 展开后反向传播，学习“怎样读写”，而不是在测试 episode 内更新参数。

本项目在 [`memory.py`](../../src/ilya30/memory.py) 实现内容寻址、usage 衰减和概率归一化的单读头 LRUA 写权重；[`meta.py`](../../src/ilya30/meta.py) 实现 episode 标签重排。它们是机制测试，不是论文四读头配置或 Omniglot 全规模复现。

## 实验说明了什么

论文在 Omniglot 上按“某类别第几次出现”报告准确率，因为这比总平均更能显示一次学习是否发生。5-way、one-hot 标签条件下，MANN 在第二次出现时达到 82.8%，第五次 94.9%，第十次 98.1%。更难的字符串标签实验中，5-way MANN-LSTM 从第二次的 69.5% 升至第十次的 93.1%；15-way LRUA-LSTM 从 62.6% 升至 95.3%，同设定的 NTM-LSTM 是 35.4% 到 88.4%。

这些结果支持“学到快速写入/检索策略”，但不证明任意分布上的通用元学习。Omniglot 类内变化小、episode 短、记忆可重置；数字也依赖当时的数据划分、增强、标签编码和网络规模，不能直接同后来论文横比。

## 同期与后续工作怎样解同一个问题

- **[Siamese Networks（2015）](https://www.cs.cmu.edu/~rsalakhu/papers/oneshot1.pdf)** 学一个成对相似度，测试时以最近邻完成 one-shot；机制简单，但没有显式 episode 记忆控制器。
- **[Matching Networks（2016）](https://proceedings.neurips.cc/paper/2016/file/90e1357833654983612fb05e3ec9148c-Paper.pdf)** 对整个 support set 做 attention，用标签加权预测 query；同样是非参数快速状态，但读的是显式 support，而非学会写入的持久 memory。
- **[Prototypical Networks](29-prototypical-networks.md)（2017）** 把每类 support 压成一个均值原型，归纳偏置更强、优化更稳，却丢掉类内多模态细节。
- **[MAML](30-maml.md)（2017）** 不维护外部记忆，而是学习一个经少数梯度步即可适应的初始化；适用模型更广，但内循环成本更高。
- **[RL²](https://arxiv.org/abs/1611.02779)、[Learning to reinforcement learn](https://arxiv.org/abs/1611.05763) 与 [SNAIL](https://openreview.net/forum?id=B1DmUzWAW)** 都把一个任务包装成序列，让循环状态、temporal convolution 或 attention 承载快知识；后来的 Transformer in-context learning 把同一思路扩大到长 token 序列。它们延续了“前向状态就是学习过程”的观点，只是记忆结构、训练信号和规模不同。

## 优点、缺点与失败条件

优点是测试时无需反向传播；读写可微、端到端训练；标签重排有效阻止固定分类器捷径；显式 slots 便于观察何处被读写。它也展示了架构归纳偏置能把优化问题变成检索问题。

缺点是 memory 的容量和带宽固定，读全部 slots 的代价随容量线性增长；cosine 检索依赖 embedding 已经把同类放近；LRUA 是人为设计的替换策略，不一定适合长时、连续或非平稳任务；训练 episode 与部署任务不匹配时，模型会学错适应策略。memory 每集清空还能回避跨 episode 干扰、遗忘和隐私问题。把演示任务做好，不等于解决开放世界 continual learning。

## 能否迁移到其他领域

只要任务含有“少量现场示例 + 随后查询”，就可把快信息放进外部状态：个性化推荐中的新用户偏好、机器人临时目标、故障诊断中新设备模式、对话中的实体绑定、程序执行中的变量表。迁移时应先问三件事：什么是 key，什么是 value，旧记录何时该被替换。若目标主要靠缓慢统计规律而非实例检索，参数更新或原型法往往更合适。

## 阅读检查

- 为什么 episode 内打乱标签能阻止普通分类器走捷径？
- 当前标签为什么延迟一步输入？
- 内容寻址与 LRUA 分别解决“读什么”和“写哪里”的哪一半问题？
- MANN 的前向适应与 MAML 的梯度适应，在计算成本和表达能力上怎样交换？
