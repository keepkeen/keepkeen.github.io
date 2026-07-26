---
title: "CS336 Assignment 1：从 BPE 到 Transformer 语言模型"
description: "从零实现 byte-level BPE、RoPE Transformer、AdamW、训练与生成管线，并记录 TinyStories 在 A100 上的真实数据准备和 smoke run。"
date: 2026-07-26
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

若当前 pair 集合为 $P$，每轮选择：

$$
p^* = \arg\max_{p \in P}\left(\operatorname{count}(p), p\right)
$$

第二项是作业规定的字典序 tie-break：频次相同时选字典序更大的 pair。这个细节很小，但会改变后续每一步 merge，最终让整个词表与 reference 不一致。

### GPT-2 pre-tokenization 不是可选装饰

直接在整段文本上做 BPE，会产生跨单词、跨空白的奇怪合并。实现先使用 GPT-2 regex 把文本切成 pre-token：

```python
r"'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+"
```

每个 pre-token 再转成 UTF-8 bytes，pair 统计和 merge 都不会越过它的边界。这样既保留前导空格信息，也能稳定处理单词、数字、标点和连续空白。

### special token 必须是硬边界

`<|endoftext|>` 不能被正则拆成普通字符，也不能参与 pair 统计。训练和编码都先按 special token 做最长匹配切分：

- special token 自己对应一个原子 ID；
- 左右普通文本分别 pre-tokenize；
- merge 永远不会跨过 special token；
- 流式输入若刚好在 `<|end` 中间截断，会把未完成前缀留给下一个 chunk。

这部分是 tokenizer 最容易“普通样例能过、边界测试失败”的地方。实现没有假设 chunk 正好落在字符、regex token 或 special token 边界上。

## 2. BPE 如何从正确走向可扩展

最直观的 BPE 写法是每轮重新扫描整份语料，统计全部 pair，再找最大值。它容易验证，却会把 `vocab_size` 次迭代都变成全量工作。

这里维护了三类状态：

1. 去重后的 pre-token 及其语料频次；
2. 全局 `pair_counts`；
3. `pair -> 包含它的 pre-token 行` 的倒排索引。

合并某个 pair 时，只重算真正受影响的 pre-token，并对旧 pair 计数做减法、对新 pair 计数做加法。后续为 OpenWebText 做准备时，又把“每轮扫描全部 `pair_counts` 找最大值”改为 lazy heap：

- heap key 使用负频次；
- 自定义逆序 pair 比较器保留字典序更大者优先的 tie-break；
- pair 计数变化时压入新条目，不原地更新旧条目；
- pop 时若 heap 内频次与当前 `pair_counts` 不一致，就丢弃 stale entry。

这种 lazy invalidation 避免了复杂的可变优先队列，同时保持与 reference 完全相同的选择规则。优化后的 tokenizer/BPE 定向测试为 `26 passed, 2 skipped`。

### 编码是按 merge rank 重放训练历史

训练输出的不只是最终词表，还有有序 merge 列表。编码一个 pre-token 时，从单字节序列开始，反复找到当前相邻 pair 中 merge rank 最小者并合并，直到没有 pair 存在于 merge table。

常见 pre-token 的结果会缓存，但缓存 key 是原始 bytes，不把 special token 和普通文本混在一起。解码则拼接 token bytes，再使用 `errors="replace"` 转回 UTF-8，满足非法字节序列的定义行为。

## 3. 流式处理真正难的是边界

“分块读取文件”并不自动等于流式正确。若每个 chunk 单独跑 regex，chunk 末尾的半个单词会被提前提交；若 special token 横跨两个 chunk，也可能被拆坏。

训练 pre-tokenizer 和 `encode_iterable` 都采用同一个原则：

1. `buffer += chunk`；
2. 只消费确定已经闭合的部分；
3. 保留最后一个可能继续增长的 regex token；
4. 保留可能构成 special token 的后缀；
5. EOF 时以 `final=True` 消费剩余内容。

因此，流式编码结果应与一次性 `encode(full_text)` 完全相同，而不是“足够接近”。

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

### RMSNorm 的数值路径

对最后一维，RMSNorm 计算：

$$
\operatorname{RMSNorm}(x)=g\odot\frac{x}{\sqrt{\operatorname{mean}(x^2)+\epsilon}}
$$

bf16/float16 下直接平方和求均值更容易积累误差，因此实现先转成 `float32` 做归一化，再转回输入 dtype。gain 参数 $g$ 仍参与梯度更新。

### RoPE 不需要显式位置 embedding

每个 attention head 的相邻两维组成二维向量，位置 $m$ 对不同频率施加旋转：

$$
\begin{bmatrix}
x'_{2i} \\
x'_{2i+1}
\end{bmatrix}
=
\begin{bmatrix}
\cos(m\theta_i) & -\sin(m\theta_i) \\
\sin(m\theta_i) & \cos(m\theta_i)
\end{bmatrix}
\begin{bmatrix}
x_{2i} \\
x_{2i+1}
\end{bmatrix}
$$

sin/cos 在初始化时预计算为 non-persistent buffers。forward 根据 token positions 索引并广播到 batch/head 维，只对 Q、K 应用 RoPE，V 保持不变。

### Attention mask 的语义必须统一

scaled dot-product attention 为：

$$
\operatorname{Attention}(Q,K,V)=\operatorname{softmax}\left(\frac{QK^\top}{\sqrt{d_k}}+M\right)V
$$

实现约定 boolean mask 中 `True` 表示可见，`False` 位置填为该 dtype 的最小有限值。因果 mask 使用下三角矩阵，保证位置 $t$ 只能读取不晚于 $t$ 的 token。

