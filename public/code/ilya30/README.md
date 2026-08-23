# Ilya Sutskever 必读材料：可核查的 30 项导读

这是一套面向初次系统学习深度学习的中文研究资料。它从网上流传的 “Ilya 推荐阅读清单” 出发，逐项解释原工作、同期替代路线、后续影响、实现方法、优缺点和迁移价值，并为关键机制提供可运行的最小实现。

## 先说明：公开证据不是“确凿的 30 篇论文”

John Carmack 在 2023 年回忆，Ilya Sutskever 当年给了他“大约 40 篇研究论文”，并说认真学完就能掌握当时 90% 的关键内容。Carmack 后来说明，原邮件受 Meta 两年自动删除政策影响已经丢失，他手中只剩一个并不完整的纸质活页夹。Ilya 没有公开逐项确认过完整清单。

2024 年公开流传的版本来自 Andrew Carr 保存的部分资料，共 27 项，而且缺少一组 “Meta Learning” 材料。这 27 项中有 19 篇常规论文，另有 4 篇博客/代码教程、2 本书或书章、1 篇博士论文和 1 门课程。原清单约有 40 项，因此公开材料可能还少约 13 项；把 27 项补成 30 项只是构造一套可学习的课程，**不是把全部历史缺项恢复出来**。本项目采用以下诚实口径：

- **01–27：保留清单。** 多个独立副本一致，但仍属于“高可信重建”，不是 Ilya 本人的正式发布。
- **28–30：候选补全。** 根据“缺失的是元学习部分”这一线索，选择当时最能形成完整技术链的三项工作。它们只作为编辑补充，绝不声称已经得到 Ilya 确认。
- 每章的“为什么推荐”均区分直接证据与编辑推断。没有逐篇推荐理由的原始记录时，只解释该材料在整套知识结构中承担的作用。

完整证据链和选择方法见 [出处、边界与研究方法](docs/00-provenance-and-method.md)。机器可读书目见 [`sources/catalog.yaml`](sources/catalog.yaml)。按用户最初八项要求逐章反查的结果见 [完备性审计](docs/02-completeness-audit.md)。

## 阅读方式

原清单的顺序不适合从零学习。建议先看 [依赖式阅读路线](docs/01-reading-path.md)，再进入各篇导读。每篇采用同一结构：

1. 一句话定位与阅读前提；
2. 为什么可能被放进清单（标明推断）；
3. 当时的问题、前驱工作和竞争路线；
4. 核心贡献、理论和公式；
5. 从直觉到实现；
6. 实验到底证明了什么；
7. 优点、缺点、失败条件；
8. 后续发展与今天仍保留的价值；
9. 跨领域迁移；
10. 代码、练习和原始来源。

## 章节索引

标记“候选”的 28–30 是编辑补全；其余为 27 项保留清单。

