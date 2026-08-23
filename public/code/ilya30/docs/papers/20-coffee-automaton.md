# 20. Coffee Automaton：复杂度为何先升后降，以及一个必须保留的反例教训

> **论文：** Aaronson, Carroll & Ouellette，2014　**出处状态：** 27 项保留清单　**原文：** [arXiv:1405.6903](https://arxiv.org/abs/1405.6903)　**作者勘误：** [Aaronson 的原帖更新](https://scottaaronson.blog/?p=1818)

## 一句话定位

热力学熵从低到高，但“有趣结构”在完全分层和完全混合时都低，似乎在中间最高。论文用粗粒化图像的压缩长度近似 apparent complexity，并以奶油扩散自动机实验这一“先升后降”。然而作者很快确认：原 interacting rule 也不会产生所声称的大中间复杂度，数值 bump 主要来自边界量化伪影。正确价值在问题、度量框架、负面定理和公开纠错，而不在那条已撤回的正面曲线。

## 为什么会被推荐

**已知**：论文在保留清单；没有逐篇理由。**合理推断**：它把算法信息论从静态字符串带到动力系统，迫使读者区分 entropy、randomness、structure 和可观测尺度。更重要的是，它是一堂少见的研究方法课：直觉合理、图形漂亮仍可能错，压缩器只给上界，有限尺寸模拟不能替代理论下界。

## 复杂度不等于熵

随机位串的 Shannon/Kolmogorov entropy 很高，却没有我们通常说的组织结构。论文讨论四种“有趣性”候选：

- **apparent complexity**：先用物理上合理的平滑/去噪 `f` 去掉微观随机性，再量 `K(f(x))`；
- **sophistication**：把近最短两段描述分为模型 `S` 的复杂度与在模型内指定 `x` 的随机部分；
- **logical depth**：近最短程序产生 `x` 所需的计算时间，区分快速生成的随机串与漫长演化形成的结构；
- **light-cone complexity**：过去与未来光锥的互信息，度量局部状态保存了多少有预测价值的因果信息。

后三者理论漂亮但难计算，实验选择 apparent complexity：对自动机位图做局部平均和阈值，再以 gzip 长度近似 `K(f(x))`。这里有两层近似：压缩长度只是相对某压缩器的可计算上界；`f` 还把观察尺度和研究者偏好写进了指标。

## 自动机、原始结论与勘误

初态上半奶油、下半咖啡。non-interacting 模型让每个奶油粒子独立随机游走且可重叠；interacting 模型每步交换一对相邻异色格，本质接近 symmetric exclusion process。原文证明独立模型粗粒化状态可由时间和一维期望剖面简短描述，apparent complexity 始终低；调整阈值后模拟也压平其 bump。

原文同时报告 interacting 模型仍有随杯宽近似线性增长的复杂度峰，并把它当作相互作用产生结构的证据。**这部分不能继续当成有效结论。** Brent Werness 指出，Liggett 关于 symmetric exclusion process 的结果意味着该规则也不会产生大的中间 apparent complexity；作者确认改进边界像素处理会消除 bump，并公开承担错误。随机扩散加排斥并没有长程相关性足以形成奶油触须；需要剪切/搅拌等机制才可能做到。

## 怎么实现、怎样避免重犯

[`src/ilya30/complexity.py`](../../src/ilya30/complexity.py) 实现自动机、block coarse-graining、Shannon entropy 和 zlib 压缩代理。示例明确把曲线标为“特定编码器与粒度的诊断”，不写成 Kolmogorov complexity。测试检查粒子数守恒、确定性种子、常量图低压缩长度，并刻意**不**以“必须出现中间峰”为通过条件。

可信实验应同时做：减去文件头/尺寸基线；改变序列化顺序和压缩器；扫 grain/threshold；随系统尺寸做有限尺度分析；报告随机种子区间；为“复杂度大”寻找下界而不只找更短压缩失败。任何 compressor 都能证明“至多需要这些 bit”，不能证明不存在未知的更短程序。

## 相关工作

第 2 篇 [First Law of Complexodynamics](02-first-law-complexodynamics.md) 提出问题；Bennett 的 logical depth、Crutchfield/Shalizi 的 computational mechanics、effective complexity 与算法统计学分别尝试分离规律和噪声。第 24、26 篇给出 MDL、sufficient statistic 和 randomness deficiency 的更严格语言。Liggett 的 [symmetric exclusion distributional limits](https://arxiv.org/abs/0710.3606) 与 Borcea–Brändén–Liggett 的 negative dependence 结果说明，概率结构定理能推翻看似自然的有限模拟解释。

这些路线没有唯一的“宇宙复杂度计”。不同度量回答不同问题：描述一个快照、重建其生成历史、预测未来或提取统计模型。选择前必须先写明任务和观测尺度。

## 优缺点与跨领域

优点是问题深刻、候选概念整理清楚、代码实验可复核，并展示 coarse-graining 与物理因果结构的关系。局限是度量依赖平滑与压缩器，Kolmogorov 量不可计算，原正面实验证据失效；“宇宙先复杂后简单”也不能由一个二维扩散规则验证。

同样方法可探索湍流、生态演化、城市形态、训练中表示和生成模型样本，但应把它定位为多尺度统计诊断。机器学习中尤其要警惕：PNG/gzip 大小混合了随机性、格式与结构，不能直接等同“模型理解”或“语义复杂度”。

## 阅读检查

- 为什么随机噪声 Kolmogorov complexity 高，却 apparent complexity 可低？
- 压缩文件长度对真实 `K(x)` 提供上界还是下界？
- 原 interacting 模型的哪项结论被作者撤回，哪些思想仍有效？
- 你会如何设计一个不依赖单一阈值和压缩器的有限尺度实验？
