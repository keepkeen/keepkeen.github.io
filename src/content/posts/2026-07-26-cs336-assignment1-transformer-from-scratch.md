---
title: "CS336 Assignment 1：从 BPE 到 Transformer 语言模型"
description: "从零实现 byte-level BPE、RoPE Transformer、AdamW、训练与生成管线，并记录 TinyStories 在 A100 上的真实数据准备和 smoke run。"
date: 2026-07-26
updatedDate: 2026-08-14
tags:
  - cs336
  - llm
  - pytorch
  - engineering
lang: zh-CN
featured: true
draft: false
series: stanford-cs336
seriesOrder: 1
---

> 本文对应 **Stanford CS336 Assignment 1: Basics**。我不是 Stanford 在校生，也没有把它作为正式课程提交；这是一份独立实现、公开验证的学习记录。代码与文档固定在清理后的公开提交 [`779af60`][repo]。文中只报告有当时命令输出记录支撑的结果，未完成的长训练和 ablation 会单独列出。

## 快速入口

- [完整实现与测试][repo]
- [官方作业仓库 / PDF][handout]
- [完整实现讲解][explanation]
- [实验状态与恢复清单][summary]
- [Tokenizer / BPE 源码][tokenizer]
- [Transformer 源码][nn]
- [训练入口][train]
- [生成入口][generation]

## 结果先行

Assignment 1 的目标不是调用现成 `TransformerEncoder`，而是把一条最小语言模型链路逐层实现出来：

```text
raw text
  -> streaming byte-level BPE training
  -> vocab.json + merges.txt
  -> streaming tokenization
  -> memory-mapped uint16 token array
  -> RoPE pre-norm Transformer LM
  -> AdamW + cosine schedule + clipping
  -> checkpoint / evaluation / JSONL log
  -> temperature + top-p generation
```

把这条链路展开后，可以看到每一层都在改变数据的表示：

| 阶段 | 输入 | 输出 | 主要约束 |
|---|---|---|---|
| BPE 训练 | UTF-8 文本文件 | `vocab` 与有序 `merges` | 合并不能跨 pre-token / special token 边界 |
| 文本编码 | 字符串流 | token ID 流 | 分块结果必须等于整段编码结果 |
| 数据落盘 | token ID 流 | 一维 `.npy` 数组 | 不能把全部 Python 整数同时放进内存 |
| batch 采样 | 长度为 $N$ 的 token 数组 | `x, y: (B, T)` | `y` 是 `x` 向右移动一个 token |
| Transformer | `(B, T)` | logits `(B, T, V)` | 每个位置只能看到自己与过去 |
| 损失函数 | logits 与 targets | 标量 loss | 对 $B\times T$ 个 next-token 任务取平均 |
| 自回归生成 | prompt token | 逐个追加的新 token | 每一步只使用最后一个位置的 logits |

后文统一使用这些符号：batch size 为 $B$，序列长度为 $T$，词表大小为 $V$，模型宽度为 $D$，head 数为 $H$，单个 head 宽度为 $D_h=D/H$，前馈层宽度为 $D_{ff}$。

已完成并有证据的结果如下：

| 项目 | 结果 |
|---|---:|
| 公开清理仓库完整测试 | 51 passed, 2 skipped |
| 本地 lint | Ruff 全部通过 |
| A100 开发快照测试 | 47 passed, 1 xfailed |
| TinyStories tokenizer | vocab 10,000；merges 9,743 |
| BPE 训练时间 | 1,336.37 秒 |
| BPE peak RSS | 150.72 MB |
| TinyStories train tokens | 541,229,347，`uint16` |
| TinyStories valid tokens | 5,465,883，`uint16` |
| A100 smoke run | 10 iterations，bf16，CUDA |
| smoke loss | 9.25 -> 9.125 |

最后一行只能说明训练链路能在 GPU 上完成 forward、backward、evaluation 和 checkpoint，**不能**说明模型已经收敛。完整 OpenWebText tokenizer、长训练、学习率 sweep 和结构 ablation 尚未完成。

## 1. 为什么从 tokenizer 开始

语言模型看到的不是字符串，而是整数序列。Tokenizer 决定了词表大小、序列长度、训练数据体积，也决定了模型如何表示罕见字符和特殊标记。

我实现的是 byte-level BPE。基础词表包含 256 个单字节 token，因此任意 UTF-8 文本原则上都可编码，不需要 `<unk>`。训练开始时先放入 special tokens，再加入单字节 token；之后每轮把语料中最频繁的一对相邻符号合并，直到达到目标词表大小。

这里需要区分三个容易混淆的对象：

- **字符**是人看到的 Unicode code point，例如 `你`；
- **字节**是 UTF-8 编码后的整数，`你` 会变成三个字节 `e4 bd a0`；
- **BPE token** 是一个或多个连续字节，训练后可能恰好覆盖一个字、半个多字节字符、一个词或带前导空格的词。

模型只处理最后一种对象的整数 ID。以 bytes 作为不可再分的基础符号，保证了任意文本都有表示；代价是 decode 时可能遇到不能单独构成合法 UTF-8 的 token 序列，所以实现把 token bytes 全部拼接后再统一解码，并对非法序列使用 replacement character。

若当前 pair 集合为 $P$，每轮选择：

$$
p^* = \arg\max_{p \in P}\left(\operatorname{count}(p), p\right)
$$

第二项是作业规定的字典序 tie-break：频次相同时选字典序更大的 pair。这个细节很小，但会改变后续每一步 merge，最终让整个词表与 reference 不一致。

### 用一个小例子走完一次 BPE

假设 pre-token 统计结果为：

```text
"low"   出现 2 次 -> (l, o, w)
"lower" 出现 1 次 -> (l, o, w, e, r)
```

初始相邻 pair 的加权计数是：

```text
(l, o): 3
(o, w): 3
(w, e): 1
(e, r): 1
```

若 tie-break 选中 `(o, w)`，就生成新 token `ow`，两个序列同时改写为 `(l, ow)` 与 `(l, ow, e, r)`。下一轮的统计必须删除旧的 `(l, o)`、`(o, w)` 贡献，再加入 `(l, ow)`、`(ow, e)`。因此一次 merge 不只是“向词表追加字符串”，还会改变下一轮所有候选 pair 的频次。

最终词表 ID 的顺序也有语义：special token 先占 ID，随后是 256 个 byte token，再按训练顺序追加 merge token。若有一个 special token，目标词表为 10,000，那么正常情况下 merge 数正好是 $10{,}000-256-1=9{,}743$，这也解释了实验结果中的 `9,743 merges`。

### GPT-2 pre-tokenization 不是可选装饰

直接在整段文本上做 BPE，会产生跨单词、跨空白的奇怪合并。实现先使用 GPT-2 regex 把文本切成 pre-token：

```python
r"'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+"
```

每个 pre-token 再转成 UTF-8 bytes，pair 统计和 merge 都不会越过它的边界。这样既保留前导空格信息，也能稳定处理单词、数字、标点和连续空白。

例如 `hello world` 通常会产生接近 `hello` 与 ` world` 的两个 pre-token，而不是先丢弃空格再处理 `world`。前导空格因此可以进入 token bytes，模型能够区分句首单词和正文中带空格的单词。regex 中 contraction、Unicode letters、numbers、punctuation、whitespace 分支的顺序同样属于 tokenizer 定义；改成看起来相似的 `split()`，训练出的 merges 和 GPT-2 对齐结果都会变化。

