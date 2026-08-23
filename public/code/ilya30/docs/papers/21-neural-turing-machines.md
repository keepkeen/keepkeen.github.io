# 21. Neural Turing Machines：让神经网络学习可微的读、写与寻址

> **论文：** Graves, Wayne & Danihelka，2014　**出处状态：** 27 项保留清单　**原文：** [arXiv:1410.5401](https://arxiv.org/abs/1410.5401)

## 一句话定位

NTM 把 controller 与外部 `N×M` memory matrix 相连。读写头不选一个离散地址，而产生对所有地址的软权重；读、擦除、添加、内容查找和地址移动全部可微，因此仅凭输入输出样例就能用梯度下降学出复制、关联检索和排序的近似算法。

## 为什么会被推荐

**已知**：它在保留清单，没有逐篇推荐语。**合理推断**：NTM 是“神经网络能否学习程序结构”的关键实验，也把 attention 明确解释为 memory addressing。它串起 LSTM 的门控存储、Pointer Network 的离散位置输出、Transformer 的内容检索和 meta-learning 的快速外部记忆。

## 核心读写操作

每个 head 产生归一地址权重 `w_t(i)≥0, Σ_iw_t(i)=1`。读取是凸组合：

`r_t = Σ_i w_t(i) M_t(i)`。

写入先逐元素擦除再添加：

`M̃_t(i)=M_{t-1}(i)⊙[1-w_t(i)e_t]`，

`M_t(i)=M̃_t(i)+w_t(i)a_t`。

若 `w` 很尖，行为近似随机存取；若很散，多格会被混合修改。erase/add 借鉴 LSTM forget/input gate，但存储容量可通过增加地址数扩展，controller 参数不必二次增长。

## 内容与位置寻址

内容权重以 cosine similarity 与 key strength `β` 得到：

`w_t^c(i)=softmax_i(β_t K(k_t,M_t(i)))`。

然后用 gate 在新内容地址和上一时刻地址间插值：`w^g=g w^c+(1-g)w_{t-1}`；与 shift distribution 做 circular convolution，让读头左右移动；最后以 `γ≥1` 幂次 sharpen。于是 head 可做三种操作：按内容跳转、找到内容后偏移一个地址、或沿上次位置连续扫描。

这个设计同时提供 associative array 和 tape。位置移动对 copy/generalization 很重要，却带来模糊累积；circular memory 还会在尾部回绕，任务若不允许就需额外边界机制。

## 怎么理解和实现

controller 像 CPU，hidden state 像寄存器，memory matrix 像 RAM，heads 像由网络输出参数控制的 DMA 指针。与真正计算机不同，地址和值都是连续软量，训练稳定但精确长程序会积累误差。

[`src/ilya30/memory.py`](../../src/ilya30/memory.py) 实现 cosine content addressing、interpolation、circular shift、sharpen、read 和 erase-add write。单元测试覆盖权重归一、one-hot 精确读写、全擦除和移位回绕；这些是核心可复用算子，不伪装成论文所有任务的训练复现。

## 当时与后续路线

LSTM 用固定 hidden/cell 存储，寻址隐含在通道中；[Memory Networks](https://arxiv.org/abs/1410.3916) 以多次内容注意读取事实，最初训练方案不完全端到端；NTM 同时解决写入和位置移动。[DNC](https://www.nature.com/articles/nature20101) 加动态分配、usage、temporal link matrix，能追踪写入顺序和图关系；但控制复杂、训练敏感。

Transformer 保留历史 token 作只读 memory，用并行 attention 换掉显式写头；RAG/向量数据库把检索扩展到不可微的大规模外部库；现代可微数据结构、stack/queue、neural programmer 和 tool-use 则加入更硬的执行约束。它们都在“软可训练”与“离散可靠、可外推”之间取舍。

## 论文证据、优缺点

在训练长度 1–20 的 copy 任务上，NTM 能推广到 50，甚至 120 时仍大体正确，LSTM 超过训练长度后迅速退化。关联回忆中 feedforward-controller NTM 约 30k episodes 接近零损失，LSTM 一百万仍未到零；priority sort 的写地址与 priority 近线性。repeat-copy 也暴露局限：能继续复制，却不能正确外推训练范围外的重复计数和结束标记。

优点是显式大容量、可视化寻址、内容与位置访问兼具、参数和 memory slots 解耦。局限是 `O(N)` dense addressing、软权重干扰、长过程数值漂移、controller/头超参数多；小型合成任务不能证明通用程序归纳；“Turing Machine”是架构类比，有限精度、有限 memory 的实例不是无条件通用计算证明。

## 跨领域应用

一次学习、键值缓存、可微数据库、地图构建、程序执行、规划和长期事件记忆都可借鉴。若数据规模很大，应以近邻检索/稀疏寻址替代全扫；若必须精确计数或执行，软 NTM 可生成控制信号，但关键状态最好交给离散工具验证。

## 阅读检查

- content addressing 与 location addressing 各解决什么失败情形？
- erase 和 add 为什么分两步，soft `w` 会造成何种干扰？
- copy 长度外推支持“学到算法”的哪些证据，又没有证明什么？
- Transformer KV cache、RAG 和 NTM memory 的写入/检索语义有何不同？
