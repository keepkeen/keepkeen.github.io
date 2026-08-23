# 24. Minimum Description Length：把学习定义为寻找最短的“模型 + 数据”编码

> **材料：** Peter Grünwald，2004 教程章节　**出处状态：** 27 项保留清单　**原文：** [arXiv:math/0406077](https://arxiv.org/abs/math/0406077)

## 一句话定位

MDL 选择能让数据获得最短无歧义描述的模型。简单模型编码短但残差长，复杂模型残差短但自身或其模型类代价大；最短总码长在欠拟合和过拟合之间自动权衡。refined MDL 用 universal code/NML 取代随意的参数小数位编码，使原则成为可比较的统计方法。

## 为什么会被推荐

**已知**：教程在保留清单，没有逐篇推荐语。**合理推断**：MDL 是清单的理论胶水：第 6 篇用权重描述长度正则化，第 18 篇用 bits-back 理解 VAE，第 20/26 篇分离规律与噪声，Scaling Laws 也可看成寻找资源约束下的简洁经验模型。它给“压缩即理解”一个比口号严格得多的版本。

## 概率、码长与学习

对 prefix code，Kraft inequality 连接可解码码长和概率；理想 Shannon code 有 `L(x)=-log₂P(x)`。若假设/模型为 `H`、数据为 `D`，crude two-part MDL 选：

`argmin_H [L(H)+L(D|H)]`。

最大似然只最小化第二项，所以模型越灵活越可能过拟合；第一项为灵活性收费。它与 Occam 相似，却不说“世界的真模型一定最简单”，只说能抓住可重复规律的模型可用较短 code 预测未见数据。

crude MDL 的问题是连续参数精度和编码语言任意：写均值到几位小数会改变 `L(H)`。BIC 可由大样本近似得到，但教程的重点是 refined MDL，而非把 MDL 等同 BIC。

## NML 与 minimax regret

给定 model class `M={P_θ}`，每个可能数据串 `x` 的 best-fit likelihood 是 `P_{θ̂(x)}(x)`。Normalized Maximum Likelihood 定义：

`P_NML(x)=P_{θ̂(x)}(x)/C_n`，

`C_n=Σ_y P_{θ̂(y)}(y)`（连续样本改为积分）。

其码长 `-log P_NML(x)=-log P_{θ̂(x)}(x)+log C_n`。第一项是数据在最佳参数下的 fit，`log C_n` 是 model class 的 parametric complexity：如果一个类能对许多不同数据都拟合很好，归一化罚项就大。NML 在逐数据序列的最坏情形 regret 上 minimax optimal，而不是先假设某个 prior 平均最优。

比较模型类时选择最短 universal codelength。NML normalizer 可能发散或不可算，教程还讨论 restricted/conditional NML、Bayesian mixtures、two-part、prequential（按过去预测下一个）编码等替代。不同 universal code 在适当正则条件下常有相近渐近行为，但有限样本不能随意混用。

## 怎么理解和实现

最直观例子是抛硬币。固定公平模型无需传参数，但偏置数据残差长；Bernoulli class 能拟合任意频率，却为整个灵活类支付 `log C_n`。随着样本增多，真实可重复偏置带来的 likelihood 节省超过复杂度，MDL 才切换到复杂类。

[`src/ilya30/complexity.py`](../../src/ilya30/complexity.py) 实现小样本 Bernoulli NML normalizer、NML codelength、two-part code 与压缩代理。测试穷举所有二进制串验证 `P_NML` 总和为 1，并比较公平/未知偏置模型。它不会把 zlib 长度冒充严格 MDL；神经网络参数若用普通 float 文件大小，编码选择会淹没理论问题。

## 相关方法如何解决模型选择

Solomonoff induction 用 `2^{-K(program)}` 混合所有可计算假设，理想而不可计算；Bayesian evidence 积分 likelihood×prior，prior 体现信念且在正则模型下与某些 universal codes 密切相关；AIC 以预测 KL risk 为目标，BIC 近似 marginal likelihood；cross-validation 直接估计留出预测；SRM/VC、PAC-Bayes 分别给容量或 posterior-dependent 泛化界。

现代深度学习的 prequential MDL 用“先传一部分标签，训练后压缩下一部分”评估表示；压缩器、量化、lottery tickets 和 information bottleneck 也借用类似语言。但 parameter count、weight entropy、文件压缩和泛化不是自动等价，必须写清 code 与 decoder。

## 优点、局限与跨领域

优点是统一拟合和复杂度、无需假定候选类含真实分布、与预测/压缩可操作地连接，并能比较非嵌套模型。局限是 code/model class 选择仍带建模判断；Kolmogorov ideal 不可算；NML 常计算昂贵或发散；非正则、奇异深网不满足简单渐近式；最短平均码不保证公平、稳健或因果正确。

MDL 可用于回归阶数、图结构、规则发现、序列分段、因果候选、科学方程和数据压缩。跨领域时必须公开：传输双方共享什么、哪些参数要编码、精度多少、数据顺序如何、选择模型的计算是否计入。

## 阅读检查

- 为什么最大似然只对应 `L(D|H)`，MDL 多出的代价是什么？
- NML 的 `log C_n` 为什么度量整个模型类而不是某个参数向量？
- MDL、Bayesian evidence、BIC 在何时相近，为什么不能直接画等号？
- 对一个神经网络，怎样定义可复现且不任意的 code 是最难的一步？