### special token 必须是硬边界

`<|endoftext|>` 不能被正则拆成普通字符，也不能参与 pair 统计。训练和编码都先按 special token 做最长匹配切分：

- special token 自己对应一个原子 ID；
- 左右普通文本分别 pre-tokenize；
- merge 永远不会跨过 special token；
- 流式输入若刚好在 `<|end` 中间截断，会把未完成前缀留给下一个 chunk。

这部分是 tokenizer 最容易“普通样例能过、边界测试失败”的地方。实现没有假设 chunk 正好落在字符、regex token 或 special token 边界上。

special token 按长度降序匹配也很重要。若同时配置 `<|end|>` 和 `<|endoftext|>`，当前位置能匹配多个候选时必须优先取更长者，否则长 token 会被短 token 前缀截断。训练阶段跳过 special token，编码阶段则直接发出它的单一 ID；两条路径必须遵守同一套边界规则。

## 2. BPE 如何从正确走向可扩展

最直观的 BPE 写法是每轮重新扫描整份语料，统计全部 pair，再找最大值。它容易验证，却会把 `vocab_size` 次迭代都变成全量工作。

这里维护了三类状态：

1. 去重后的 pre-token 及其语料频次；
2. 全局 `pair_counts`；
3. `pair -> 包含它的 pre-token 行` 的倒排索引。

“去重后的 pre-token”是第一个关键压缩。语料里同一个词可能出现几百万次，但训练时只需保存一份符号序列和一个频次 $f_w$。如果 pair $p$ 在该序列内部出现 $c_{w,p}$ 次，它对全局统计的贡献就是 $f_wc_{w,p}$：

$$
C(p)=\sum_w f_w c_{w,p}
$$

因此实现中的 `words[idx]` 保存当前符号序列，`counts[idx]` 保存语料频次。倒排索引保存的是“哪些唯一序列可能受某个 pair 影响”，而不是该 pair 在原文中的每个位置。

合并某个 pair 时，只重算真正受影响的 pre-token，并对旧 pair 计数做减法、对新 pair 计数做加法。后续为 OpenWebText 做准备时，又把“每轮扫描全部 `pair_counts` 找最大值”改为 lazy heap：

- heap key 使用负频次；
- 自定义逆序 pair 比较器保留字典序更大者优先的 tie-break；
- pair 计数变化时压入新条目，不原地更新旧条目；
- pop 时若 heap 内频次与当前 `pair_counts` 不一致，就丢弃 stale entry。

这种 lazy invalidation 避免了复杂的可变优先队列，同时保持与 reference 完全相同的选择规则。优化后的 tokenizer/BPE 定向测试为 `26 passed, 2 skipped`。

一次 merge 的更新过程可以更精确地写成：

1. 从 heap 弹出频次最高、tie-break 最大且仍然有效的 `best_pair`；
2. 通过倒排索引找到包含它的唯一 pre-token 行；
3. 对每一行，先从全局计数减去整条旧序列的 pair 贡献；
4. 从旧 pair 的倒排集合移除该行；
5. 以 non-overlapping、从左到右的规则合并目标 pair；
6. 把新序列的 pair 贡献加回全局计数，并更新倒排集合；
7. 仅为计数发生变化且仍为正数的 pair 压入新 heap entry。

第 3 步看似比只更新目标 pair 周围更“笨”，但它把局部正确性做得很直接：受影响的序列通常远小于全部语料，而整行重算可以自然处理重复 pair 和相邻重叠。例如 `(a, a, a)` 合并 `(a, a)` 时，non-overlapping 结果是 `(aa, a)`，不是同时复用中间那个 `a` 得到两个 `aa`。

lazy heap 的正确性依赖一个不变量：`pair_counts` 是当前真值，heap 只是可能过期的候选缓存。由于 Python `heapq` 不支持 decrease-key，频次变化时保留旧项并压入新项；pop 出 `(pair, cached_count)` 后，只有 `pair_counts[pair] == cached_count` 才能使用。这样每次更新是 $O(\log |P|)$，代价是 heap 里会暂时存在 stale entries。

从复杂度看，朴素版本每次 merge 都扫描全部唯一 pre-token 和全部 pair；增量版本把重写范围缩小到包含当前 pair 的行，再用 heap 避免每轮对所有候选取最大值。它并没有让 BPE 变成线性算法，常见词很长或某个 pair 覆盖大量行时仍会昂贵，但对 GB 级语料已经从不可用推进到了可运行。

### 编码是按 merge rank 重放训练历史

训练输出的不只是最终词表，还有有序 merge 列表。编码一个 pre-token 时，从单字节序列开始，反复找到当前相邻 pair 中 merge rank 最小者并合并，直到没有 pair 存在于 merge table。

常见 pre-token 的结果会缓存，但缓存 key 是原始 bytes，不把 special token 和普通文本混在一起。解码则拼接 token bytes，再使用 `errors="replace"` 转回 UTF-8，满足非法字节序列的定义行为。

这里不能在编码时重新选择“当前最频繁的 pair”，因为单条待编码文本上没有训练语料频次。`merges[0]` 是训练时最早学到的规则，rank 为 0，优先级最高；每一步都在当前相邻 pair 中找 rank 最小者。仍以上面的序列为例，若 merge 顺序是：

```text
rank 0: (o, w) -> ow
rank 1: (l, ow) -> low
```

那么 `(l, o, w, e, r)` 先变成 `(l, ow, e, r)`，再变成 `(low, e, r)`。直接做最长字符串匹配在一般情况下不等价，因为一个长 token 是否可达，取决于训练 merge 构成它的顺序。

缓存发生在完整 pre-token bytes 上。它对英文常见词很有效，但也意味着缓存大小取决于不同 pre-token 的数量；数据编码的 peak RSS 并不会严格固定在 token chunk buffer 大小。公开实现保留了这个速度与内存之间的简单折中，没有实现 LRU 上限。

### 为什么 `vocab.json` 不能直接写任意 bytes

JSON string 必须是 Unicode 文本，不能直接承载任意 0--255 bytes。序列化时使用 GPT-2 的 byte-to-Unicode 双射，把每个 byte 映射到一个可打印 code point；加载时再做逆映射。`merges.txt` 也使用同一表示，因此 tokenizer artifact 既能保留任意字节，又兼容 GPT-2 风格文件。

这层映射只解决**文件格式**问题，不改变模型实际看到的 token bytes。若把映射后的字符误当成原文再做 UTF-8 编码，tokenizer 会产生完全不同的字节序列。

## 3. 流式处理真正难的是边界

“分块读取文件”并不自动等于流式正确。若每个 chunk 单独跑 regex，chunk 末尾的半个单词会被提前提交；若 special token 横跨两个 chunk，也可能被拆坏。

训练 pre-tokenizer 和 `encode_iterable` 都采用同一个原则：

1. `buffer += chunk`；
2. 只消费确定已经闭合的部分；
3. 保留最后一个可能继续增长的 regex token；
4. 保留可能构成 special token 的后缀；
5. EOF 时以 `final=True` 消费剩余内容。

因此，流式编码结果应与一次性 `encode(full_text)` 完全相同，而不是“足够接近”。

