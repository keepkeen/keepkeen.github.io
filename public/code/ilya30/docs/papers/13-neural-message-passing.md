# 13. Neural Message Passing：用一个框架统一分子图网络

> **论文：** Gilmer et al.，ICML 2017　**出处状态：** 27 项保留清单　**原文：** [arXiv:1704.01212](https://arxiv.org/abs/1704.01212)

## 一句话定位

MPNN 把一大批图神经网络归纳为两个阶段：节点沿边发送并聚合消息，反复更新局部状态；最后用对节点排列不敏感的 readout 得到整图预测。它既是具体分子性质模型，也是至今仍通用的 GNN 接口语言。

## 为什么会被推荐

**已知**：它在保留清单，论文作者包括 Oriol Vinyals。没有 Ilya 的逐篇理由。**合理推断**：它展示了“关系是数据结构，不应硬塞进序列或网格”。同一套学习机制可处理不同大小、不同连接的对象，并显式加入边类型、距离和守恒/对称性。这与 Relation Networks、Relational RNN 和 Transformer 的全连接消息传递构成一条关系推理主线。

## 核心理论与算法

对图 `G=(V,E)`，节点状态为 `h_v^t`，边特征为 `e_vw`。每一步：

`m_v^{t+1} = Σ_{w∈N(v)} M_t(h_v^t,h_w^t,e_vw)`

`h_v^{t+1} = U_t(h_v^t,m_v^{t+1})`。

运行 `T` 步后，整图输出为 `ŷ = R({h_v^T, x_v | v∈V})`。邻居聚合用求和，readout 作用于集合，因此节点重编号不会改变图级输出；这就是图同构所需的 permutation invariance。`T` 也给出信息传播半径：稀疏图中一个节点最多接收 `T` hop 的信息。

论文的重要贡献是**统一**而非声称所有 GNN 相同。Duvenaud neural fingerprints、GG-NN、Interaction Networks、谱图卷积、SchNet 前身式连续滤波等都可由不同 `M/U/R` 表示。作者再比较 edge network（让边特征生成消息矩阵）、pair message、GRU 更新、master node、virtual edges、Set2Set readout 和 towers。

## 怎么理解和实现

把每条边看作带上下文的“邮件”：消息函数决定写什么，sum 决定收件箱与邻居顺序无关，更新函数决定如何把新邮件并入旧记忆。分子中原子是节点，键类型和原子间距离是边特征；对全局性质，readout 必须把任意原子数压到固定维表示。

[`src/ilya30/graphs.py`](../../src/ilya30/graphs.py) 实现单步 MPNN 和 invariant readout。测试会一致地置换节点与边端点索引，验证图级输出相同，并验证 `T` 步只能越过 `T` 条边。这比复刻完整 QM9 训练更能暴露机制；真实分子建模可使用 [PyTorch Geometric MessagePassing](https://pytorch-geometric.readthedocs.io/en/latest/generated/torch_geometric.nn.conv.MessagePassing.html)。

## 前序、同期和后续工作

早期 [GNN](https://doi.org/10.1109/TNN.2008.2005605) 用迭代收敛状态定义图网络；[Neural Fingerprints](https://arxiv.org/abs/1509.09292) 把圆形分子指纹变成可微卷积；[GG-NN](https://arxiv.org/abs/1511.05493) 用 GRU 在固定步数内传播；[Interaction Networks](https://arxiv.org/abs/1612.00222) 为物体关系和物理动力学设计 relation-centric 更新。MPNN 把这些结构放进同一坐标系并系统实验。

后来的 [GraphSAGE](https://arxiv.org/abs/1706.02216) 强调归纳式邻居采样，[GAT](https://arxiv.org/abs/1710.10903) 学习邻居权重；[GIN](https://arxiv.org/abs/1810.00826) 用 Weisfeiler–Lehman 检验刻画普通消息传递的区分能力；[SE(3)-equivariant](https://arxiv.org/abs/2102.09844) 模型让三维旋转/平移对称性进入表示。这些工作回应了 MPNN 的扩展、表达力和物理对称性局限。

## 论文证据、优缺点

在 QM9 的 13 个量子化学目标上，最佳 edge-network + Set2Set 模型全部达到当时 SOTA，并在 11/13 个目标上达到作者采用的“chemical accuracy”阈值。这里标签来自 DFT 近似，达到相对 DFT 的阈值不代表超过真实实验误差。消融还显示显式氢、距离、长程连接和按目标单独训练很重要；只用拓扑时，master node、virtual edge 或 Set2Set 能缓解长程信息不足。

优点是结构归纳偏置强、参数可跨图规模共享、边信息自然、节点重编号不敏感。局限包括：深层反复平均导致 over-smoothing；远距离需要许多步会 over-squashing；普通 MPNN 无法区分某些非同构图；全连接空间边为 `O(|V|²)`；预测相关性不自动满足能量守恒或量纲规律。

## 跨领域应用

社交/推荐、交通路网、程序分析、知识图谱、蛋白质、材料、物理模拟和多智能体系统都可用相同接口。迁移时最关键的不是换个数据集，而是明确：节点/边各表示什么，对称群是什么，目标是节点、边还是整图，长程信息通过几步或哪种全局通道传播。

## 阅读检查

- 哪一处保证节点重编号不改变图级预测？
- `T` 步消息传递的感受野多大？master node 为什么能缩短路径？
- “达到 chemical accuracy”为什么不能解释为真实量子实验已经解决？
- attention、Relation Network 与 MPNN 在什么条件下可互相表示？
