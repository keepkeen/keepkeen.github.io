# 19. Relational Recurrent Neural Networks：让固定容量记忆在每一步内部自注意

> **论文：** Santoro et al.，NeurIPS 2018　**出处状态：** 27 项保留清单　**原文：** [arXiv:1806.01822](https://arxiv.org/abs/1806.01822)　**参考实现：** [DeepMind Sonnet](https://github.com/google-deepmind/sonnet)

## 一句话定位

Relational Memory Core（RMC）把 RNN 的单一 hidden vector 改成固定数量的 memory slots；每个时间步先用多头 self-attention 让 slots 彼此交换信息、吸收新输入，再以 LSTM 式门控写回。它在不让历史缓存随时间增长的前提下，为跨时间关系推理加入显式归纳偏置。

## 为什么会被推荐

**已知**：它在保留清单，没有逐篇推荐语。**合理推断**：这篇位于 LSTM、NTM/DNC 和 Transformer 的交点，集中讨论“存进去”和“在记忆之间计算”是两件事。它展示了 attention 不只可替代序列循环，也可作为一个循环状态内部的关系算子。

## 核心机制

记忆 `M∈R^{N×F}` 的每一行是一格。先做多头注意力：

`A(M)=softmax((MW^q)(MW^k)ᵀ/√d_k)MW^v`。

为注入当前输入 `x_t`，queries 仍来自 `M`，keys/values 来自行拼接 `[M;x_t]`：

`M̃=softmax(MW^q([M;x_t]W^k)ᵀ/√d_k)[M;x_t]W^v`。

输出仍有 `N` 行，所以状态容量固定。之后每行共享一个 MLP/LayerNorm，并用类似 LSTM 的 forget/input gates 更新：旧 slot 乘遗忘门，加上候选 `g_ψ(M̃_i)` 乘输入门。参数在 slot 之间共享，因此可调整 slot 数而不直接改变大部分参数量。

最重要的差别是：普通 attention over history 保存 `h_1…h_t`，内存/计算随 `t` 增长；RMC 每步只在固定 `N` 个压缩状态之间做 `O(N²)` 交互，总成本随时间线性、每步有界。代价是旧信息必须不断被有损重写。

## 怎么理解和实现

普通 LSTM 像一张不断擦写的纸；外部 memory 像多个抽屉但抽屉之间未必交流；RMC 像固定人数的会议，每来一条新观察，所有席位互相注意并决定保留什么。多头允许同一 slot 用不同通道交换不同关系，但论文也谨慎指出 attention 图不能可靠证明 slot 已形成可读的符号分工。

[`src/ilya30/memory.py`](../../src/ilya30/memory.py) 提供 RMC attention proposal 和简化 gated update，与第 21 篇 NTM 的寻址函数放在一起比较。测试验证 slot 数保持不变、attention 行归一、输入可写入、置换 slots 时结果等变。它不声称复刻论文语言模型的全部优化细节。

## 相关路线

[LSTM](04-understanding-lstm.md) 用逐维门控把所有信息压在向量中；[NTM](21-neural-turing-machines.md) 和 [DNC](https://www.nature.com/articles/nature20101) 以外部矩阵、读写头和地址机制增强容量；[EntNet](https://arxiv.org/abs/1612.03969) 让多个实体槽独立更新。[Transformer](14-attention-is-all-you-need.md) 对整个已生成上下文做 self-attention，保真但缓存增长。RMC 选择“固定容量 + slot 间全连接”这一折中。

后来 Transformer-XL、Compressive Transformer 和 recurrent memory transformer 在 chunk 间携带/压缩记忆；现代状态空间模型则用递归状态获得固定每步成本。它们共同面对同一不可能三角：完整历史保真、固定内存、任意内容检索通常不能同时免费得到。

## 论文证据、优缺点

在 N-th Farthest 关系任务上，LSTM/DNC 未超过 30% best-batch accuracy，RMC 稳定到约 91%（高维设置的种子稳定性较差）。程序执行完整任务字符准确率为 79.0%，优于比较的 LSTM 66.1、DNC 69.5。WikiText-103 test perplexity 31.6，对照论文所用 LSTM 34.3；Gutenberg 42.0、GigaWord 38.3。跨任务结果支持功能提升，但消融不足以把收益唯一归因于“关系推理”。

优点是容量有界、slot 结构、跨 slot 直接路径、能在线运行。局限是每步 `O(N²)`；固定记忆必然遗忘；slot/头数、门控和尺度超参数多；论文最佳语言模型甚至使用单 slot，说明“多个显式实体槽”并非所有收益来源；与同算力、同参数的现代基线比较已过时。

## 跨领域应用

部分可观测强化学习、多物体跟踪、事件流、在线控制、持续语音和流式传感都需要有界状态。迁移时应先估计需同时保持的实体数与每实体带宽，再决定 slot 数/宽度；若任务要求逐字追溯原文，固定压缩状态可能不适合，应保留可检索历史。

## 阅读检查

- RMC 的 attention 与 Transformer 对历史 token 的 attention 在状态增长上有什么不同？
- 为什么 `[M;x]` 只用于 key/value 而 query 仍用 `M` 能保持 slot 数？
- 多 slot 比单 slot 更“关系化”是论文定理还是经验假设？
- 固定内存在线模型必然付出的信息代价是什么？