一个具体反例是两块输入 `"hel"`、`"lo world"`。若第一块立即提交 `hel`，第二块只能编码 `lo`；但整段 regex 本应先得到 `hello`，它可能存在专门的 BPE token。另一个反例是 `"abc<|end"`、`"oftext|>def"`：第一块结尾既可能是普通文本，也可能是 special token 前缀，在看到下一块前不能决定。

实现中的 scanner 每轮在三个位置之间取最早边界：完整 special token 的起点、某个 special token 未完成前缀的起点，以及当前 buffer 末尾。普通区间运行 regex 后，在非 EOF 模式下再保留最后一个贴着开放末尾的 match，因为它仍可能被下个 chunk 延长。只有 EOF 的 `final=True` 才允许提交所有剩余内容。

需要注意的是，Python 文本文件迭代默认按行产生字符串，而 `encode_iterable` 的接口也允许调用者提供任意切块。正确性测试因此不只测“逐行输入”，还应主动把边界切在单词、Unicode 文本和 special token 内部，并验证：

$$
\operatorname{encode\_iterable}(c_1,c_2,\ldots,c_n)
=\operatorname{encode}(c_1+c_2+\cdots+c_n)
$$

所谓流式在这里主要指“不要求一次把原始文本读进内存”。BPE 训练仍会把**所有唯一 pre-token 及其计数**保存在内存里；若语料几乎没有重复项，这部分仍可能成为瓶颈。这是后文实验内存数字必须带上的限定条件。

## 4. 从基础算子搭出 Transformer

[模型实现][nn]没有使用 PyTorch 的成品 Transformer 层。核心组件如下：

| 组件 | 实现要点 |
|---|---|
| `Linear` | 无 bias；权重形状 `(out, in)`；计算 `x @ W.T` |
| `Embedding` | 直接用 token IDs 索引参数矩阵 |
| `RMSNorm` | 中间计算上转 `float32`，输出恢复输入 dtype |
| `SwiGLU` | `W2(SiLU(W1x) * W3x)` |
| `RoPE` | 预计算 sin/cos buffer，只旋转 Q 和 K |
| Attention | scaled dot product + causal boolean mask |
| Block | pre-norm residual |
| LM | embedding -> blocks -> RMSNorm -> vocab projection |

### 先固定 shape，再写算子

模型 forward 的 shape 流如下：

```text
token IDs                         (B, T)
token embeddings                  (B, T, D)
Q / K / V projections             (B, T, D)
split heads                       (B, H, T, Dh)
attention scores                  (B, H, T, T)
weighted values                   (B, H, T, Dh)
merge heads                       (B, T, D)
each residual block output        (B, T, D)
vocabulary logits                 (B, T, V)
```

这份实现刻意让 `Linear.weight` 使用 `(out_features, in_features)`，forward 执行 `x @ W.T`。这样参数布局与 PyTorch `nn.Linear` 及作业 snapshot 一致。初始化标准差为

$$
\sigma=\sqrt{\frac{2}{d_{in}+d_{out}}}
$$

并截断到 $[-3\sigma,3\sigma]$。`Embedding.weight` 形状为 $(V,D)$，输入 ID 直接做高级索引，因此 `(B,T)` 自然变成 `(B,T,D)`。

没有 bias，也没有把 input embedding 与 output projection 权重绑定。由此，模型参数量可以直接写成：

$$
N_{params}=2VD+L\left(4D^2+3DD_{ff}+2D\right)+D
$$

其中 $2VD$ 分别来自 embedding 和 LM head，每层 $4D^2$ 来自 Q/K/V/output projection，$3DD_{ff}$ 来自 SwiGLU 的三块矩阵，$2D$ 来自两个 RMSNorm，最后 $D$ 是 final RMSNorm。按复现命令的 $V=10{,}000,D=512,L=4,D_{ff}=1344$ 计算，共 `22,696,448` 个参数。这个数字不包含 RoPE sin/cos，因为它们是 non-persistent buffers，不是可训练参数。

### RMSNorm 的数值路径

对最后一维，RMSNorm 计算：

$$
\operatorname{RMSNorm}(x)=g\odot\frac{x}{\sqrt{\operatorname{mean}(x^2)+\epsilon}}
$$

bf16/float16 下直接平方和求均值更容易积累误差，因此实现先转成 `float32` 做归一化，再转回输入 dtype。gain 参数 $g$ 仍参与梯度更新。

与 LayerNorm 相比，RMSNorm 不减去均值，也没有 bias；它只控制向量的均方根尺度。对某个 token 的 hidden vector $x\in\mathbb{R}^{D}$，`mean(..., dim=-1, keepdim=True)` 只在 feature 维归一化，不会混合 batch 或 sequence 中的其他 token。`keepdim=True` 让归一化因子保持 `(B,T,1)`，可以广播回 `(B,T,D)`。

这里的 dtype 顺序同样具体：`x -> float32 -> square/mean/rsqrt -> 乘 gain -> 输入 dtype`。如果先在 bf16 中平方，再把结果转成 float32，精度已经丢失，无法补救。

### SwiGLU 的门控路径

普通两层 FFN 常写成 $W_2\phi(W_1x)$；SwiGLU 增加一条门控支路：

$$
\operatorname{SwiGLU}(x)=W_2\left(\operatorname{SiLU}(W_1x)\odot W_3x\right),
\qquad \operatorname{SiLU}(z)=z\sigma(z)
$$

`W1` 和 `W3` 都把最后一维从 $D$ 投影到 $D_{ff}$，逐元素相乘后 `W2` 再投影回 $D$。因此残差相加前后的 shape 一致。它使用三块矩阵而非普通 FFN 的两块矩阵，参数量和 `d_ff` 的选取必须一起考虑。

### RoPE 不需要显式位置 embedding

每个 attention head 的相邻两维组成二维向量，位置 $m$ 对不同频率施加旋转：

$$
\begin{bmatrix}
x'_{2i} \\
x'_{2i+1}
\end{bmatrix}
=
\begin{bmatrix}
\cos(m\omega_i) & -\sin(m\omega_i) \\
\sin(m\omega_i) & \cos(m\omega_i)
\end{bmatrix}
\begin{bmatrix}
x_{2i} \\
x_{2i+1}
\end{bmatrix}
$$

sin/cos 在初始化时预计算为 non-persistent buffers。forward 根据 token positions 索引并广播到 batch/head 维，只对 Q、K 应用 RoPE，V 保持不变。

代码先把 head 最后一维从 $D_h$ reshape 成 $(D_h/2,2)$，所以 $D_h$ 必须是偶数。第 $i$ 对维度使用频率

$$
\omega_i=\Theta^{-2i/D_h}
$$

位置 $m$ 的旋转角是 $m\omega_i$。在 attention 点积中，两个都经过旋转的向量满足 $R_m^TR_n=R_{n-m}$，因此分数自然包含相对位移 $n-m$；这就是只旋转 Q/K、无需把绝对位置向量加到 embedding 上的原因。

`cos` 和 `sin` 以 float32 预计算到 `context_length`，使用时根据 `token_positions` 索引，再转到 Q/K 的 dtype 和 device。注册为 non-persistent buffer 有两个效果：调用 `model.to(...)` 时它们仍跟随模块移动，但不会写进 checkpoint；加载模型时会由结构参数重新生成。

