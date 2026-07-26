---
title: "CS336 Assignment 4：从 Common Crawl 到可训练语料"
description: "完整实现 HTML 提取、语言与质量过滤、PII masking、精确行去重、MinHash+LSH、GPT-2 tokenization，并用真实 WET 样本验证整条数据管线。"
date: 2026-07-26
tags:
  - cs336
  - llm
  - data
  - engineering
lang: zh-CN
featured: true
draft: false
series: stanford-cs336
seriesOrder: 4
---

> 本文对应仓库里的 **Assignment 4: Data**。我不是 Stanford 在校生，也没有把它当作正式课程提交；这是一份独立完成、公开验证的学习记录。代码与文档固定在提交 [`4f2b421`](https://github.com/keepkeen/cs336-coursework/tree/4f2b4219a91c55f6ef47e11e1205b95f64cd834a/assignment4-data)，未运行的全量数据和 GPU 指标会明确标出，不用估算值冒充实验结果。

## 快速入口

- [完整代码仓库][repo]
- [作业说明 Markdown][handout]
- [完整中文实现讲解][explanation]
- [书面问题与样本分析][written-answers]
- [严格完成度审计][audit]

## 结果先行

我最终得到的是一条可以直接执行的数据管线：

```text
Common Crawl WET
  -> English language ID
  -> Gopher + broad-web quality filters
  -> NSFW / toxicity / quality classifiers
  -> PII masking
  -> line-preserving kept JSONL
  -> exact-line deduplication
  -> MinHash + LSH document deduplication
  -> GPT-2 uint16 token bin
  -> data inspection + Markdown/JSON report
  -> model training entrypoint
```

在本地完整示例 WET 上，整条 runner 的关键结果是：

| 阶段 | 结果 |
|---|---:|
| 原始 conversion records | 19,637 |
| 强过滤后保留文档 | 2,690 |
| 输入文本行 | 500,503 |
| 精确去重删除的行 | 290,263 |
| 去重后文档 | 2,682 |
| MinHash 额外删除文档 | 0 |
| GPT-2 tokens | 3,929,317 |
| token 最大值 | 50,256 |

过滤保留率约为 **13.7%**，精确行去重删除了约 **58.0%** 的输入行。这个结果最直观地说明：Common Crawl 的主要问题不只是“坏文档”，还有跨页面重复出现的导航、页脚和模板文本。

## 1. 先把作业拆成可复用的层

测试入口在 [`tests/adapters.py`][adapters]，但真正的实现集中在 [`cs336_data/processing.py`][processing]。这样做不是为了多加一层抽象，而是为了让同一套 HTML 提取、语言识别、PII masking 和去重逻辑既能被作业测试调用，也能被实际 WET pipeline 复用。

主要模块如下：

| 模块 | 职责 |
|---|---|
| [`processing.py`][processing] | HTML、语言、PII、有害内容、质量规则、两类去重 |
| [`filter_wet_data.py`][filter] | 读取 WET，逐级过滤并记录原因和计数 |
| [`deduplicate_filtered_data.py`][dedup] | 精确行去重与 MinHash 文档去重 |
| [`tokenization.py`][tokenization] | 加载 GPT-2 tokenizer，兼容离线环境 |
| [`tokenize_filtered_data.py`][tokenize-script] | 生成带 EOS 的 `np.uint16` token bin |
| [`run_data_pipeline.py`][runner] | 编排 filter -> dedup -> tokenize -> inspect -> report |
| [`training_inspect.py`][inspect] | 在 CPU 上预检 token 范围与训练 batch |
| [`summarize_pipeline_run.py`][report] | 生成可写入报告的 JSON/Markdown 指标 |

## 2. 从网页字节到可过滤文本

### HTML 提取

`extract_text_from_html_bytes` 优先按 UTF-8 解码，失败时让 Resiliparse 检测编码，再用 `extract_plain_text` 提取可见文本。依赖不可用时还有一个很小的 `HTMLParser` fallback，用于本地 sanity check，但大规模过滤仍以 Resiliparse 为准。

真实样本说明“HTML 转文本”并不等于“正文抽取”。第一条 WARC 页面是一篇中文去除百合花粉污渍的问答，WET 比原始 HTML 更易读，却仍包含电话、导航、分类、联系方式和模板重复。后续质量过滤必须继续处理这些 web chrome。

### 语言识别

语言识别优先加载 fastText `lid.176.bin`，返回语言标签和概率。数据管线只保留：

```python
language == "en" and probability >= 0.70
```

在固定随机种子抽取的 20 条本地 WET 记录里，fastText 的 top label 有 8 条是 English，但只有 3 条达到 0.7。这个阈值更偏向 precision：它会减少混入的非英文页面，也会丢掉一些接近边界的有效英文文本。

### PII masking

实现覆盖邮箱、常见美国电话号码和合法 IPv4，替换为稳定占位符，同时返回替换次数。IPv4 的每个 octet 都限制在 `0..255`；电话号码正则还避免把 `4008881886.cn` 之类数字域名误判成电话。

它仍然不是完整的隐私检测器。国际电话号码、Unicode 域名邮箱、姓名和地址不在当前规则范围内，因此文章和审计文档都把它描述为“作业要求的 masking”，而不是通用 PII 解决方案。

## 3. 质量过滤：规则有用，但远远不够

作业要求的 Gopher 子集包括：

- 总词数在 50 到 100,000 之间；
- 平均词长在 3 到 10 之间；
- 以省略号结尾的行不超过 30%；
- 至少 80% 的词包含字母。

这些规则能去掉极短页面和明显异常文本，但对真实 web boilerplate 很弱。最初查看的 25 条 WET 记录中，Gopher 接受了 24 条；赌博推广、商品分类、论坛 UI 和导航密集页面大多都能通过。

因此 pipeline 又加入了可选的 broad-web quality filter，拒绝目录页、空 WordPress 页面、低词汇多样性、重复 n-gram、导航短语、storefront boilerplate 和成人电商关键词。完整示例 WET 的强过滤计数如下：

| 原因 | 删除文档数 |
|---|---:|
| 非英文 | 13,795 |
| Gopher 规则 | 690 |
| broad-web quality | 754 |
| quality classifier | 1,704 |
| NSFW | 2 |
| toxic | 2 |

这里还有一个重要失败案例：Dolma/Jigsaw fastText 模型漏掉了多条明显的中文、日文成人页面，并把一条德国旅游/域名出售页面高分判成 toxic。原因很可能是训练域和语言不匹配。因此正确的工程结论不是“模型存在就安全”，而是：先做语言过滤，再使用校准阈值，并对最终保留/丢弃样本做人工抽查。

## 4. 为什么需要两层去重

### 精确行去重

同一个导航栏或页脚可能出现在成千上万个不同 URL 中。只做文档级去重不会删除这些重复片段。

实现采用两遍扫描：第一遍对原始行 bytes 计算 `blake2b` digest 并计数；第二遍只写出全语料中出现一次的行。二进制逐行处理既保持 exact-line 语义，也避免把所有长文本行作为 Python 字符串 key 常驻内存。

过滤脚本会同时写两种输出：

- `.filtered.txt`：每个文档压成一行，方便直接 tokenization；
- `kept/*.jsonl`：保留文档原始行边界和 URL，用于真正的 line-level dedup 与人工检查。

这一点很容易踩坑：如果对已经 flatten 的 `.filtered.txt` 做“行去重”，实际去掉的是完全相同的文档，而不是重复页脚。

### MinHash + LSH 文档去重

近重复文档先做 NFD Unicode normalization、去 combining marks、小写、去标点和空白规范化，再构造 word n-gram 集合。两个文档的真实相似度使用 Jaccard：

$$
J(A,B)=\frac{|A\cap B|}{|A\cup B|}
$$

直接比较所有文档需要二次复杂度，因此先用多组 seeded hash 构造 MinHash signature，再按 band 放入 LSH bucket 生成候选对。候选仍要计算真实 Jaccard，超过阈值后用 union-find 做传递闭包，每个簇保留第一篇原始文本。

本地示例中 MinHash 没有继续删文档，并不说明实现无效，而是说明前面的 exact-line 阶段已经移除了最明显的重复，且这个单 WET 样本没有达到阈值的剩余近重复簇。

## 5. 让长流水线更难误操作

数据任务常常跑几个小时，最危险的不是抛异常，而是“成功地”把旧 shard 混进新结果。为此我加了几项脚本级保护：

1. filter、dedup 和统一 runner 默认拒绝非空输出目录与已有 summary；只有显式传 `--allow-existing-outputs` 才允许复用。
2. 目录输入只自动扩展 `*.warc.wet.gz`、`*.wet.gz` 和 `*.txt`，不会把 raw WARC 或任意 gzip 当成 WET。
3. tokenization 先写同目录的隐藏临时文件，全部成功后再用原子替换发布最终 `.bin`。
4. 多进程 tokenizer 失败时立即 terminate/join worker pool，不继续等待剩余任务。
5. GPT-2 tokenizer 优先使用 `tiktoken`，离线环境下再回退到本地 transformers cache。

统一 runner 的核心命令是：

```bash
.venv/bin/python scripts/run_data_pipeline.py /shared-data/english-wet-data \
  --work-dir data/pipeline-run \
  --train-bin data/your_data.bin \
  --valid-bin /shared-data/tokenized_paloma_c4_100_domains_validation.bin \
  --workers 8 \
  --tokenize-workers 8 \
  --web-quality-filter \
  --quality-filter \
  --report
```

每次正式实验应使用新的 `--work-dir`。runner 会依次生成 filter/dedup summary、token bin、数据预检结果，以及包含保留率、去重率、token 数和抽样文本的 Markdown/JSON 报告。

## 6. Tokenization 与训练前检查

每篇文档用 GPT-2 tokenizer 编码，并追加 EOS token `50256`。GPT-2 词表可以安全放入 `np.uint16`；训练时再转换成模型需要的 `int64` tensor。

真正启动 GPU 之前，[`training_inspect.py`][inspect] 会检查：

- 文件大小是否符合 `uint16`；
- token 数是否足以构造 context window；
- 扫描范围内的 token ID 是否不超过 `50256`；
- EOS 是否存在；
- NumPy 能否在 CPU 上构造与训练一致的 train/valid batch shape。

本地故意构造过 token ID 为 `60000` 的坏文件，预检会在进入训练前拒绝它。这个检查成本很低，却能避免昂贵的 Modal job 因数据格式问题启动后才失败。

## 7. 验证与测试

核心 adapter 覆盖 HTML、language ID、PII、toxicity、quality、exact-line dedup 和 MinHash。脚本 helper 测试还覆盖：

- broad-web quality 的正反例；
- WET 目录扩展安全性；
- line-preserving JSONL；
- standalone 与 runner 的 stale-output 拒绝；
- token bin 原子替换与 worker 异常清理；
- pipeline 命令链与自动 report；
- 合法/非法训练数据预检。

稳定的全套测试记录为 `37 passed`；最后一轮脚本回归为 `28 passed in 0.38s`。此外，完整本地 example-WET runner 实际执行通过，而不只是 dry run：最终得到 2,682 篇文档和 3,929,317 个 GPT-2 tokens，train/validation 都能构造 `2 x 512` CPU batch。

测试代码可以直接看 [`tests/test_script_helpers.py`][script-tests]，所有命令和历史验证记录在 [completion audit][audit] 中。

## 8. 数据质量上的几个结论

这次实现最有价值的不是某条正则，而是下面几条判断：

1. **WET 不是干净正文。** HTML 消失了，但导航、页脚、联系方式和模板仍然存在。
2. **单一质量规则不能代替抽样。** Gopher、fastText classifier 和关键词规则都有清晰的域外失败模式。
3. **语言置信度是 precision/recall 选择。** `0.7` 适合这份噪声数据的 precision-oriented 起点，但会漏掉有效英文。
4. **重复模板可能比重复文档更严重。** 本地样本中 exact-line 删除率远高于 fuzzy document 删除率。
5. **验证集决定“质量”的含义。** Paloma C4 100 本身是 broad-web 分布，不应把训练集强行收缩成纯 Wikipedia 文风。

## 9. 尚未完成的部分

当前仓库是一份完整的本地实现，但还不能诚实地称为完整课程实验结果。缺少的是：

- 对 2,500 个 English WET 的全量过滤、去重和最终 token 数；
- 使用最终数据进行 8xB200 Modal 训练；
- Paloma C4 100 best validation loss 和 learning curve；
- 基于全量保留/丢弃样本的最后一轮阈值调整。

本机没有 Stanford `/shared-data`、共享 Modal volume 和所需 GPU 配额，本地磁盘也不适合缓存全部 WET。因此这些字段在 [written answers][written-answers] 和 [completion audit][audit] 中保持未完成，而不是填入推测值。

资源到位后，先运行数据预检，再启动训练：

```bash
.venv/bin/python scripts/train.py \
  --inspect-data \
  --train-bin data/your_data.bin \
  --valid-bin /shared-data/tokenized_paloma_c4_100_domains_validation.bin

uv run modal run scripts/train.py --train-bin /root/data/your_data.bin
```

## 结语

语言模型数据工程很容易被压缩成一句“下载、清洗、tokenize”。真正做完一遍后，会发现难点都在边界：模型在哪些语言上失效，规则怎样误杀，重复到底发生在文档还是模板层，长任务如何避免旧输出污染，以及怎样证明 token bin 真的能进入训练。

这份 Assignment 4 的价值也在这里：它不是训练一个更大的模型，而是逼着我们把“数据质量”从直觉写成代码、计数、样本和可复现的失败证据。

[repo]: https://github.com/keepkeen/cs336-coursework/tree/4f2b4219a91c55f6ef47e11e1205b95f64cd834a/assignment4-data
[handout]: https://github.com/keepkeen/cs336-coursework/blob/4f2b4219a91c55f6ef47e11e1205b95f64cd834a/assignment4-data/cs336_assignment4_data.md
[processing]: https://github.com/keepkeen/cs336-coursework/blob/4f2b4219a91c55f6ef47e11e1205b95f64cd834a/assignment4-data/cs336_data/processing.py
[adapters]: https://github.com/keepkeen/cs336-coursework/blob/4f2b4219a91c55f6ef47e11e1205b95f64cd834a/assignment4-data/tests/adapters.py
[filter]: https://github.com/keepkeen/cs336-coursework/blob/4f2b4219a91c55f6ef47e11e1205b95f64cd834a/assignment4-data/scripts/filter_wet_data.py
[dedup]: https://github.com/keepkeen/cs336-coursework/blob/4f2b4219a91c55f6ef47e11e1205b95f64cd834a/assignment4-data/scripts/deduplicate_filtered_data.py
[tokenization]: https://github.com/keepkeen/cs336-coursework/blob/4f2b4219a91c55f6ef47e11e1205b95f64cd834a/assignment4-data/cs336_data/tokenization.py
[tokenize-script]: https://github.com/keepkeen/cs336-coursework/blob/4f2b4219a91c55f6ef47e11e1205b95f64cd834a/assignment4-data/scripts/tokenize_filtered_data.py
[runner]: https://github.com/keepkeen/cs336-coursework/blob/4f2b4219a91c55f6ef47e11e1205b95f64cd834a/assignment4-data/scripts/run_data_pipeline.py
[inspect]: https://github.com/keepkeen/cs336-coursework/blob/4f2b4219a91c55f6ef47e11e1205b95f64cd834a/assignment4-data/cs336_data/training_inspect.py
[report]: https://github.com/keepkeen/cs336-coursework/blob/4f2b4219a91c55f6ef47e11e1205b95f64cd834a/assignment4-data/scripts/summarize_pipeline_run.py
[script-tests]: https://github.com/keepkeen/cs336-coursework/blob/4f2b4219a91c55f6ef47e11e1205b95f64cd834a/assignment4-data/tests/test_script_helpers.py
[explanation]: https://github.com/keepkeen/cs336-coursework/blob/4f2b4219a91c55f6ef47e11e1205b95f64cd834a/assignment4-data/tasks/solution_explanation.md
[written-answers]: https://github.com/keepkeen/cs336-coursework/blob/4f2b4219a91c55f6ef47e11e1205b95f64cd834a/assignment4-data/tasks/written_answers.md
[audit]: https://github.com/keepkeen/cs336-coursework/blob/4f2b4219a91c55f6ef47e11e1205b95f64cd834a/assignment4-data/tasks/completion_audit.md