### Pre-norm block

每层按下面顺序计算：

```python
x = x + attention(rms_norm_1(x))
x = x + swiglu(rms_norm_2(x))
```

最后再做一次 RMSNorm 和 vocabulary projection。模块命名与 reference state dict 一致，因此 snapshot 权重可以直接装载，测试的不只是输出 shape，而是逐层数值行为。

## 5. 训练工具中的数值细节

基础算子看似短，却最容易在极端输入上出问题。

### Stable softmax 与 cross entropy

softmax 先减去目标维最大值：

$$
\operatorname{softmax}(x_i)=\frac{e^{x_i-m}}{\sum_j e^{x_j-m}},\qquad m=\max_j x_j
$$

cross entropy 使用 log-sum-exp 形式，避免先算很小的概率再取对数。

### 全局梯度裁剪

梯度裁剪计算所有非空参数梯度组成的一个全局 L2 norm，而不是逐 tensor 各裁一次：

$$
g \leftarrow g\cdot\min\left(1,\frac{c}{\lVert g\rVert_2+\epsilon}\right)
$$

这使阈值 $c$ 表示整个模型更新的最大范数。

### AdamW 是 decoupled weight decay

[AdamW 实现][optim]维护一阶、二阶矩和 bias correction。weight decay 直接作用在参数上，与自适应梯度更新解耦，而不是把 L2 penalty 混进梯度后再缩放。

学习率采用 warmup + cosine decay：warmup 前线性上升，cycle 内从最大值余弦下降到最小值，cycle 之后保持最小值。

## 6. 让数据准备不会被 Python list 撑爆

TinyStories train 文本约 2.1 GB。最初的 `encode` 把所有 token 追加到 Python `list[int]`，最后再转 NumPy。一个 Python int 的对象开销远大于最终的 `uint16`，因此 5 亿级 token 很容易 OOM。

[修正后的数据准备][prepare-data]分两步：

1. `encode_iterable` 持续产出 token chunk，直接写入隐藏 raw 临时文件，并统计 token 数；
2. 得到最终 shape 后，用 `np.lib.format.open_memmap` 创建合法 `.npy`，再分块把 raw 数据复制进去。

临时 raw 文件在 `finally` 中清理。这个设计没有把完整 token 序列留在 Python heap，同时保留了标准 `.npy` header，后续可用 `np.load(..., mmap_mode="r")` 读取。

A100 上的实际结果：

| 数据 | tokens | dtype | 文件大小 | elapsed | peak RSS |
|---|---:|---|---:|---:|---:|
| TinyStories valid | 5,465,883 | uint16 | 约 11 MB | 19.94 s | 58.14 MB |
| TinyStories train | 541,229,347 | uint16 | 约 1.1 GB | 846.84 s | 1,084.08 MB |

峰值内存仍会受到 tokenizer cache、buffer 和运行环境影响，但已经消除了“token 数量乘 Python 对象开销”的主要风险。

## 7. 训练循环如何闭环

[训练入口][train]使用 memory-mapped token array，每个 batch 随机采样连续窗口：输入是长度 $T$ 的 token，标签是向右平移一位的 next-token IDs。

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

配置覆盖模型尺寸、优化器参数、warmup/cosine、evaluation、checkpoint、device 和 dtype。checkpoint 保存 model、optimizer 与 iteration，支持从已有训练状态恢复。日志记录 loss、perplexity、learning rate、已处理 token 数和 elapsed time，便于后续画 learning curve，而不是只留终端截图。

## 8. 生成不是简单的 argmax

[生成模块][generation]支持三种行为：

- `temperature == 0`：greedy decoding；
- `temperature > 0`：对 logits 除以 temperature 后采样；
- 配置 `top_p`：保留累计概率首次达到 $p$ 的最小高概率前缀，再归一化采样。

生成时只把最近 `context_length` 个 token 输入模型，并在遇到可选 EOS 后停止。CLI 可以直接加载训练 checkpoint、vocab 和 merges，从 prompt 生成文本，不需要再写一份一次性脚本。

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

## 10. 验证策略

验证分为四层：

1. **组件 snapshot**：Linear、Embedding、RMSNorm、RoPE、attention、SwiGLU、block 和完整 LM 对齐 reference 权重与输出；
2. **算法边界**：BPE tie-break、special token、chunk boundary、encode/decode、AdamW、schedule、serialization；
3. **本地集成**：小语料训练 tokenizer、写入 `.npy`、mmap 读取、短训练、checkpoint、生成；
4. **远端开发快照**：真实 TinyStories、A100 CUDA smoke、日志和 checkpoint 的命令输出记录。

旧开发树曾记录 `46 passed, 2 skipped`，heap BPE 修改后的定向测试是 `26 passed, 2 skipped`。发布前又从所需文件建立无 monorepo 历史、无内部 task 日志的清理仓库，补充 generation 的 greedy/top-p、EOS、context truncation 和 checkpoint loading 回归测试，并对导出代码重跑完整验证：`51 passed, 2 skipped`；Ruff 同样全部通过。A100 的 `47 passed, 1 xfailed` 属于更早的开发快照，不覆盖当前公开 commit。

这种记录方式刻意区分“历史上通过过”“最后改动后定向通过”和“本次没有运行完成”，避免用一个模糊的绿色结论掩盖验证时间点。

## 11. 如何复现最小流程

安装项目并运行测试：

```bash
uv sync
uv run pytest
uv run ruff check .
```

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

数据、tokenizer artifact、日志和 checkpoint 都在 `.gitignore` 中，避免把大文件误提交到仓库。

## 12. 尚未完成的实验

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