### Attention mask 的语义必须统一

scaled dot-product attention 为：

$$
\operatorname{Attention}(Q,K,V)=\operatorname{softmax}\left(\frac{QK^\top}{\sqrt{d_k}}+M\right)V
$$

实现约定 boolean mask 中 `True` 表示可见，`False` 位置填为该 dtype 的最小有限值。因果 mask 使用下三角矩阵，保证位置 $t$ 只能读取不晚于 $t$ 的 token。

除以 $\sqrt{D_h}$ 是为了控制点积方差。若 Q/K 各维近似独立且方差为 1，未经缩放的点积方差会随 $D_h$ 增长，softmax 迅速饱和，梯度集中在少数位置。缩放后 score shape 为 `(B,H,T,T)`，最后一维对应被读取的 key 位置。

对长度 4 的序列，mask 是：

```text
1 0 0 0
1 1 0 0
1 1 1 0
1 1 1 1
```

第 2 行（从 0 开始）只能读取位置 0、1、2。代码用 `torch.finfo(dtype).min` 而不是字面量 `-1e9`，避免后者在低精度 dtype 中出现不一致表示。由于 causal mask 每一行至少允许当前位置，不会出现整行全被 mask 后 softmax 无定义的问题。

当前实现显式构造 $(T,T)$ mask 和 attention score，attention 的计算量与中间显存都是 $O(T^2)$；它没有使用 FlashAttention，也没有实现 padding mask。这对于作业中的基础实现是清晰的，但不是长上下文训练的最终形态。

### Pre-norm block

每层按下面顺序计算：

```python
x = x + attention(rms_norm_1(x))
x = x + swiglu(rms_norm_2(x))
```

最后再做一次 RMSNorm 和 vocabulary projection。模块命名与 reference state dict 一致，因此 snapshot 权重可以直接装载，测试的不只是输出 shape，而是逐层数值行为。

pre-norm 的关键是残差主干在 normalization 外部。设 attention 子层为 $A$、FFN 为 $F$：

$$
h=x+A(\operatorname{RMSNorm}(x)),\qquad
y=h+F(\operatorname{RMSNorm}(h))
$$

第二个 RMSNorm 的输入必须是已经加过 attention residual 的 $h$。把两个子层都作用在原始 $x$ 上，或先相加再 norm，shape 都不会报错，却会变成不同架构。完整 LM 在所有 block 后再做 final RMSNorm，最后将每个位置的 hidden vector 投影成 $V$ 个未归一化 logits；训练时不在模型 forward 内做 softmax。

## 5. 训练工具中的数值细节

基础算子看似短，却最容易在极端输入上出问题。

### Stable softmax 与 cross entropy

softmax 先减去目标维最大值：

$$
\operatorname{softmax}(x_i)=\frac{e^{x_i-m}}{\sum_j e^{x_j-m}},\qquad m=\max_j x_j
$$

cross entropy 使用 log-sum-exp 形式，避免先算很小的概率再取对数。

对某个位置的 logits $z\in\mathbb{R}^V$ 和正确 token ID $y$，实现计算：

$$
\ell(z,y)=\log\sum_{j=1}^{V}e^{z_j-m}-(z_y-m),\qquad m=\max_j z_j
$$

减去 $m$ 不改变 softmax，因为分子分母都乘了同一个 $e^{-m}$，却能保证最大的 exponent 是 $e^0=1$，避免大正数溢出。代码用 `gather` 直接取目标 logit，不先创建大小为 $(B,T,V)$ 的 one-hot target。

训练时 logits 从 `(B,T,V)` reshape 成 `(B*T,V)`，target 从 `(B,T)` reshape 成 `(B*T)`，最后对 $BT$ 项 loss 取平均。这个平均定义意味着改变 batch size 或 context length 时，单个 step 的 loss 标度不会随 token 数线性增长。

### 全局梯度裁剪

梯度裁剪计算所有非空参数梯度组成的一个全局 L2 norm，而不是逐 tensor 各裁一次：

$$
g \leftarrow g\cdot\min\left(1,\frac{c}{\lVert g\rVert_2+\epsilon}\right)
$$

实现中的 $\epsilon$ 固定为 $10^{-6}$，这使阈值 $c$ 表示整个模型更新的最大范数。

实现先求每个 gradient tensor 的 L2 norm，再把这些 norm 堆叠后再求一次 L2 norm。这与把全部梯度展平成一个长向量再求 norm 等价：

$$
\sqrt{\sum_k\lVert g_k\rVert_2^2}
=\sqrt{\sum_k\sum_i g_{k,i}^2}
$$

若 total norm 不超过阈值，梯度保持不变；超过时，所有 tensor 乘同一个系数。逐 tensor 分别裁剪会改变不同参数组之间的相对方向，不是这里要实现的 global clipping。裁剪必须发生在 `backward()` 之后、`optimizer.step()` 之前。

### AdamW 是 decoupled weight decay

[AdamW 实现][optim]维护一阶、二阶矩和 bias correction。weight decay 直接作用在参数上，与自适应梯度更新解耦，而不是把 L2 penalty 混进梯度后再缩放。

学习率采用 warmup + cosine decay：warmup 前线性上升，cycle 内从最大值余弦下降到最小值，cycle 之后保持最小值。

对第 $t$ 步梯度 $g_t$，实现维护：

$$
m_t=\beta_1m_{t-1}+(1-\beta_1)g_t
$$

$$
v_t=\beta_2v_{t-1}+(1-\beta_2)g_t^2
$$

并使用 bias correction：

$$
\hat m_t=\frac{m_t}{1-\beta_1^t},\qquad
\hat v_t=\frac{v_t}{1-\beta_2^t}
$$

代码把 bias correction 合并进 step size，实际更新写成：

$$
\theta_t=(1-\eta_t\lambda)\theta_{t-1}
-\eta_t\frac{\sqrt{1-\beta_2^t}}{1-\beta_1^t}
\frac{m_t}{\sqrt{v_t}+\epsilon}
$$

第一项直接缩小参数，是 decoupled weight decay。若把 $\lambda\theta$ 加进 gradient 再交给 Adam，它还会经过一阶、二阶矩归一化，产生不同更新。上式也保留了源码中 $\epsilon$ 的准确位置；把它草率改写成 $\hat m_t/(\sqrt{\hat v_t}+\epsilon)$ 会漏掉 bias-correction 对 epsilon 的缩放差异。实现明确拒绝 sparse gradient，因为当前状态更新只覆盖 dense tensor。

学习率是下面的分段函数：

$$
\eta(t)=
\begin{cases}
\frac{t}{T_w}\eta_{max}, & t<T_w\\
\eta_{min}+\frac{1}{2}\left[1+\cos\left(\pi\frac{t-T_w}{T_c-T_w}\right)\right](\eta_{max}-\eta_{min}), & T_w\le t\le T_c\\
\eta_{min}, & t>T_c
\end{cases}
$$

其中 $T_w$ 是 warmup iterations，$T_c$ 是 cosine cycle 结束位置。配置应满足 $0<T_w<T_c$；当前函数没有单独验证这个关系。训练循环在 forward 前把这一数值写入每个 optimizer parameter group，所以日志里的 `lr` 就是该 iteration 实际使用的学习率。

## 6. 让数据准备不会被 Python list 撑爆

