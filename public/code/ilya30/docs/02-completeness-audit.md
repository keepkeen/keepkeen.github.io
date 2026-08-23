# 按最初八项要求做的完备性审计

## 审计结论

30 个条目都已经覆盖“推荐理由、贡献/理论、核心思想、理解/实现、优缺点、跨领域应用、必要补充、代码判断”，并把前驱、同期替代方案和直接后续工作放回各章。这里的“通过”指信息项存在且有证据边界，不等于每项都做了全规模训练复现。

最大的历史限制无法靠多写内容消除：公开材料只保留 27 项，而 Carmack 记得原清单约有 40 项。28–30 是为了构成 30 项课程而做的元学习编辑补全，不是对全部缺项的恢复，也不是 Ilya 本人确认的三篇。详细证据见[出处、边界与研究方法](00-provenance-and-method.md)。

## 八项要求怎样落到章节

1. **为什么推荐：** 每章先标“保留清单”或“编辑候选”，再说明已知事实和课程作用推断；没有逐篇原话时不虚构 Ilya 的心理动机。
2. **核心贡献与理论：** 给出论文的问题定义、关键公式、成立条件和作者真正验证过的主张。
3. **核心思想：** 用一句话定位和直觉模型把公式与问题连接起来。
4. **理解与实现：** 按数据流或训练循环拆步骤，并指出最常见实现错误。
5. **优缺点：** 同时写有效条件、计算代价、实验外推边界和失败模式。
6. **其他领域：** 迁移时说明可复用的抽象以及需要重定义的对象，而不只列应用名词。
7. **必要补充：** 加入前驱、同期路线、后续修正、今天怎么看、实验协议和阅读检查。
8. **代码：** 对仍重要且适合教学的机制提供独立 NumPy 实现和测试；对 AlexNet、GPipe、Deep Speech 2 等大系统解释不做“玩具代码等于复现”的误导。

## 逐项覆盖矩阵

“理论—实现”列对应要求 2–4，“边界—迁移”对应要求 5–7。所有章节标题都可点击回到正文。

