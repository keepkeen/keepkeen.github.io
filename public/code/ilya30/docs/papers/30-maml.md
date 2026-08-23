# 30. MAML：学习一个“一两步就能学会”的参数起点

> **论文：** Chelsea Finn, Pieter Abbeel, Sergey Levine, 2017　**原文：** [PMLR](https://proceedings.mlr.press/v70/finn17a.html) / [arXiv:1703.03400](https://arxiv.org/abs/1703.03400)　**出处状态：** 元学习主题的编辑候选，**不是已确认的 Ilya 推荐项**

## 一句话定位

Model-Agnostic Meta-Learning（MAML）不为任务手工设计记忆或度量，而是寻找一组初始化参数 \(\theta\)：从这里出发，只用新任务的少量数据做一两步梯度下降，就能获得低的新任务损失。

## 为什么把它作为第 30 项候选

公开证据没有恢复缺失 Meta Learning 材料的标题，所以不能把 MAML 写成 Ilya 已确认推荐。编辑选择它，是因为它把元学习压缩成一个至今仍重要的双层优化公式，并跨回归、分类和强化学习使用同一机制；与前两项形成清楚对照：MANN 学读写策略，ProtoNet 学表示与固定估计规则，MAML 直接学习“可适应性”。

## 从普通预训练到“为更新后的表现训练”

普通多任务预训练最小化初始化本身的平均损失：\(\sum_i\mathcal L_{\mathcal T_i}(f_\theta)\)。它偏好一个折中解，却不保证从该点走一步后各任务都好。MAML 把内层更新写进训练目标。

对任务 \(\mathcal T_i\)，先用 support/train split 做一步：

\[
\theta'_i=\theta-\alpha\nabla_\theta
\mathcal L^{\mathrm{support}}_{\mathcal T_i}(f_\theta).
\]

再在同一任务独立的 query/validation split 上评价：

\[
\min_\theta\sum_i
\mathcal L^{\mathrm{query}}_{\mathcal T_i}(f_{\theta'_i}),
\qquad
\theta\leftarrow\theta-\beta\nabla_\theta
\sum_i\mathcal L^{\mathrm{query}}_{\mathcal T_i}(f_{\theta'_i}).
\]

这里 \(\alpha\) 是任务内学习率，\(\beta\) 是元学习率。support 与 query 分开极其重要：若在同一批数据上更新又评价，目标会奖励记忆 support，而非适应后泛化。

## 核心理论：元梯度穿过优化步骤

对一步更新，完整元梯度含有 Hessian：

\[
\frac{\partial\mathcal L_i(\theta'_i)}{\partial\theta}
=
\underbrace{\left(I-\alpha\nabla^2_\theta
\mathcal L_i^{\mathrm{support}}(\theta)\right)}
_{\text{更新映射的 Jacobian}}
\nabla_{\theta'_i}\mathcal L_i^{\mathrm{query}}(\theta'_i).
\]

所以 MAML 不是“先 fine-tune，再普通训练”这么简单。外层在寻找一种局部几何：不同任务的有用梯度从 \(\theta\) 出发，少量步数就能到达各自好解，并且 support 更新能改善 query。

**First-Order MAML（FOMAML）** 忽略 Hessian/Jacobian 项，把元梯度近似成 \(\nabla_{\theta'_i}\mathcal L_i^{query}\)，但仍然是在任务更新后的参数处求梯度。它不是把内循环删掉。原文报告约三分之一计算加速，在 miniImageNet 上结果接近完整 MAML。

## 一个一维例子

设任务 \(i\) 的损失为 \(\mathcal L_i(w)=\tfrac12(w-a_i)^2\)。一步后

\[
w'_i=(1-\alpha)w+\alpha a_i.
\]

完整元梯度为 \((w'_i-a_i)(1-\alpha)\)，FOMAML 则近似为 \(w'_i-a_i\)。当 \(\alpha=1\) 时，一步恰好到达任意 \(a_i\)，真实元梯度为零；FOMAML 恰好也因残差为零而为零。更一般的非线性网络中，曲率项会旋转和缩放元梯度，也带来昂贵且可能不稳定的高阶求导。

这个例子也揭示一个边界：若所有任务只差 optimum 位置，好的初始化接近任务中心；若任务需要互相冲突的表示或不同架构，单个初始化未必存在。

## 怎么实现

一个监督学习 meta-batch 的标准流程是：

1. 从任务分布采一批 tasks，每个任务划分 support/query。
2. 对每个任务复制逻辑参数 \(\theta_i'\)，在 support loss 上做一到数步可微更新；不要原地破坏共享 \(\theta\)。
3. 用 \(\theta_i'\) 算 query loss，并在任务间求和/平均。
4. 完整 MAML 设置 `create_graph=True` 或用函数式参数保留高阶图；FOMAML 则 detach 内层 Jacobian，但保留更新后梯度。
5. 外层 optimizer 更新共享初始化。测试时只执行内层适应，不再做 meta-update。

工程上最常出错的是：BatchNorm 的 running statistics 在任务间泄漏；support/query 误用同一数据；对模型参数做不可微的 in-place optimizer step；多步内循环内存爆炸；测试时使用了与训练不同的步数或学习率。后续库通常以 functional model、vectorized task batch、checkpointing 或 implicit differentiation 缓解。

本项目在 [`meta.py`](../../src/ilya30/meta.py) 实现可手算的一维 quadratic MAML 与 FOMAML，用有限差分核验完整元梯度；真正的大网络建议直接使用 PyTorch/JAX 自动微分，而不是自己拼 Hessian。

## 实验到底支持了什么

论文先用 sinusoid regression 展示：只看少量点，一两步更新就能推断新曲线；然后覆盖 Omniglot、miniImageNet 分类，以及二维导航和 MuJoCo locomotion 的 policy-gradient RL。

Omniglot 上 MAML 报告 5-way 1-shot/5-shot 为 98.7%/99.9%，20-way 为 95.8%/98.9%。miniImageNet 5-way 上，MAML 为 \(48.70\pm1.84\)% / \(63.11\pm0.92\)%；一阶近似为 \(48.07\pm1.75\)% / \(63.15\pm0.91\)%（1-shot/5-shot）。这些结果支持“同一个双层目标能跨模型和任务工作”，也显示当时二阶项在该基准上的边际提升有限。

不能据此推出“任何任务一梯度步都能学会”。任务都来自人为规定的分布；分类使用小型卷积网络和早期 split；RL 的梯度本身高方差。今天比较还必须对齐 backbone、预训练、数据增强、episode 协议和 transductive information。

## 当时与后来的其他路线

- **早期 learning-to-learn / learned optimizers** 用 RNN 直接输出更新规则，可能比梯度更灵活，却增加优化器自身的参数和分布外风险。
- **[Meta-SGD](https://arxiv.org/abs/1707.09835)** 除初始化外还学习逐参数更新方向/步长，相当于扩展 \(\alpha\)。
- **[Reptile](https://arxiv.org/abs/1803.02999)** 反复把初始化移向任务适应后的参数，避免显式二阶导；它与 FOMAML 相关但更新量并不相同。
- **[ANIL](https://arxiv.org/abs/1909.09157)** 主要只在最后一层做 inner-loop adaptation，实验提示某些 few-shot benchmark 中 representation reuse 已承担大部分效果；这质疑了“全网络都在快速学习”的强叙事。
- **[iMAML](https://arxiv.org/abs/1909.04630)** 用 implicit differentiation 避免保存整个内循环轨迹，适合更多内层步数；代价是内层最优性和线性系统近似等新条件。
- **[ProtoNet](29-prototypical-networks.md)、[Matching Networks](https://proceedings.neurips.cc/paper/2016/file/90e1357833654983612fb05e3ec9148c-Paper.pdf) 和 in-context learning** 不在测试时改权重，而用 support-conditioned state/attention 适应；部署延迟低，但归纳偏置不同。

## 优点、缺点与失败条件

优点：只要求模型可用梯度训练，因此可以用于分类器、回归器和策略；不限定架构；优化目标直接对齐“更新后的 query 表现”；概念上可组合多步更新、learned learning rate 与各种 loss。

缺点：双层优化昂贵，完整版本需要高阶导和大量激活内存；对内层学习率、步数、参数化和 normalization 敏感；任务分布不一致会产生 negative adaptation；一个共同初始化可能无法覆盖多模态任务族；在小 benchmark 上可能主要学到可复用 features，而非普遍的快速学习算法。RL 中还叠加 on-policy sampling 与高方差梯度。

它最危险的误用是把普通 domain shift 当作任务分布内适应：若 support 标签含噪、样本太少或目标与 meta-training 冲突，梯度步可能让模型更差。部署前应同时报告 zero-step、每一步后的 query curve、不同 task families 和 no-adaptation/pretraining baselines。

## 跨领域应用

只要能构造任务分布、support/query 并可微优化，MAML 可用于个性化、机器人快速动力学适应、低资源语音/文本、药物/蛋白性质预测、校准和超参数化控制。实际迁移前要定义“一个 task 是什么”；例如按用户、设备、语言还是时间窗口分任务会产生完全不同的初始化。若适应必须毫秒完成或不能保存梯度，ProtoNet/MANN 式前向适应更合适；若任务变化涉及决策边界乃至整套表示，参数适应更有表达力。

## 阅读检查

- MAML 与普通预训练后 fine-tuning 的训练目标究竟差在哪一层？
- 为什么完整元梯度有 Hessian，FOMAML 又具体丢掉了什么？
- support/query 不分开会奖励哪种错误行为？
- 当 ANIL 与 MAML 接近时，它对“快速学习发生在哪里”提出什么解释？
- 哪些场景应选择 memory/prototype 的前向适应，哪些场景值得支付 inner-loop 成本？