TinyStories train 文本约 2.1 GB。最初的 `encode` 把所有 token 追加到 Python `list[int]`，最后再转 NumPy。一个 Python int 的对象开销远大于最终的 `uint16`，因此 5 亿级 token 很容易 OOM。

最终训练数组有 `541,229,347` 个 token。仅 `uint16` payload 的理论大小约为：

$$
541{,}229{,}347\times 2
=1{,}082{,}458{,}694\ \text{bytes}
\approx 1.008\ \text{GiB}
$$

而 64 位 CPython 中，一个 list slot 通常还要一个 8-byte 指针，每个非复用整数对象通常还有数十 bytes 的对象头。具体数值依 Python 版本而异，但数量级很容易超过十几 GiB；最终数组只有约 1 GiB，并不意味着中间 Python 表示也只有 1 GiB。

[修正后的数据准备][prepare-data]分两步：

1. `encode_iterable` 持续产出 token chunk，直接写入隐藏 raw 临时文件，并统计 token 数；
2. 得到最终 shape 后，用 `np.lib.format.open_memmap` 创建合法 `.npy`，再分块把 raw 数据复制进去。

临时 raw 文件在 `finally` 中清理。这个设计没有把完整 token 序列留在 Python heap，同时保留了标准 `.npy` header，后续可用 `np.load(..., mmap_mode="r")` 读取。

为什么不一开始就直接创建 `.npy`？因为 `.npy` header 需要写入数组 shape，而单次流式编码开始前还不知道总 token 数。这里先写无 header 的定长 raw payload，同时计数；得到 $N$ 后创建 shape 为 `(N,)` 的 memmap，再以每次 1,000,000 个 token 的块复制。

这是一种“有限内存、额外磁盘 I/O”的取舍：

- 内存里只保留当前 token buffer 和当前复制块；
- 编码结束到复制完成之间，磁盘上会同时存在 raw 与 `.npy`，临时空间接近最终 token payload 的两倍；
- `finally` 保证正常或异常退出都会尝试删除 raw 文件；
- 最终 `.npy` 只有在完整复制并 `flush()` 后才适合作为训练输入。

如果异常发生在 `.npy` 已创建之后，raw 文件会清理，但不完整的目标 `.npy` 可能仍会留在原路径；当前实现没有使用“写入临时目标后原子 rename”的发布协议。因此失败后应删除或覆盖目标文件，并重新检查 shape、dtype 和 token 范围，不能只凭文件存在就继续训练。

选择 `uint16` 的前提是所有 token ID 小于 $2^{16}=65{,}536$。10K TinyStories 和计划中的 32K OWT 词表满足这个范围；如果未来词表更大，应改用 `uint32`。当前 CLI 把 dtype 作为调用者参数，并没有额外检查 token ID 是否溢出，因此 dtype 是数据准备配置的一部分，不是可以随意替换的存储细节。

A100 上的实际结果：

| 数据 | tokens | dtype | 文件大小 | elapsed | peak RSS |
|---|---:|---|---:|---:|---:|
| TinyStories valid | 5,465,883 | uint16 | 约 11 MB | 19.94 s | 58.14 MB |
| TinyStories train | 541,229,347 | uint16 | 约 1.1 GB | 846.84 s | 1,084.08 MB |

峰值内存仍会受到 tokenizer cache、buffer 和运行环境影响，但已经消除了“token 数量乘 Python 对象开销”的主要风险。

训练读取这类数组时使用 `np.load(path, mmap_mode="r")`。操作系统按需把所访问的页载入内存，代码不需要先复制完整 1.1 GB 数组。`get_batch` 只根据随机起点 materialize 当前 `(B,T)` 输入与目标，然后转成 `torch.long` 放到训练 device；token 文件可以保持紧凑的 `uint16`，Embedding 索引才转换成框架要求的整数类型。

## 7. 训练循环如何闭环

[训练入口][train]使用 memory-mapped token array，每个 batch 随机采样连续窗口：输入是长度 $T$ 的 token，标签是向右平移一位的 next-token IDs。

设 token 数组为 $d_0,d_1,\ldots,d_{N-1}$，某个随机起点为 $s$，则：

$$
x=(d_s,d_{s+1},\ldots,d_{s+T-1})
$$

$$
y=(d_{s+1},d_{s+2},\ldots,d_{s+T})
$$

所以每个样本实际需要访问 $T+1$ 个 token，合法起点是 $0\le s<N-T$。实现一次生成 $B$ 个起点，再用 NumPy broadcasting 构造 `(B,T)` 索引矩阵。这里的随机窗口不是按文档边界切分：一个窗口可能跨过两篇 story，边界信息依赖语料中是否存在 `<|endoftext|>`。

完整 step 为：

```text
sample mmap batch
  -> forward logits
  -> flattened cross entropy
  -> zero_grad
  -> backward
  -> global gradient clipping
  -> AdamW step
  -> periodic validation / JSONL log / checkpoint
```

源码中的准确顺序是：先按当前 iteration 计算 learning rate，再采样和 forward，然后计算平均 cross entropy；`zero_grad(set_to_none=True)` 在 backward 前清掉上一步梯度，随后 backward、可选 clipping、AdamW step。`set_to_none=True` 避免把所有 gradient buffer 逐个填零，也能让没有收到梯度的参数保持 `grad is None`。

一次 iteration 处理的训练 token 数按 `batch_size * context_length` 计。这里没有 gradient accumulation，所以配置里的 batch size 就是 optimizer 每步看到的窗口数；若以后加入 accumulation，日志中的 tokens processed 和有效 batch size 都要相应修改。

配置覆盖模型尺寸、优化器参数、warmup/cosine、evaluation、checkpoint、device 和 dtype。checkpoint 保存 model、optimizer 与 iteration，支持从已有训练状态恢复。日志记录 loss、perplexity、learning rate、已处理 token 数和 elapsed time，便于后续画 learning curve，而不是只留终端截图。

### 验证 loss 如何估计

到达第 1 步、`eval_every` 的倍数或最后一步时，训练循环从 validation memmap 随机抽取 `eval_batches` 个 batch，分别求 loss 后取算术平均。评估函数使用 `torch.no_grad()`，暂时切换到 `model.eval()`，完成后恢复原来的 training mode。

这个 validation loss 是 Monte Carlo 估计，不是完整验证集逐 token 扫描；它更便宜，但不同随机状态会有采样噪声。perplexity 定义为 $\exp(\text{loss})$，只有在 loss 使用自然对数 cross entropy 时成立。为避免 `exp` 在异常大 loss 上溢出，代码对 loss 大于 100 的情况直接记为 infinity。

日志中的 `train_loss` 是刚完成 optimizer step 的那一个训练 batch 在**更新前 forward** 得到的 loss，`valid_loss` 才是多个随机验证 batch 的平均值，两者统计口径不同。验证采样和训练采样共用 NumPy RNG；因此修改 `eval_every` 或 `eval_batches` 也会改变后续训练窗口序列。要做严格可比实验，这些看似只影响日志的参数也必须固定。

### checkpoint 为什么还要保存随机状态

只保存 model 和 optimizer 可以继续优化，却不能保证恢复后的数据窗口与不中断运行一致。checkpoint 因此还保存：