| # | 身份与推荐理由（1） | 理论—理解—实现（2–4） | 相关路线与边界—迁移（5–7） | 代码判断（8） |
|---:|---|---|---|---|
| 01 | [保留项；论文到代码的桥](papers/01-annotated-transformer.md) | mask、多头、位置编码与完整数据流 | 对照原论文 post-norm、现代 pre-norm；迁移到任意 token 交互 | [`attention.py`](../src/ilya30/attention.py)，测试 mask/数值稳定性/多头变换 |
| 02 | [保留项；复杂性直觉的入口](papers/02-first-law-complexodynamics.md) | 熵、可压缩性与中间态假说 | 对照热力学熵、逻辑深度和后续纠错；迁移到演化过程诊断 | [`complexity.py`](../src/ilya30/complexity.py)，只实现可计算代理，不冒充 Kolmogorov complexity |
| 03 | [保留项；最小 RNN 的生成能力](papers/03-unreasonable-effectiveness-rnns.md) | BPTT、字符预测、采样温度 | 对照 n-gram、LSTM、Transformer；说明模仿与理解的差别 | [`sequence.py`](../src/ilya30/sequence.py)，RNN 前向与梯度链 |
| 04 | [保留项；长梯度通路](papers/04-understanding-lstm.md) | cell state、输入/遗忘/输出门 | 对照普通 RNN、GRU、残差路径；迁移到受控状态更新 | [`sequence.py`](../src/ilya30/sequence.py)，验证遗忘门极限 |
| 05 | [保留项；循环正则化](papers/05-rnn-regularization.md) | 非循环连接 dropout 与 locked mask | 对照 naive recurrent dropout、variational dropout；说明时间一致性 | [`sequence.py`](../src/ilya30/sequence.py)，同序列共享 mask 测试 |
| 06 | [保留项；压缩即泛化偏置](papers/06-keeping-networks-simple.md) | 权重量化、描述长度和 PAC-Bayes 关系边界 | 对照剪枝、Bayesian/variational 编码；迁移到模型选择 | [`complexity.py`](../src/ilya30/complexity.py)，码长与 NML 机制 |
| 07 | [保留项；动态输出词表](papers/07-pointer-networks.md) | 对输入位置做 attention 分布并自回归选择 | 对照 seq2seq attention、搜索/组合优化；讨论重复选择与 mask | [`sequence.py`](../src/ilya30/sequence.py)，pointer 分布和屏蔽 |
| 08 | [保留项；尺度化 CNN 的历史转折](papers/08-alexnet.md) | 卷积、ReLU、GPU、增强、dropout 的组合 | 对照 LeNet、手工特征、VGG/ResNet；迁移到系统共设计 | [`vision.py`](../src/ilya30/vision.py)，卷积/池化/形状与梯度检查；不做虚假 ImageNet 复现 |
| 09 | [保留项；先辨认集合对称性](papers/09-order-matters-set2set.md) | Read–Process–Write 与潜输出排列 | 对照 Pointer、Deep Sets、PointNet、Set Transformer、GNN；列出四个实现不变量 | [`sets.py`](../src/ilya30/sets.py)，置换不变 read trajectory 测试 |
| 10 | [保留项；模型跨设备流水](papers/10-gpipe.md) | micro-batch pipeline、bubble 与重计算 | 对照数据/张量/流水并行；澄清 83.9B 是容量结果 | [`systems.py`](../src/ilya30/systems.py)，schedule 与利用率公式 |
| 11 | [保留项；深度优化退化](papers/11-resnet.md) | `x+F(x)` 参数化和恒等梯度路径 | 对照 Highway、VGG、DenseNet；区分表达力与可优化性 | [`vision.py`](../src/ilya30/vision.py)，残差恒等与梯度乘积 |
| 12 | [保留项；不降采样扩大感受野](papers/12-dilated-convolutions.md) | 空洞卷积采样格与指数感受野 | 对照 pooling/deconvolution、ASPP、现代多尺度模块；说明 gridding | [`vision.py`](../src/ilya30/vision.py)，普通/空洞卷积等价边界 |
| 13 | [保留项；统一图网络语言](papers/13-neural-message-passing.md) | message、aggregate、update、readout | 对照 graph convolution、Weave、后续 GNN 表达限制；迁移到任意关系结构 | [`graphs.py`](../src/ilya30/graphs.py)，重命名等变性和 hop 半径 |
| 14 | [保留项；全注意力序列建模](papers/14-attention-is-all-you-need.md) | scaled dot-product、多头、位置与复杂度 | 对照 RNN/CNN/早期 attention；讨论平方成本与长上下文替代 | [`attention.py`](../src/ilya30/attention.py)，因果 mask、多头和位置编码 |
| 15 | [保留项；固定向量变软对齐](papers/15-bahdanau-attention.md) | additive attention、context 与联合翻译 | 对照 phrase-based SMT、固定向量 seq2seq、dot-product attention；迁移到检索式聚合 | [`sequence.py`](../src/ilya30/sequence.py)，对齐概率与 context |
| 16 | [保留项；clean identity path](papers/16-identity-mappings-resnet.md) | pre-activation 推导和信号直通 | 对照原 ResNet post-activation、门控 shortcut、现代 normalization | [`vision.py`](../src/ilya30/vision.py)，shortcut 梯度机制 |
| 17 | [保留项；显式关系归纳偏置](papers/17-relation-networks.md) | 对对象对应用 `g_θ` 后求和再 `f_φ` | 对照 CNN 隐式关系、Interaction Networks、MPNN；讨论平方对象对 | [`graphs.py`](../src/ilya30/graphs.py)，方向性与排列不变性 |
| 18 | [保留项；强 decoder 下的信息分工](papers/18-variational-lossy-autoencoder.md) | ELBO、free bits、局部/全局潜变量 | 对照 VAE、PixelCNN、自回归模型；讨论 posterior collapse | [`variational.py`](../src/ilya30/variational.py)，重参数化、KL、ELBO 与 Monte Carlo 核验 |
| 19 | [保留项；记忆槽之间做注意力](papers/19-relational-rnns.md) | RMC 的多槽 attention 与门控更新 | 对照 LSTM、NTM、Relation Network、Transformer；迁移到状态式关系推理 | [`memory.py`](../src/ilya30/memory.py)，槽置换等变和输入依赖 |
| 20 | [保留项；学习如何推翻漂亮结论](papers/20-coffee-automaton.md) | 粗粒化、表观复杂度与排他过程 | 纳入作者撤回和 Liggett 结果；迁移到仿真实验审计 | [`complexity.py`](../src/ilya30/complexity.py)，只保留守恒、可复现实验，不复述错误正结论 |
| 21 | [保留项；可微读写寻址](papers/21-neural-turing-machines.md) | 内容/位置寻址、erase-add、读头 | 对照 Neural Stack、Memory Networks、DNC/Transformer；讨论容量与访问成本 | [`memory.py`](../src/ilya30/memory.py)，完整寻址链和读写不变量 |
| 22 | [保留项；端到端语音系统](papers/22-deep-speech-2.md) | CTC 边缘化、深双向网络与系统工程 | 对照 HMM-DNN、attention、RNN-T；讨论流式性与语言模型 | [`ctc.py`](../src/ilya30/ctc.py)，log-space DP 与穷举 oracle 一致 |
| 23 | [保留项；可预测的尺度规律](papers/23-scaling-laws.md) | 幂律拟合、算力约束与 allocation | 对照 Kaplan/Chinchilla 和计数口径修正；迁移到预算规划 | [`systems.py`](../src/ilya30/systems.py)，拟合、floor 敏感性与 `6ND` 搜索 |
| 24 | [保留项；用码长统一拟合与复杂度](papers/24-mdl-tutorial.md) | two-part、one-part、NML 与 regret | 对照 AIC/BIC、Bayes、prequential coding；迁移到模型比较 | [`complexity.py`](../src/ilya30/complexity.py)，Bernoulli NML 归一化和模型代价 |
| 25 | [保留项；把通用智能写成目标](papers/25-machine-super-intelligence.md) | 环境加权、策略期望与不可计算边界 | 对照 AIXI、Legg–Hutter、现实 benchmark；讨论规范与安全缺口 | [`universal.py`](../src/ilya30/universal.py)，只实现显式有限环境近似 |
| 26 | [保留项；算法信息论底座](papers/26-kolmogorov-complexity.md) | 不变性、不可计算性、随机性与充分统计量 | 对照 Shannon、MDL、algorithmic statistics；迁移到压缩式推理 | [`complexity.py`](../src/ilya30/complexity.py)，明确 compressor 只是上界代理 |
| 27 | [保留项；训练与调试实践底座](papers/27-cs231n.md) | 反向传播、初始化、优化、CNN 工程链 | 区分 2016 课程与后续活文档；对照现代 autodiff/训练配方 | [`vision.py`](../src/ilya30/vision.py) 等模块，用有限差分验证实现 |
| 28 | [编辑候选；快知识放进外部状态](papers/28-memory-augmented-meta-learning.md) | episodic 标签绑定、内容寻址、LRUA | 对照 Siamese、Matching、RL²、SNAIL、ProtoNet/MAML；说明固定容量与任务错配 | [`memory.py`](../src/ilya30/memory.py) + [`meta.py`](../src/ilya30/meta.py)，寻址/替换/标签重排 |
| 29 | [编辑候选；度量式元学习代表](papers/29-prototypical-networks.md) | 类均值、Bregman 几何、即时线性分类器 | 对照 Siamese/Matching/Relation、Gaussian prototype、TPN；讨论单峰与 transductive 协议 | [`meta.py`](../src/ilya30/meta.py)，prototype、概率与线性等价性 |
| 30 | [编辑候选；优化式元学习代表](papers/30-maml.md) | 双层目标、Hessian 元梯度、FOMAML | 对照 Meta-SGD、Reptile、ANIL、iMAML 与上下文适应；讨论任务分布和计算成本 | [`meta.py`](../src/ilya30/meta.py)，解析二次实验与有限差分核验 |

## 这次反查补上的缺口

- 将“约 40 项原清单、27 项幸存、只补三篇课程候选”的区别写进首页和出处页，避免“30”造成伪精确感。
- 为 28–30 的 Siamese、Matching Networks、RL²、SNAIL、Relation Networks、Meta-SGD、Reptile、ANIL、iMAML 等比较补上原始论文链接。
- 扩写第 09 章的实现不变量和路线对照，使“集合不变性”能从文字落到测试。
- 修复第 30 章外层更新公式中的损坏字符，并增加全库不可见控制字符扫描。
- 增加 [`examples/core_mechanisms.py`](../examples/core_mechanisms.py)，把四个最核心且可在 CPU 上验证的机制串成一个入口。

## 仍然不能声称的事情

- 不能把 28–30 说成 Ilya 历史上亲自推荐的标题，也不能声称已经找回原约 40 项清单。
- 最小实现验证算法不变量，不等于复现论文数据集、训练预算和榜单数字。
- “学完掌握 90%”是 Carmack 对 2020 年交流的转述，不是 2026 年知识覆盖率；扩散、RLHF/指令微调、MoE、RAG、现代多模态和推理时计算仍需另行学习。
