# 18. Variational Lossy Autoencoder：用解码器的盲区决定潜变量记住什么

> **论文：** Chen et al.，ICLR 2017（2016 预印本）　**出处状态：** 27 项保留清单　**原文：** [arXiv:1611.02731](https://arxiv.org/abs/1611.02731)

## 一句话定位

强自回归 decoder 往往能绕过 VAE latent，造成 posterior collapse。VLAE 不只把这看成优化故障，而利用“信息偏好”：让局部 PixelCNN 负责可由邻域预测的纹理，迫使有限感受野之外的全局形状通过 `z` 传递；改变 decoder 可见的信息，就能控制 lossy representation 保存什么。

## 为什么会被推荐

**已知**：它在保留清单，没有公开逐篇理由。**合理推断**：它把 MDL、bits-back、生成建模和表示学习连在一起，纠正了“VAE 天然会把输入压进 latent”的常见误解。它还展示了一个耐久原则：潜变量语义不是由 latent 维数自动产生，而由模型各通道之间的竞争和信息瓶颈共同决定。

## VAE 为什么可能根本不 autoencode

VAE 优化 ELBO：

`E_{q(z|x)}[log p(x|z)] - KL(q(z|x)||p(z))`。

第一项奖励重构/似然，第二项是发送 latent 所需的额外码长。若 decoder 足够强，能在不看 `z` 时就拟合 `p_data(x)`，设 `q(z|x)=p(z)` 可令 KL 为零而不损失似然；此时 `z` 与 `x` 无关。作者用 bits-back coding 解释：模型只会把一条依赖放进 latent，当经 `z` 编码它比 decoder 自己建模更省码。

所以 posterior collapse 有两类来源：优化初期 decoder 太快导致 latent 被弃用；以及模型在渐近最优处就没有理由使用 latent。KL annealing/free bits 能帮助前者，却不必改变后者的信息分工。

## VLAE 的两个贡献

第一，**显式信息放置**。使用只有小局部感受野的 autoregressive `p(x|z)`。局部纹理、颜色延续可由先前邻域预测；跨图像的形状和布局无法沿局部条件直接传递，只能进入 `z`。增大 PixelCNN 感受野会让更多信息转交 decoder，latent 变得更“有损”。若 decoder 只看灰度邻域，颜色也必须由 `z` 保存，说明表示内容可由条件结构主动设计。

第二，**autoregressive-flow prior**。简单高斯 prior 未必匹配聚合后验。作者把简单噪声经 autoregressive flow 变成有相关性的 `p(z)`；它与在近似后验使用相应 IAF 有数学联系，但把表达力放在生成模型一侧，能改善 bits-back 效率与采样分布。

[`src/ilya30/variational.py`](../../src/ilya30/variational.py) 实现高斯重参数化、对标准正态 KL、ELBO 分解与 free-bits。测试用解析 KL 和 Monte Carlo 对照，并构造不依赖 `z` 的 decoder 展示 KL 最优可归零。完整 PixelCNN/flow 训练规模较大，机制代码之外应参考 [PixelCNN++](https://github.com/openai/pixel-cnn) 等正式实现。

## 相关工作如何处理同一问题

[VAE](https://arxiv.org/abs/1312.6114) 与 stochastic backprop 建立可扩展变分训练；[DRAW](https://arxiv.org/abs/1502.04623) 用多层潜变量反复读写图像；文本 VAE 的 [KL annealing](https://arxiv.org/abs/1511.06349) 和 [free bits/IAF](https://arxiv.org/abs/1606.04934) 防止早期 collapse。[PixelCNN](https://arxiv.org/abs/1601.06759) 提供强离散自回归似然，但逐像素生成慢。

后来的 β-VAE 增强瓶颈以追求解耦，InfoVAE/WAE 修改聚合后验约束，VQ-VAE 用离散 code 与 autoregressive prior 分工，NVAE/层级 VAE 用多尺度 latent。现代 latent diffusion 同样让 autoencoder 决定哪些像素细节被压缩、生成模型在 latent 空间补什么；目标与 VLAE 不同，但“通道分工决定表示”是一致的。

## 证据、优缺点

静态二值 MNIST 上，VLAE 平均只用 13.3 nats（19.2 bits）latent，而同结构 factorized decoder VAE 用 37.3 bits，支持更有损的分工。CIFAR-10 DenseNet VLAE 报告 2.95 bits/dim，优于当时其他变分 latent 模型，略逊于 PixelCNN++ 2.92。似然好与表示对下游有用不是同一指标，论文的图像样例主要是机制证据。

优点是从信息论解释 collapse、可通过 decoder receptive field 控制表示、兼顾似然与全局 latent。局限是生成仍受 autoregressive 串行瓶颈；“局部=纹理、全局=语义”只是图像上的经验偏置；ELBO 与 approximate posterior gap 仍在；latent 可能保留意外捷径，不能保证解耦、公平或任务充分。

## 跨领域应用

音频可让局部 waveform decoder 建模音色而 latent 保存语句/说话人；视频可分离局部动态和全局场景；科学数据可让已知局部物理算子承担短程规律、latent 表示边界条件或全局相。设计时要画出 decoder 的条件依赖图：它看得到什么，才决定 `z` 被迫传什么。

## 阅读检查

- posterior collapse 何时是优化失败，何时是模型的合理最优？
- decoder 感受野变大时，为什么 latent 通常携带更少信息？
- free bits 改变训练目标的哪一部分，它保证语义表示吗？
- bits/dim、latent KL 与下游表示质量为什么不能互相替代？