- Python `random` 状态；
- NumPy RNG 状态，决定 `get_batch` 的随机起点；
- PyTorch CPU RNG 状态；
- 可用时的全部 CUDA RNG 状态。

加载时恢复这些状态，并返回保存的 iteration。训练循环从该 iteration 继续，学习率 schedule 也使用恢复后的全局 step。测试专门比较 checkpoint 前后生成的随机数，验证的不只是“权重能够 load”。

checkpoint 还可选保存 JSON-friendly config，便于审计训练参数。当前生成 CLI 仍要求显式提供模型结构参数，而不是自动完全信任 checkpoint config。`d_model`、层数等 shape 相关参数不一致时，`load_state_dict` 通常会失败；`rope_theta` 这类不写入 state dict、又不改变参数 shape 的配置却可能静默改变行为，因此恢复前仍要核对保存的 config。

### 这条训练路径的边界

`dtype=bfloat16` 会直接以 bf16 创建模型参数，A100 smoke run 证明这条路径能执行，但当前训练器没有 autocast、FP32 master weights、GradScaler、gradient accumulation、DDP、fused optimizer 或 compile。它是为了验证作业组件能闭环的单卡最小训练器，不应和成熟的大规模训练栈混为一谈。

## 8. 生成不是简单的 argmax

[生成模块][generation]支持三种行为：

- `temperature == 0`：greedy decoding；
- `temperature > 0`：对 logits 除以 temperature 后采样；
- 配置 `top_p`：保留累计质量严格超过 $p$ 的最短高概率前缀，再归一化采样。

temperature 对分布的作用发生在 softmax 之前：

$$
p_i=\operatorname{softmax}(z_i/\tau)
$$

$0<\tau<1$ 会放大 logit 差距，使输出更集中；$\tau>1$ 会使分布更平；`temperature == 0` 不能做除法，所以实现直接走 argmax。负 temperature 没有合理概率语义，会被拒绝。

top-p 的步骤是：概率降序排序、计算累计和、屏蔽阈值后的尾部、重新归一化、在排序后的索引空间采样，最后映射回原 token ID。实现先计算 `cumulative > p`，再把 mask 向右移动一位，这一步保证**首次使累计概率越过 $p$ 的 token 仍被保留**。例如排序后概率为 `[0.50, 0.30, 0.15, 0.05]`，`p=0.70` 时应保留前两个 token，总质量 0.80；若不右移 mask，就只剩 0.50，违背“达到阈值的最小前缀”。

生成时只把最近 `context_length` 个 token 输入模型，并在遇到可选 EOS 后停止。CLI 可以直接加载训练 checkpoint、vocab 和 merges，从 prompt 生成文本，不需要再写一份一次性脚本。

自回归循环的每一步都执行：

```text
已有 token
  -> 截取最后 context_length 个
  -> model(input_ids)
  -> 取 logits[:, -1, :]
  -> temperature / top-p / sample
  -> append next_id
  -> 若 next_id == EOS 则停止
```

只取最后位置 logits，是因为它预测“当前上下文之后的下一个 token”；前面位置的预测在上一轮已经使用过。EOS 字符串必须恰好编码成一个 token，否则无法用单个 ID 做停止判断，CLI 会明确报错。

生成函数进入前会记录 `model.training`，正常结束后恢复原模式，避免一次推理调用永久改变外部训练代码的状态。测试模型还会记录每轮看到的上下文，确认序列增长超过窗口后确实只传最后 $T$ 个 token。

当前实现没有 KV cache。每生成一个 token 都重新计算整个截断上下文，单步 attention 为 $O(T^2)$，生成 $M$ 个 token 时会重复计算过去的 K/V。这保持实现简单并足以验证采样逻辑，但长文本生成速度会明显落后于带 cache 的推理引擎。

## 9. A100 开发快照上跑了什么

远端环境使用 PyTorch `2.10.0+cu128` 和 `NVIDIA A100-SXM4-80GB`。下面的数据来自当时命令输出的记录，原始远端日志和 checkpoint 没有纳入清理后的公开仓库。该快照早于最终 lazy-heap 和公开导出提交，因此不能表述为对当前公开 commit 的 A100 验证。

修复 GPT-2 `tiktoken` cache 后，当时的远端验证为：

```text
pytest -q
47 passed, 1 xfailed

ruff check .
All checks passed!
```

### TinyStories tokenizer

训练集和验证集先在本地下载，再传到 A100，并分别做 SHA256 校验：

```text
train SHA256: 6418d412de72888f52b5142c761ac21a582f7d1166f0bfbdb5f03ccfdec90443
validation SHA256: 6874bae9a4c1a4e7edcf0e53b86c17817e9cf881fc75ff2368da457b80c0585d
```

10K tokenizer 的结果：

```text
vocab_size: 10000
num_merges: 9743
elapsed_seconds: 1336.37
peak_rss_mb: 150.72
```

`9,743` 次 merge 与 `1 special + 256 bytes + 9,743 merges = 10,000 vocab` 完全一致。训练耗时约 22 分 16 秒，说明当时的增量计数版本已经能处理完整 TinyStories；这次 A100 运行早于最终 lazy-heap 修改，不能用来宣称公开版本的 heap 优化带来了某个加速比。这个数字也不是通用 tokenizer benchmark：它还受 CPU、语料重复度、文件缓存和实现中的 Python 数据结构影响。

把完整文本编码成数组时，train 平均约 `639k tokens/s`，validation 约 `274k tokens/s`。两者吞吐差异说明短任务更容易被初始化、缓存冷启动和固定开销影响，不能只拿 validation 的 20 秒线性外推大文件耗时。train peak RSS 约 1.08 GB，也再次说明 token chunk 本身不是唯一内存来源，pre-token cache 会随处理过程增长。

### CUDA smoke training

```text
layers: 2
d_model: 128
context_length: 128
batch_size: 8
dtype: bfloat16
max_iters: 10
device: cuda
```

loss 从 iteration 1 的 `9.25` 变为 iteration 10 的 `9.125`，checkpoint 和 JSONL log 都成功写出。十步的变化不足以评价模型质量，但足以覆盖 CUDA dtype、mmap batch、forward/backward、optimizer、evaluation 和 serialization 的联调路径。

这三个 loss 还可以用随机基线校准。对 10,000 词表的均匀预测，cross entropy 是：

$$
\log(10{,}000)\approx 9.2103
$$

iteration 1 的 `9.25` 基本就在随机初始化附近；iteration 10 的 `9.125` 对应 perplexity 约 `9,182`，只比均匀分布的 `10,000` 略低。因此正确表述是“优化器已经让 loss 有轻微下降且整条 CUDA 路径工作”，不能写成“模型学会了生成故事”。要判断收敛，至少需要更长的 train/validation curve、固定 prompt 样本和与明确 baseline 的比较。

### OpenWebText 到了哪一步

OpenWebText train/valid 也遵循“本地下载、传输、远端校验”的流程。train gzip 太大且 SSH 链路较慢，最终切成 18 块传输，在 A100 重组后对完整 gzip 做 SHA256：

```text
train gzip SHA256: b19ae88cfbc4016b304c348522455fe38ebac48fffed955adcc7191a89e38ccf
validation gzip SHA256: bc73db5da2f19c360836b9c8a88094e13346ec83798c2f40060be39135768c80
owt_train.txt.gz  4,591,240,837 bytes
owt_train.txt     11,920,511,059 bytes
owt_valid.txt        289,998,753 bytes
```

