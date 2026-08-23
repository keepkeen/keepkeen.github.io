# 26. Kolmogorov Complexity and Algorithmic Randomness：把规律定义为可压缩的程序结构

> **材料：** Shen, Uspensky & Vereshchagin，AMS 2017 专著　**出处状态：** 27 项保留清单　**出版社：** [AMS Surveys 220](https://www.ams.org/books/surv/220/)　**开放扫描：** [作者公开 PDF](https://www.lirmm.fr/~ashen/kolmbook-eng-scan.pdf)　**范围说明：** 公开清单指向第 434 页起；本章补充读懂该页段所需前置概念。

## 一句话定位

一个有限对象的 Kolmogorov complexity 是输出它的最短程序长度；算法统计学再问，这些 bit 中多少是可复用的“模型结构”，多少只是模型内的随机索引。第 434 页附近的 two-part descriptions 正好把这一问题写成 `model complexity + log model size`，是 MDL、泛化和“规律与噪声”最严格的概念底座之一。

## 为什么会被推荐

**已知**：保留清单明确写的是这本书第 434 页以后，而非整本书；没有 Ilya 的逐篇理由。**合理推断**：指定后段说明重点很可能不只是背 `K(x)` 定义，而是算法统计学、最小充分统计量和随机性的多种面貌。它解释何为“从数据抽出所有可压缩规律”，并为 Hinton–van Camp、MDL、VAE bits-back、Coffee Automaton 和 universal intelligence 提供共同语言。

## 必要前置：C、K 与 universal probability

固定 optimal description machine `U`，plain complexity：

`C_U(x)=min{|p|:U(p)=x}`。

Invariance theorem 说不同最优机只相差依赖机器的 `O(1)`，所以渐近结论稳定；对短字符串，这个常数可能很大。prefix complexity `K(x)` 要求程序集合 prefix-free，于是满足 Kraft inequality，能对应概率。Coding theorem 将 universal a priori semimeasure 与复杂度相连：`-log m(x)=K(x)+O(1)`。

conditional complexity `C(x|y)` 是给定 `y` 后最短描述；algorithmic mutual information 近似 `C(x)+C(y)-C(x,y)`，在对数误差下对称。`C/K` 不可计算：若能精确找到最短程序就可构造 Berry/halting 矛盾；可以不断找到更短上界，却一般无法证明当前程序最短。

Martin-Löf randomness 把“通过所有有效统计检验”形式化；无限二进制序列随机，当且仅当前缀复杂度始终不比长度低太多（Levin–Schnorr 形式）。高 complexity 表示不可压缩，不等于有组织的复杂结构。

## 第 434 页附近：模型、典型性和两段码

把有限集合 `A∋x` 当作统计模型。若只知道 `x∈A`，用约 `log|A|` bit 指定其索引；两段描述总长：

`C(A)+log|A|`。

第一段是规律/模型，第二段是模型内剩余噪声。randomness deficiency：

`d(x|A)=log|A|-C(x|A)`。

若 deficiency 小，`x` 在 `A` 中是典型而非可被额外规则挑出的特殊成员。一个 algorithmic sufficient statistic 既简单，又让 two-part length 接近 `C(x)`；此时它保存了数据中可压缩的结构，索引近似不可压缩噪声。

structure function `h_x(α)=min_{A∋x,C(A)≤α}log|A|` 描画模型预算增加时剩余不确定性如何下降。其拐点/最小充分模型与 sophistication、MDL profile 相连。不是每个字符串都有“简单而充分”的漂亮模型；有些 non-stochastic strings 在复杂度受限模型中始终 atypical。

后续附录把算法随机性的四张脸放在一起：频率稳定/选择规则、不可压缩或 chaoticness、属于所有有效概率一事件的 typicalness、以及不可被有效 betting/prediction 系统获利。等价关系取决于无限/有限对象、可计算性与检验定义，不能混成一句“随机就是压不缩”。

## 如何实现而不造假

真正的 `C(x)`、最优模型 `A` 和 structure function 不可通用计算。[`src/ilya30/complexity.py`](../../src/ilya30/complexity.py) 因而只提供明确标注的上界代理：zlib codelength、经验 entropy、显式有限 model 的 two-part length/randomness deficiency。测试从不声称找到了最短程序；它用小集合穷举验证 algebra，并显示更强 compressor 只能降低已知上界。

## 相关理论和实用替代

Shannon information 针对已知/假设分布的平均码长，Kolmogorov 针对单个对象；Solomonoff 用程序先验做预测；[MDL](24-mdl-tutorial.md) 用可计算 universal codes 做统计模型选择；Bayesian sufficient statistics 在给定参数族内定义充分性，algorithmic statistic 则允许任意可描述模型。

Normalized Compression Distance 用 compressor 近似 information distance，可做无特征聚类，但结果依赖文件格式与 compressor；Lempel–Ziv entropy rate、prequential coding 和 learned compression 是其他可计算投影。它们是受限语言下的工具，不是 exact Kolmogorov oracle。

## 优点、局限与跨领域

优点是对象级、模型无关、统一压缩/随机/归纳，并能精确定义“有多少结构”。局限是关键量不可计算、短串机器常数不可忽略、模型仍依赖编码语言；算法典型性不是因果性、语义价值或现实安全。扫描本篇数学密集，读者应先掌握可计算性、概率与 prefix code。

算法统计学可启发科学定律发现、异常检测、序列建模、因果候选和表征学习：寻找短模型并让样本在模型内典型。实践中必须限定 model/program class，使用 validation 或 prequential code，并把计算预算写入问题，否则“最短解释”无法求得。

## 阅读检查

- 为什么 invariance theorem 不能让短字符串的 `K(x)` 成为机器无关精确数字？
- `C(A)+log|A|` 两部分各表示什么，randomness deficiency 又检查什么？
- incompressible 与 organized complexity 为什么不是同义词？
- 一个实际 compressor 的结果对 `C(x)` 是什么性质的界？