| # | 材料 | 主问题 |
|---:|---|---|
| 01 | [The Annotated Transformer](docs/papers/01-annotated-transformer.md) | 怎样把 Transformer 论文准确落成代码 |
| 02 | [The First Law of Complexodynamics](docs/papers/02-first-law-complexodynamics.md) | 有组织的复杂性为何常出现在演化中段 |
| 03 | [The Unreasonable Effectiveness of RNNs](docs/papers/03-unreasonable-effectiveness-rnns.md) | 一个简单循环模型为何能生成长结构 |
| 04 | [Understanding LSTM Networks](docs/papers/04-understanding-lstm.md) | 门控 cell 如何建立长梯度路径 |
| 05 | [Recurrent Neural Network Regularization](docs/papers/05-rnn-regularization.md) | dropout 怎样不破坏循环记忆 |
| 06 | [Keeping Neural Networks Simple](docs/papers/06-keeping-networks-simple.md) | 怎样以权重描述长度约束网络 |
| 07 | [Pointer Networks](docs/papers/07-pointer-networks.md) | 输出词表如何随输入长度变化 |
| 08 | [AlexNet](docs/papers/08-alexnet.md) | 数据、GPU、ReLU 与正则如何共同跨越尺度门槛 |
| 09 | [Order Matters / Set2Set](docs/papers/09-order-matters-set2set.md) | 怎样对无序集合编码和有序输出 |
| 10 | [GPipe](docs/papers/10-gpipe.md) | 单设备放不下的模型怎样流水训练 |
| 11 | [ResNet](docs/papers/11-resnet.md) | 深网的优化退化怎样由残差参数化缓解 |
| 12 | [Dilated Convolutions](docs/papers/12-dilated-convolutions.md) | 不降采样怎样扩大 dense prediction 感受野 |
| 13 | [Neural Message Passing](docs/papers/13-neural-message-passing.md) | 分子图网络如何统一为消息、更新和读出 |
| 14 | [Attention Is All You Need](docs/papers/14-attention-is-all-you-need.md) | 全注意力如何取代序列递归 |
| 15 | [Bahdanau Attention](docs/papers/15-bahdanau-attention.md) | 翻译中的固定向量瓶颈如何变成软对齐 |
| 16 | [Identity Mappings in ResNet](docs/papers/16-identity-mappings-resnet.md) | clean identity path 为什么改善超深网络 |
| 17 | [Relation Networks](docs/papers/17-relation-networks.md) | 对象关系如何成为显式可复用模块 |
| 18 | [Variational Lossy Autoencoder](docs/papers/18-variational-lossy-autoencoder.md) | 强 decoder 下潜变量该保留什么信息 |
| 19 | [Relational RNNs](docs/papers/19-relational-rnns.md) | 循环记忆槽如何在每一步互相作用 |
| 20 | [Coffee Automaton](docs/papers/20-coffee-automaton.md) | 表观复杂度实验为何失败、怎样纠错 |
| 21 | [Neural Turing Machines](docs/papers/21-neural-turing-machines.md) | 网络怎样学习可微的读、写和寻址 |
| 22 | [Deep Speech 2](docs/papers/22-deep-speech-2.md) | 端到端目标与系统工程怎样共同扩展语音识别 |
| 23 | [Scaling Laws](docs/papers/23-scaling-laws.md) | loss 怎样随模型、数据和算力呈幂律变化 |
| 24 | [Minimum Description Length](docs/papers/24-mdl-tutorial.md) | 模型拟合与复杂度怎样统一成码长 |
| 25 | [Machine Super Intelligence](docs/papers/25-machine-super-intelligence.md) | 通用智能如何被形式化及为何不可直接计算 |
| 26 | [Kolmogorov Complexity](docs/papers/26-kolmogorov-complexity.md) | 规律、模型和不可压缩噪声如何严格区分 |
| 27 | [CS231n（2016）](docs/papers/27-cs231n.md) | 从梯度检查到 CNN 训练的实践底座 |
| 28 | [MANN（候选）](docs/papers/28-memory-augmented-meta-learning.md) | 快知识如何通过外部记忆现场写入 |
| 29 | [Prototypical Networks（候选）](docs/papers/29-prototypical-networks.md) | 新类别如何由少量样本即时形成原型 |
| 30 | [MAML（候选）](docs/papers/30-maml.md) | 如何学习一个少数梯度步即可适应的起点 |

## 代码

[`src/ilya30/`](src/ilya30/) 提供教育用途的独立最小实现，重点展示不可被现成框架 API 掩盖的机制；完整生产模型则链接作者代码或成熟框架。实现按主题分为 attention、sequence、vision、sets、graphs、memory、CTC、variational、complexity/MDL、systems/scaling、meta-learning 和 universal-intelligence toy model。所有本地实现通过 `pytest` 验证形状、不变量、数值等价关系和动态规划结果。

```bash
python3 -m pip install -e .
pytest -q
python3 examples/core_mechanisms.py
```

目前测试集包含 58 个测试。综合示例会同时演示因果注意力、CTC 路径求和、ProtoNet 临时分类器和 MAML 元梯度；论文 PDF 下载、SHA-256 清单和 MinerU 解析说明见 [`sources/README.md`](sources/README.md)，大体积 PDF、VLM Markdown 和图片不进入版本控制。

## 内容边界

这些导读解释论文的主张和证据，不把后来的成功倒推成原论文已经证明的结论。历史实验数字按原文口径保留；复现代码是教学实现，不声称复现原论文的完整规模、数据集或榜单成绩。