在 OWT train 的前 8 MiB 上做了 bounded dry-run：vocab 512、255 merges、44.35 秒、peak RSS 101.45 MB。这只证明 OWT tokenizer 路径可运行，**不代表**完整 11.9 GB 语料上的 32K tokenizer 已经完成。

这个 dry-run 的词表同样满足 `1 + 256 + 255 = 512`。但它不能用于估算完整 32K 训练耗时：样本扩大后唯一 pre-token、pair 数量、倒排集合和 heap stale entry 都会非线性变化，而 merge 轮数也从 255 增长到约 31,743。它的价值是尽早检查 OWT 文本解压、UTF-8 读取、special token 和 artifact 写出路径，不是性能结论。

## 10. 验证策略

验证分为四层：

1. **组件 snapshot**：Linear、Embedding、RMSNorm、RoPE、attention、SwiGLU、block 和完整 LM 对齐 reference 权重与输出；
2. **算法边界**：BPE tie-break、special token、chunk boundary、encode/decode、AdamW、schedule、serialization；
3. **本地集成**：小语料训练 tokenizer、写入 `.npy`、mmap 读取、短训练、checkpoint、生成；
4. **远端开发快照**：真实 TinyStories、A100 CUDA smoke、日志和 checkpoint 的命令输出记录。

更具体地说，各类测试防守的是不同错误：

| 测试层 | 代表性断言 | 能发现什么 | 不能证明什么 |
|---|---|---|---|
| 数值 snapshot | 输出逐元素匹配 reference | transpose、head reshape、RoPE 广播、block 顺序错误 | 大规模训练稳定性 |
| tokenizer 对齐 | 多语言文本结果匹配 `tiktoken` | regex、merge rank、byte 映射错误 | 自训练词表的语义质量 |
| tokenizer round-trip | `decode(encode(x)) == x` | byte 丢失、special token 破坏 | token ID 是否与 reference 相同 |
| chunk boundary | iterable 编码等于整段编码 | 单词/special token 被跨块截断 | GB 级峰值内存一定达标 |
| optimizer snapshot | 参数更新匹配 reference | bias correction、epsilon、decay 顺序错误 | 超参数是否合适 |
| checkpoint RNG | 恢复后随机数序列一致 | 数据顺序无法复现 | 跨硬件 bitwise determinism |
| generation 回归 | greedy/top-p/EOS/window/load | mask 位移、停止条件、上下文截断错误 | 生成文本质量 |
| CUDA smoke | 真数据上跑通 10 step | device/dtype/序列化集成故障 | 收敛、吞吐上限、最终 loss |

snapshot 测试尤其有价值：很多 Transformer bug 不会改变 shape，甚至 loss 也可能缓慢下降。例如 Q/K/V head 维交换、RoPE 广播到错误轴、mask 的 True/False 语义翻转，都需要与已知权重和输出做数值比较才能快速定位。

旧开发树曾记录 `46 passed, 2 skipped`，heap BPE 修改后的定向测试是 `26 passed, 2 skipped`。发布前又从所需文件建立无 monorepo 历史、无内部 task 日志的清理仓库，补充 generation 的 greedy/top-p、EOS、context truncation 和 checkpoint loading 回归测试，并对导出代码重跑完整验证：`51 passed, 2 skipped`；Ruff 同样全部通过。A100 的 `47 passed, 1 xfailed` 属于更早的开发快照，不覆盖当前公开 commit。

这种记录方式刻意区分“历史上通过过”“最后改动后定向通过”和“本次没有运行完成”，避免用一个模糊的绿色结论掩盖验证时间点。

公开测试中的 `2 skipped` 是只在 Linux `rlimit` 环境运行的 tokenizer memory tests，在本地平台被跳过，不应包装成通过；A100 的 `1 xfailed` 是作业明确标记的整段 `encode` 高内存预期失败，也不是成功。另一方面，`51 passed` 证明的是公开提交在测试覆盖范围内的行为，不等于所有未实现实验已经完成。测试结论与实验结论必须分开写。

## 11. 如何复现最小流程

公开仓库不包含完整数据集、训练生成的 token arrays、tokenizer artifacts、日志或 checkpoint。开始前需要 Python 3.12/3.13、`uv`，若要使用 `--device cuda` 还需要可用的 CUDA PyTorch 环境。下面的命令都从仓库根目录运行。

安装项目并运行测试：

```bash
uv sync
uv run pytest
uv run ruff check .
```

先确认原始 TinyStories 文件位于：

```text
data/TinyStoriesV2-GPT4-train.txt
data/TinyStoriesV2-GPT4-valid.txt
```

为避免把“同名但内容不同”的文件混入实验，建议先用 `sha256sum`（macOS 可用 `shasum -a 256`）与本文第 9 节记录的 digest 对比。checksum 只能确认 bytes 相同，不能替代数据来源与许可审查。

训练 TinyStories tokenizer：

```bash
uv run python -m cs336_basics.prepare_data train-bpe \
  --input data/TinyStoriesV2-GPT4-train.txt \
  --vocab-size 10000 \
  --special-token '<|endoftext|>' \
  --vocab-out artifacts/tinystories_vocab.json \
  --merges-out artifacts/tinystories_merges.txt
```

编码训练集：

```bash
uv run python -m cs336_basics.prepare_data encode \
  --input data/TinyStoriesV2-GPT4-train.txt \
  --vocab artifacts/tinystories_vocab.json \
  --merges artifacts/tinystories_merges.txt \
  --special-token '<|endoftext|>' \
  --output data/tinystories_train_tokens.npy \
  --dtype uint16
```

用同一 tokenizer 编码验证集：

```bash
uv run python -m cs336_basics.prepare_data encode \
  --input data/TinyStoriesV2-GPT4-valid.txt \
  --vocab artifacts/tinystories_vocab.json \
  --merges artifacts/tinystories_merges.txt \
  --special-token '<|endoftext|>' \
  --output data/tinystories_valid_tokens.npy \
  --dtype uint16
```

此时 artifacts 的契约是：

```text
artifacts/tinystories_vocab.json   token bytes <-> integer ID
artifacts/tinystories_merges.txt   ordered BPE rules; line number is merge rank
data/*_tokens.npy                  shape (num_tokens,), dtype uint16
```

可以在训练前做一个轻量检查，防止把损坏、错误 dtype 或错误 shape 的文件送进长任务：

```bash
uv run python - <<'PY'
import numpy as np

for path in ["data/tinystories_train_tokens.npy", "data/tinystories_valid_tokens.npy"]:
    tokens = np.load(path, mmap_mode="r")
    print(path, tokens.shape, tokens.dtype, int(tokens.min()), int(tokens.max()))
PY
```

对 10K vocab，`max()` 应小于 10,000；数组应为一维且长度大于 context length。

启动一个小模型训练：

```bash
uv run python -m cs336_basics.train \
  --train-data data/tinystories_train_tokens.npy \
  --valid-data data/tinystories_valid_tokens.npy \
  --vocab-size 10000 \
  --context-length 256 \
  --d-model 512 \
  --num-layers 4 \
  --num-heads 16 \
  --d-ff 1344 \
  --checkpoint-out checkpoints/tinystories.pt \
  --log-out artifacts/tinystories.jsonl \
  --device cuda \
  --dtype bfloat16
```

这条命令使用默认 `batch_size=32`、`max_iters=5000`、warmup 500 steps、最大/最小学习率 `3e-4/3e-5`、每 100 steps 评估、每 500 steps 保存。所谓“小模型”只描述相对模型尺寸；实际显存、运行时间和数值稳定性仍应先用很小的 `--max-iters` 做 smoke test，再决定是否长跑。

从 checkpoint 继续时，`--max-iters` 表示目标**总 iteration**，不是再训练多少步。例如 checkpoint 保存在 step 500，要继续到 step 1000：

```bash
uv run python -m cs336_basics.train \
  --train-data data/tinystories_train_tokens.npy \
  --valid-data data/tinystories_valid_tokens.npy \
  --vocab-size 10000 \
  --context-length 256 \
  --d-model 512 \
  --num-layers 4 \
  --num-heads 16 \
  --d-ff 1344 \
  --checkpoint-in checkpoints/tinystories.pt \
  --checkpoint-out checkpoints/tinystories.pt \
  --log-out artifacts/tinystories-resume.jsonl \
  --max-iters 1000 \
  --device cuda \
  --dtype bfloat16
```

生成时必须提供与 checkpoint 完全一致的模型结构：

```bash
uv run python -m cs336_basics.generation \
  --checkpoint checkpoints/tinystories.pt \
  --vocab artifacts/tinystories_vocab.json \
  --merges artifacts/tinystories_merges.txt \
  --special-token '<|endoftext|>' \
  --eos-token '<|endoftext|>' \
  --prompt 'Once upon a time' \
  --max-new-tokens 128 \
  --temperature 0.8 \
  --top-p 0.9 \
  --vocab-size 10000 \
  --context-length 256 \
  --d-model 512 \
  --num-layers 4 \
  --num-heads 16 \
  --d-ff 1344 \
  --device cuda \
  --dtype bfloat16
```

数据、tokenizer artifact、日志和 checkpoint 都在 `.gitignore` 中，避免把大文件误提交到仓库。

## 12. 从症状反推问题在哪一层

这条链路很长，调试时最有效的做法不是直接盯最终 loss，而是沿表示边界逐层缩小范围。

| 症状 | 首先检查 | 原因 |
|---|---|---|
| round-trip 正确，但 token IDs 与 GPT-2 不同 | regex、special token 最长匹配、merge rank | 可逆只说明 bytes 没丢，不说明分词规则一致 |
| BPE 小样例一致，大语料结果不稳定 | tie-break、旧 pair 贡献扣减、stale heap 校验 | 任一轮选错都会级联改变后续全部 merges |
| iterable 与整段 encode 不同 | 最后一个开放 regex match、partial special suffix | chunk 边界被误当成语义边界 |
| 模型 shape 正确但 snapshot 不同 | `W.T`、split/merge heads、RoPE 轴、mask 语义 | 这些错误通常仍能输出合法 shape |
| loss 一开始就是 NaN/Inf | 学习率、RMSNorm dtype、mask、gradient norm | 低精度和 softmax 输入最容易暴露数值问题 |
| loss 长期停在 $\log V$ 附近 | target shift、optimizer 是否 step、梯度是否非零、数据是否重复 | 均匀预测的 loss 就是 $\log V$ |
| resume 后曲线突然跳变 | 模型结构、optimizer state、iteration、RNG state | 只恢复权重不等于恢复训练状态 |
| 编码阶段内存持续增长 | tokenizer cache 的唯一 key 数、buffer、raw/`.npy` 磁盘空间 | 流式输入并不保证所有内部状态有固定上限 |
| smoke run 生成乱码 | 先看训练步数与 validation loss | 能执行生成代码不代表权重已经学到语言分布 |

建议的最小定位顺序是：单函数 reference test -> 小型确定性输入 -> 跨 chunk 等价性 -> CPU 短训练 -> checkpoint 恢复 -> CUDA smoke -> 长训练。越靠前的检查越便宜，也越容易把错误定位到单一组件。

## 13. 尚未完成的实验

当前不能声称完成的部分包括：

- 完整 OpenWebText 32K tokenizer；
- OWT train/valid token arrays；
- OWT smoke 或正式训练；
- TinyStories 长训练与目标 validation loss；
- learning-rate / batch-size sweeps；
- generation 质量报告；
- RMSNorm、post-norm、NoPE、SwiGLU 等 ablations；
- leaderboard 相关结果。

这些不是“代码再补几行”就能替代的交付物，需要真实计算资源、日志、曲线和生成样本。仓库中的 [实验状态文档][summary] 保留了准确暂停点和恢复步骤。

若继续完成实验，最低证据标准应当是：记录不可变 config 与代码 commit；保存 train/validation JSONL；报告 wall-clock、peak memory 和 tokens/s；长训练同时给出 learning curve 与固定 prompt 样本；ablation 每次只改变一个因素，并保持 token budget、数据切分和评估过程一致。否则“某个版本更好”的差异很可能来自随机 batch、训练预算或数据条件，而不是所声称的结构变化。

## 结语

Assignment 1 最有价值的地方，是把“训练一个 Transformer”拆成许多必须同时正确的小系统：byte 边界、regex 边界、special token 边界、BPE tie-break、张量 shape、mask 语义、低精度归一化、全局梯度范数、文件格式和 checkpoint 状态。

单独看，每个函数都不长。真正的工程工作是让它们在同一份真实数据上闭环，并且在语料从几 KB 增长到几 GB 时仍然保持正确、可验证、可恢复。这也是我从这份作业里得到的核心认识：从零实现的目的不是重复造轮子，而是获得判断现成轮子何时会失效的能力。

[repo]: https://github.com/keepkeen/cs336-assignment1-basics/tree/779af60e0d0669845db68f7165912c305f9d35e7
[handout]: https://github.com/stanford-cs336/assignment1-basics
[explanation]: https://github.com/keepkeen/cs336-assignment1-basics/blob/779af60e0d0669845db68f7165912c305f9d35e7/docs/implementation.md
[summary]: https://github.com/keepkeen/cs336-assignment1-basics/blob/779af60e0d0669845db68f7165912c305f9d35e7/docs/experiments.md
[tokenizer]: https://github.com/keepkeen/cs336-assignment1-basics/blob/779af60e0d0669845db68f7165912c305f9d35e7/cs336_basics/tokenizer.py
[nn]: https://github.com/keepkeen/cs336-assignment1-basics/blob/779af60e0d0669845db68f7165912c305f9d35e7/cs336_basics/nn.py
[optim]: https://github.com/keepkeen/cs336-assignment1-basics/blob/779af60e0d0669845db68f7165912c305f9d35e7/cs336_basics/optim.py
[prepare-data]: https://github.com/keepkeen/cs336-assignment1-basics/blob/779af60e0d0669845db68f7165912c305f9d35e7/cs336_basics/prepare_data.py
[train]: https://github.com/keepkeen/cs336-assignment1-basics/blob/779af60e0d0669845db68f7165912c305f9d35e7/cs336_basics/train.py
[generation]: https://github.com/keepkeen/cs336-assignment1-basics/blob/779af60e0d0669845db68f7165912c305f9d35e7/cs336_basics/generation.py
