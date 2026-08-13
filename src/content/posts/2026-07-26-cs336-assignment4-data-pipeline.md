---
title: "CS336 Assignment 4：从 Common Crawl 到可训练语料"
description: "从 WARC/WET 数据结构开始，逐步实现 HTML 提取、语言与质量过滤、PII masking、两级去重、GPT-2 tokenization、训练前检查与可复现实验报告。"
date: 2026-07-26
updatedDate: 2026-08-14
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

> 本文对应 **Stanford CS336 Assignment 4: Data**。我不是 Stanford 在校生，也没有把它作为正式课程作业提交；这是一次独立实现和复现实验。公开代码经过敏感信息清理，使用全新的单提交历史，并固定在 [`e7cced8`][repo]。文中会严格区分“已经实现”“在本地样本上实测”和“仍需 2,500 WET / 8xB200 才能完成”的内容。

## 快速入口

- [公开代码仓库][repo]
- [原始作业说明][handout]
- [逐文件实现说明][explanation]
- [完成度与验证审计][audit]
- [核心数据处理实现][processing]
- [端到端 pipeline runner][runner]

## 先说明：这份作业到底在优化什么

Assignment 4 不是让我们修改模型结构，也不是比较 optimizer。作业固定了 GPT-2 small-shaped 模型、训练过程和 Paloma C4 100 domains 验证集，唯一主要变量是 **训练数据**：从 Common Crawl 中保留什么、删除什么、如何去重，以及最终如何序列化。

目标可以写成：

$$
\text{在固定模型与训练预算下，构造数据集 }D_{train}\text{，使验证损失 }L(D_{train}, D_{Paloma})\text{ 尽可能低。}
$$

这意味着“高质量”不能只理解为百科全书文风。Paloma C4 100 本身包含博客、新闻、产品说明、活动页和其他 broad-web 文本；把训练集过滤成纯 Wikipedia，语言可能更整洁，却可能造成验证分布失配。真正的问题是：怎样保留有信息量的 broad-web prose，同时减少非英文文本、网页模板、低质量目录、重复内容、有害内容和 PII。

作业要求可以分成四组：

| 部分 | 要实现或回答的内容 | 本项目状态 |
|---|---|---|
| Filtering primitives | HTML 提取、语言识别、PII、有害内容、Gopher 规则、质量分类器 | 已实现并测试 |
| Deduplication | exact-line dedup、MinHash + LSH 文档去重 | 已实现并测试 |
| Dataset build | 并行过滤 WET、记录各过滤器计数、抽样检查、tokenize | 已实现；在一个完整示例 WET 上实跑 |
| Model experiment | 2,500 WET 全量数据、8xB200 训练、Paloma best loss 与曲线 | 尚未运行 |

这张表是理解后文的边界：代码路径完整，不代表课程要求的最终大规模实验已经完成。

## 1. 从 WARC、WAT 和 WET 说起

Common Crawl 不是一个“每行一篇文章”的文本目录。它主要提供三类文件：

| 格式 | 包含内容 | 适合做什么 |
|---|---|---|
| WARC | HTTP response、原始 HTML、headers 等抓取内容 | 重新做 HTML 解析、研究网页结构 |
| WAT | 从 WARC 提取的 metadata、链接等结构化信息 | 链接图、抓取元数据分析 |
| WET | HTML 转换后的 plain-text `conversion` records | 大规模语言模型语料过滤 |

WET 更接近模型训练需要的文本，但它不是“正文抽取结果”。一个 WET record 大致仍是：

```text
WARC metadata
WARC-Target-URI: https://example.com/page
WARC-Type: conversion

站点标题
导航菜单
文章正文
联系方式
页脚与版权信息
```

HTML tags 消失了，导航、页脚、商品分类和模板文本仍然存在。这解释了为什么后面既需要文档过滤，也需要 line-level deduplication。

[`filter_wet_data.py`][filter] 使用 `warcio.ArchiveIterator` 读取压缩 WET，只处理 `record.rec_type == "conversion"`，并保留 `WARC-Target-URI`。URL 不送进 tokenizer，但会写入审计 JSONL，方便定位误杀和漏网样本。

为了防止目录中混入 raw WARC，输入目录只自动展开：

```text
*.warc.wet.gz
*.wet.gz
*.txt
```

显式传入单个文件仍然允许非标准扩展；目录模式则采用更保守的白名单。

### 1.1 数据下载阶段做了什么

课程环境已经在 `/shared-data/english-wet-data` 提供 English-filtered WET；非课程环境则需要从 Common Crawl file list 抽样 raw WET，再逐 record 做语言识别。[`cs336_data/wet_files.py`][wet-files] 中的 `is_english` 使用同一个条件：

```python
language, probability = identify_language(text)
return language == "en" and probability >= 0.70
```

[`scripts/download_data.py`][download] 保留课程默认的 2,500 files，也增加了小规模复现参数：

- `--n-files`：抽多少个 raw WET，默认 2,500；
- `--group-size`：多少个源 WET 合并成一个 English chunk，默认 4；
- `--skip-wiki`：只验证 WET 下载/语言过滤时跳过 Wikipedia reference data；
- `--keep-tmp-wet-downloads`：默认清理本轮 `/tmp` 中间 WET，调试时才保留。

本地 smoke 可以从 4 个文件开始：

```bash
uv run scripts/download_data.py --n-files 4 --group-size 4 --skip-wiki
```

下载阶段和后面的 filter 阶段都做 language ID 看似重复，但适用输入不同：前者把 raw Common Crawl 缩成 English candidates，后者仍用显式阈值保护任意输入目录，并记录统一漏斗指标。课程提供的 English WET 可以跳过第一段下载计算，但不能因此假设里面完全没有低置信度或混合语言内容。

## 2. 代码结构：primitive、pipeline 和 evidence 分开

我把实现分成三层，而不是把所有逻辑塞进一个脚本：

```text
tests/adapters.py
      |
      v
cs336_data/processing.py        <- 可测试的纯处理 primitive
      |
      v
scripts/filter_wet_data.py      <- WET I/O、并行执行、计数与审计输出
scripts/deduplicate_*.py        <- 跨文档去重
scripts/tokenize_*.py           <- GPT-2 token bin
      |
      v
scripts/run_data_pipeline.py    <- 编排、路径约定、失败传播
      |
      v
filter_summary.json / dedup_summary.json / pipeline_report.md
```

这样拆分有两个实际好处：

1. 作业测试通过 [`tests/adapters.py`][adapters] 调用同一套核心函数，脚本不会维护第二份实现。
2. 每层都有明确的数据契约，出错时可以判断是分类逻辑、WET 读取、去重，还是 token serialization 的问题。

主要文件及职责如下：

| 文件 | 关键职责 |
|---|---|
| [`cs336_data/processing.py`][processing] | HTML、language ID、PII、分类器、Gopher、两类去重 |
| [`cs336_data/wet_files.py`][wet-files] | 下载阶段的 English WET 判定 |
| [`scripts/filter_wet_data.py`][filter] | 并行过滤、逐步计数、kept/discarded 输出 |
| [`scripts/train_quality_classifier.py`][quality-trainer] | 训练 `wiki` vs `cc` fastText classifier |
| [`scripts/deduplicate_filtered_data.py`][dedup] | 保持文档边界的行去重与 fuzzy dedup |
| [`cs336_data/tokenization.py`][tokenization] | 离线可用的 GPT-2 tokenizer loader |
| [`scripts/tokenize_filtered_data.py`][tokenize-script] | 流式写 `np.uint16` token IDs |
| [`cs336_data/training_inspect.py`][inspect] | 在 CPU 上检查 token bin 和 batch |
| [`scripts/summarize_pipeline_run.py`][report] | 汇总指标并抽取可审计样本 |
| [`scripts/run_data_pipeline.py`][runner] | 串起 filter -> dedup -> tokenize -> inspect -> report |

## 3. 生产模型与本地 fallback 必须显式区分

HTML、语言、有害内容和质量判断都可能依赖外部模型。为了让单元测试和离线开发可运行，代码提供 deterministic heuristic fallback；但 fallback 只用于 sanity check，不能静默冒充正式数据生产。

[`get_processing_backend_status`][processing] 会把每个 backend 写入 `filter_summary.json`：

```json
{
  "processing_backends": {
    "html": "resiliparse",
    "language": "fasttext",
    "nsfw": "fasttext",
    "toxicity": "fasttext",
    "quality": "heuristic"
  }
}
```

正式构建时应加 `--require-models`。缺少 language、NSFW、toxicity 或启用 `--quality-filter` 时缺少 quality model，程序会在读取第一个 WET 前失败：

```bash
uv run scripts/filter_wet_data.py /shared-data/english-wet-data \
  --output-dir data/filtered \
  --summary-json data/filter_summary.json \
  --quality-filter \
  --require-models
```

这一点也修正了本地实验的解释边界：我下载并使用过真实的 language/NSFW/toxicity fastText 模型，但没有得到正式训练完成的 `quality.bin`。因此后文强过滤实验中的 `rejected_quality` 来自确定性 quality heuristic，只能证明 pipeline 和计数路径，不代表训练后质量分类器的最终效果。

## 4. HTML bytes 如何变成可过滤文本

### 4.1 编码识别

[`extract_text_from_html_bytes`][processing] 的输入是原始 `bytes`，不能假设所有网页都是 UTF-8。解码顺序是：

1. 先严格尝试 UTF-8；大多数现代网页走最快路径。
2. 失败时调用 Resiliparse `detect_encoding`。
3. 编码检测也失败时，用 UTF-8 `errors="replace"` 保证流程可继续并留下替换字符。

### 4.2 可见文本提取

生产路径调用 Resiliparse `extract_plain_text`。在缺少依赖的测试环境中，小型 `HTMLParser` fallback 会：

- 忽略 `head`、`script`、`style`、`noscript`；
- 保留 heading、paragraph 和 list item；
- 为块元素恢复换行；
- 把 HTML entities 转回字符。

这个 fallback 不是通用正文抽取器。它的目的只是让依赖不可用时行为可解释；大规模数据仍应使用 Resiliparse。

### 4.3 为什么 HTML 提取之后还不够

对本地第一条 WARC/WET 对照样本，Resiliparse 输出约 1,694 个字符，对应 WET 为约 1,599 个字符。两者都保留了主要问答，也都保留了站点导航和联系方式。WET 更紧凑，但没有自动识别“文章正文”。

所以这里的输出契约只是：

```text
HTML bytes -> 尽可能忠实的可见文本
```

而不是：

```text
HTML bytes -> 已经适合训练的高质量正文
```

## 5. 语言识别：标签和置信度是两个条件

语言模型使用 fastText `lid.176.bin`。预测前先把 HTML entity、换行和重复空白规范化，再取 top-1 label 和 score：

```python
language, score = identify_language(text)
keep = language == "en" and score >= 0.70
```

`__label__en` 被规范化为 `en`，`zh-cn`、`zh-hans`、`zh-hant` 统一为 `zh`。模型通过 `@cache` 只在进程内加载一次；多进程过滤时，每个 worker 各自持有模型，避免每篇文档重复加载。

### 5.1 为什么不能只看 top label

在固定种子抽取的 20 条本地 WET 记录中：

- 8 条 top label 是 English；
- 只有 3 条 English probability 达到 0.70；
- 有效英文页面也可能落在阈值附近或更低；
- 一个极短目录页也能得到 English top label，只是置信度很低。

因此 `0.70` 是 precision-oriented 选择：减少非英文混入，同时接受部分有效英文被丢弃。阈值不是语言真理，而是数据集目标下的 precision/recall trade-off。

### 5.2 过滤顺序的意义

language ID 放在 harmful-content classifier 前面。原因不只是省计算：本地的 Jigsaw/Dolma classifier 对中文、日文成人页出现明显 false negative，把非目标语言先移除能减少这些域外错误进入后续流程。

## 6. PII masking：先限定能力，再谈安全

作业要求处理邮箱、电话号码和 IP。实现提供三个独立函数，并由 `mask_pii` 依次调用：

```python
text, emails = mask_emails(text)
text, phones = mask_phone_numbers(text)
text, ips = mask_ips(text)
```

替换结果使用稳定占位符：

```text
|||EMAIL_ADDRESS|||
|||PHONE_NUMBER|||
|||IP_ADDRESS|||
```

每个函数返回 `(masked_text, count)`，所以 summary 不只知道“某篇文档有 PII”，还知道实际替换了多少处。

### 6.1 邮箱

邮箱正则覆盖常见 ASCII local-part 和合法域名结构，并通过左右边界避免从更长 token 中截取一段。它不会覆盖 Unicode 域名和所有 RFC 边界情况。

### 6.2 电话号码

电话号码覆盖常见美国 10 位格式和可选国家码 `+1`，area code 首位限制为 `2..9`。负向边界避免把长数字串的一部分识别成电话；后缀检查还避免把数字域名误判成电话号码。

### 6.3 IPv4

IPv4 不是简单的 `\d{1,3}` 四连。每个 octet 都限制在 `0..255`，因此 `999.999.999.999` 不会被当成合法 IP。

### 6.4 为什么是 masking，不是 drop

直接删除整篇文档可能浪费大量有用正文；替换具体值可以保留句法上下文。但 masking 也有代价：

- 模型可能学会频繁生成占位符；
- 技术文档中的示例 IP/邮箱可能被误改；
- 国际电话、姓名、住址和混淆写法仍会漏掉。

所以本文把它称为“作业范围内的 PII masking”，不把它宣传成完整隐私防护系统。

## 7. 有害内容分类：模型存在不等于模型适用

NSFW 和 toxicity 都使用 fastText 二分类器。不同模型的 label 命名可能是 `1/0`、`nsfw/non-nsfw` 或其他变体，因此代码先把 label 统一映射到：

```text
nsfw / non-nsfw
toxic / non-toxic
```

只有正类且 score 超过阈值时才拒绝：

```python
if nsfw_label == "nsfw" and nsfw_score >= nsfw_threshold:
    reject("nsfw")
```

默认 NSFW 和 toxic threshold 都是 `0.50`。

人工审计暴露了两个重要失败模式：

1. 多条明显中文/日文成人页被判为 `non-nsfw`。
2. 一条普通德语旅游/域名页面被高分判为 toxic。

这符合训练域不匹配的预期：Jigsaw 风格评论分类器不等于 multilingual broad-web safety classifier。工程上应该记录 label 分布和 score、抽查 false positive/negative，并在正式数据上考虑语言感知模型、URL/category 信号和阈值校准，而不能把一个二分类模型当作最终安全边界。

## 8. Gopher 规则：便宜的第一层质量门槛

[`gopher_quality_filter`][processing] 实现作业指定的规则子集。设 tokenized words 为 $w_1,\ldots,w_N$：

### 8.1 文档长度

$$
50 \le N \le 100{,}000
$$

太短的页面通常只有加载提示、目录标题或错误信息；极长页面可能是日志、拼接内容或抓取异常。

### 8.2 平均词长

$$
3 \le \frac{1}{N}\sum_{i=1}^{N}|w_i| \le 10
$$

它能排除大量单字符 token 或异常超长字符串，但不是语义质量判断。

### 8.3 省略号行比例

$$
\frac{\#\{\text{lines ending in }...\}}{\#\{\text{lines}\}} \le 0.30
$$

### 8.4 含字母词比例

$$
\frac{\#\{w_i:\exists c\in w_i,\ c\text{ is alphabetic}\}}{N} \ge 0.80
$$

数字 token 会进入分母，但不会进入 alphabetic numerator，这可以拒绝数字或符号占比异常的页面。

### 8.5 真实样本为何说明它不够

前 25 条 WET 中 Gopher 接受了 24 条，只拒绝一个单词的 loading page。随机 20 条中它接受了 19 条，只拒绝一个极短目录页。赌博推广、商品分类、论坛 UI 和导航密集页面往往都有足够词数、正常平均词长和大量字母，因此轻松通过。

结论不是 Gopher 无用，而是它适合做便宜的粗筛，不能代替 web-specific quality filter 和人工抽样。

## 9. 质量判断分成两条路径

### 9.1 可训练的 `wiki` vs `cc` classifier

[`train_quality_classifier.py`][quality-trainer] 接受正例和负例：

- 正例标为 `__label__wiki`，代表参考性、较高质量文本；
- 负例标为 `__label__cc`，代表普通或低质量 Common Crawl 文本。

预处理会规范化空白、应用最小词数，可选先过 Gopher，然后随机打乱样本。默认 fastText 配置是 5 epochs、learning rate 0.5、100 维 embedding、word bigrams 和 softmax loss。

```bash
uv run scripts/train_quality_classifier.py \
  --positive data/wiki_reference_text \
  --negative data/cc_negative_text \
  --output-model local-shared-data/classifiers/quality.bin \
  --apply-gopher \
  --epoch 5 \
  --word-ngrams 2
```

这里的 train-set precision/recall 只能检查训练流程是否工作，不能代替 held-out evaluation。正式迭代至少还需要：

1. 独立验证集；
2. 类别平衡和 domain 分布检查；
3. 阈值 sweep；
4. 最终 Paloma validation loss 对比。

### 9.2 broad-web 规则

因为本地样本暴露了明显模板噪声，我另外实现了可选 `--web-quality-filter`。它不是作业 primitive 的替代品，而是对实际 WET 的工程补充：

| reason | 判断逻辑 |
|---|---|
| `directory_listing` | 同时出现 `index of /` 和 `parent directory` |
| `empty_wordpress_page` | WordPress “找不到内容”模板 |
| `storefront_boilerplate` | 固定 cookie-disabled 商店提示 |
| `adult_retail_keywords` | 多个成人零售类别词同时出现 |
| `navigation_phrases` | `toggle navigation` 等短语重复过多 |
| `too_short_after_normalization` | 规范化后少于 80 words |
| `low_word_diversity` | 至少 160 words 且 unique-word ratio 小于 0.24 |
| `repetitive_ngrams` | 最常见 trigram 至少 5 次且占比至少 2% |
| `navigation_heavy` | 导航词占比大于 22%，同时 unique ratio 小于 0.45 |

这些阈值来自本地失败样本的可解释迭代，不是普适常数。每次拒绝都会写入 `web_quality_reason_*` counter，后续可以看到究竟是哪条规则主导数据量变化。

## 10. 过滤漏斗：顺序、短路和计数口径

单篇文档按以下顺序处理：

```text
language ID
  -> Gopher
  -> optional broad-web quality
  -> NSFW
  -> toxicity
  -> quality classifier / heuristic
  -> PII masking
  -> keep
```

这个顺序有三个考虑：

1. 先运行便宜、召回范围大的过滤器，减少后面分类器调用。
2. 先去掉非英文，降低英文 harmful classifier 的域外输入。
3. PII 放在最后，只对最终保留文档做替换，避免在注定丢弃的文本上消耗工作。

过滤是 **短路漏斗**。例如 `rejected_quality=1704` 的分母不是全部 19,637 篇，而是通过前面所有过滤器、真正到达 quality step 的文档。因此各 rejection count 可以相加得到总拒绝数，但不能把每一项都当成独立模型在全语料上的命中率。

核心逻辑相当于：

```python
for document in wet_file:
    if not high_confidence_english(document):
        reject("language")
    elif not gopher_quality_filter(document):
        reject("gopher")
    elif use_web_rules and not web_quality_filter(document):
        reject("web_quality:<reason>")
    elif is_nsfw(document):
        reject("nsfw")
    elif is_toxic(document):
        reject("toxic")
    elif use_quality and not is_high_quality(document):
        reject("quality")
    else:
        write(mask_pii(document))
```

每个 WET 文件作为一个 `ProcessPoolExecutor` job。worker 返回 `Counter`，主进程通过 `as_completed` 汇总；任何 worker exception 会在 `future.result()` 处传播，不会被当成空结果继续。

## 11. 为什么同一批保留文档要写两种格式

过滤脚本可以同时输出：

```text
filtered/*.filtered.txt
kept/*.kept.jsonl
discarded/*.discarded.jsonl
filter_summary.json
```

### 11.1 flattened text

`.filtered.txt` 每篇文档压成一行：

```text
document 1 without internal newlines
document 2 without internal newlines
```

它适合直接按行 tokenization，但已经丢失原始行边界。

### 11.2 line-preserving kept JSONL

`kept/*.jsonl` 每行是一个对象，`text` 字段内部仍保留换行：

```json
{"url":"https://example.com/a","text":"Header\nArticle line 1\nFooter"}
```

这才是 exact-line dedup 的正确输入。若把 flattened `.filtered.txt` 交给“行去重”，每一行其实是一整篇文档，算法会退化成 exact-document dedup，无法删除跨页面重复页脚。

### 11.3 discarded JSONL

丢弃记录保存 URL、reason 和长度受限的 excerpt，用于回答：

- 哪个 filter 删除了它？
- 删除是否合理？
- 是否需要改阈值？

训练数据和审计数据因此分离：tokenizer 不需要 URL，分析脚本却需要 URL 和 reason。

## 12. Exact-line dedup：删除模板，而不只是重复文档

### 12.1 算法

对全语料做两遍扫描：

```text
Pass 1:
  for each line in each document:
      count[blake2b(line)] += 1

Pass 2:
  for each line in each document:
      if count[blake2b(line)] == 1:
          keep line
```

注意语义是“只保留全语料中出现一次的行”，而不是“重复行保留第一份”。如果同一 footer 出现 5,000 次，5,000 份都会被删除。

代码里有两个共享同一语义的入口：作业 adapter 调用 `processing.exact_line_deduplication`，以 binary line 为单位扫描多个文件，并在输出目录保留原文件名；端到端数据脚本则调用 `_exact_line_deduplicate_documents`，在 JSONL 文档内部删除重复行，同时保留 URL 和文档边界。前者满足 primitive 接口，后者解决真实 pipeline 的 metadata 需求。

### 12.2 为什么保存 digest 而不是完整行

若以完整字符串作为 `Counter` key，key 内存随行长度增长。实现使用 16-byte BLAKE2b digest，让每个 key 固定大小。理论上仍有 hash collision，但 128-bit digest 对此规模的教学语料风险极低；若场景要求绝对无碰撞语义，需要在命中 digest 后再核对原始 bytes。

### 12.3 文档重写

去重后把剩余行按原顺序拼回文档。如果剩余 normalized words 少于 `--min-words-after-line-dedup`，整篇删除。这样不会留下只剩标题或一个列表项的空壳文档。

### 12.4 复杂度

设总行数为 $L$：

- 时间复杂度约为 $O(L)$，两遍扫描只改变常数；
- 计数表空间约为 $O(U)$，$U$ 是 unique line digests 数；
- 文档级脚本当前会把已过滤文档读入内存，适合本作业 pipeline，但超大规模生产实现应进一步 shard 或外排计数。

## 13. MinHash + LSH：从二次比较降到候选比较

Exact-line 处理不了“只有年份、作者名或少量句子不同”的模板文档，因此还需要 fuzzy document dedup。

### 13.1 文本规范化

在比较前执行：

1. Unicode NFD normalization；
2. 删除 `Mn` combining marks；
3. lowercase；
4. 标点替换为空格；
5. 合并空白；
6. 构造 word 5-gram set。

例如带 accent、大小写或标点差异的文本会更接近，但输出仍保留原始文本，规范化版本只用于相似度计算。

### 13.2 Jaccard similarity

设两篇文档的 n-gram 集合为 $A$ 和 $B$：

$$
J(A,B)=\frac{|A\cap B|}{|A\cup B|}
$$

直接计算所有 pair 需要 $O(N^2)$ 次比较，对 Common Crawl 不现实。

### 13.3 MinHash signature

对每个 seed 定义一个稳定 hash $h_i$，signature 第 $i$ 维是：

$$
m_i(A)=\min_{x\in A}h_i(x)
$$

两个集合在某一维取得相同 MinHash 的概率等于它们的 Jaccard similarity。因此用 $k$ 维 signature 中相同位置的比例，可以估计 Jaccard。

实现默认 $k=100$，优先使用 `mmh3.hash64`；依赖不可用时用包含 seed 的 BLAKE2b。seed 固定为 `0..99`，所以结果可复现。

### 13.4 LSH banding

100 维 signature 分成 20 bands，每 band 5 rows。只有某个 band 完全相同的文档才进入同一 bucket，成为 candidate pair。

若真实相似度为 $s$，至少一个 band 匹配的概率近似：

$$
P(\text{candidate})=1-(1-s^r)^b
$$

其中 $r=5, b=20$。几个直观值：

| $s$ | 成为 candidate 的近似概率 |
|---:|---:|
| 0.3 | 约 4.7% |
| 0.5 | 约 47.0% |
| 0.8 | 约 99.96% |

增加 bands 会提高 recall、降低 candidate precision；增加每 band rows 会反过来。

### 13.5 LSH 只生成候选，不直接删除

bucket collision 可能产生 false positive，所以实现对 candidate pair 再计算 **真实 5-gram Jaccard**，只有 $J\ge0.80$ 才连边。

随后使用 union-find 做传递闭包：若 A 与 B 重复、B 与 C 重复，即使 A 与 C 没进入同一 bucket，三者仍属于一个 connected component。每个 component 确定性保留输入顺序最靠前的文档，便于复现。

### 13.6 本地为什么删除了 0 篇

完整示例 WET 在 exact-line 之后，MinHash 没有额外删除文档。这不是 MinHash 单元测试失效：exact 和 fuzzy duplicate fixture 都通过。它说明在这一份 WET、当前 5-gram / 0.80 阈值下，最显著的重复来自共享行模板，而非达到阈值的剩余整篇近重复。

## 14. Tokenization：格式兼容比“能 encode”更重要

作业训练脚本要求连续的 GPT-2 token IDs，存为原始 `np.uint16` binary。每篇文档执行：

```python
token_ids = tokenizer.encode(document) + [50256]
```

`50256` 是 GPT-2 `<|endoftext|>` / EOS。若不追加 EOS，相邻网页在训练流中会直接粘在一起，模型看不到文档边界。

### 14.1 为什么 `uint16` 足够

`uint16` 范围是 `0..65535`，GPT-2 最大 token ID 是 `50256`，因此不会溢出。训练取 batch 时再转成模型需要的 `int64`。

### 14.2 tokenizer backend

[`load_gpt2_tokenizer`][tokenization] 优先使用 `tiktoken.get_encoding("gpt2")`；如果不可用，再从本地 transformers cache 加载 GPT-2。两者都必须产生 GPT-2 IDs，不能随意换 tokenizer，因为验证 bin 和模型 vocabulary 已固定。

### 14.3 流式写出

脚本不会把所有 token 放进一个 Python list。每篇文档 tokenized 后立即：

```python
array = np.asarray(token_ids, dtype=np.uint16)
array.tofile(output_stream)
```

内存主要受单篇文档和 worker queue 影响，而不是总语料 token 数。

### 14.4 原子发布

最终文件不会被边算边暴露：

```text
.your_data.bin.tmp  <- 正在写
your_data.bin       <- 仅全部成功后 os.replace
```

若 worker 抛异常，多进程 pool 会 `terminate()` / `join()`，临时文件被删除，旧的有效 train bin 不会被半成品覆盖。

## 15. GPU 之前先在 CPU 上证明数据可读

8xB200 job 启动后才发现 bin 损坏，代价很高。[`training_inspect.py`][inspect] 使用 NumPy/memmap 做预检：

1. 文件 byte size 是否能被 2 整除；
2. token 数是否大于 context length；
3. 扫描 token 的 min/max 是否在 GPT-2 范围；
4. EOS 是否存在并计数；
5. 能否构造 train/valid 的 shifted batch。

batch 关系是：

```text
x = tokens[i     : i + context_length]
y = tokens[i + 1 : i + context_length + 1]
```

默认随机种子固定为 0，输出 shape 和 dtype 可复现。本地负向测试构造 token ID `60000`，预检会在进入 PyTorch/Modal 前明确拒绝。

```bash
uv run scripts/train.py \
  --inspect-data \
  --train-bin data/your_data.bin \
  --valid-bin local-shared-data/tokenized_paloma_c4_100_domains_validation.bin \
  --inspect-batch-size 2 \
  --inspect-context-length 512
```

## 16. 统一 runner 如何组织一次实验

手动执行五个脚本很容易把不同实验的 shard 混在一起，因此 [`run_data_pipeline.py`][runner] 固定产物布局：

```text
data/pipeline-run/
├── filtered/
├── kept/
├── discarded/
├── deduped/
├── filter_summary.json
├── dedup_summary.json
├── pipeline_report.json
├── pipeline_report.md
└── your_data.bin
```

完整命令：

```bash
uv run scripts/run_data_pipeline.py /shared-data/english-wet-data \
  --work-dir data/pipeline-run \
  --train-bin data/pipeline-run/your_data.bin \
  --valid-bin /shared-data/tokenized_paloma_c4_100_domains_validation.bin \
  --workers 8 \
  --tokenize-workers 8 \
  --web-quality-filter \
  --quality-filter \
  --report
```

执行顺序是：

```text
filter WET
  -> deduplicate kept JSONL
  -> tokenize deduped shards
  -> train.py --inspect-data
  -> summarize pipeline run
```

`--dry-run` 会打印完整子命令但不执行，适合检查路径和 flags。

固定在本文公开 commit 的 runner 还没有透传 standalone filter 的 `--require-models`。因此正式运行前应先用 `get_processing_backend_status()` 检查资源，或先独立执行带 `--require-models` 的 filter 命令；不能只看到 runner 成功退出，就假设所有 classifier 都是 production backend。summary 中的 `processing_backends` 是最终证据。

### 16.1 stale-output 防护

filter、dedup 和 runner 默认拒绝：

- 非空输出目录；
- 已存在的 summary/report；
- 已存在的 train bin；
- tokenization 临时 bin。

长任务最隐蔽的错误之一，是把本轮 900 个新 shards 与上轮残留的 1,600 个 shards 混成“成功的 2,500 文件结果”。默认拒绝旧输出把这种 silent contamination 变成显式失败。

只有明确恢复或复用时才传 `--allow-existing-outputs`。它不是推荐的普通运行方式；正式对比实验最好使用新的 `--work-dir`。

### 16.2 报告不是日志截图

[`summarize_pipeline_run.py`][report] 读取两个 summary、token bin 和 kept/discarded/deduped shards，生成结构化 JSON 与 Markdown，包括：

- 文档总数、保留率、各 rejection count/rate；
- exact-line 删除率和 fuzzy 删除文档数；
- token 数、扫描范围、EOS 数、最大 token ID；
- 固定 seed 抽取的保留与丢弃样本。

因此一次实验不仅有最终 `.bin`，还有足够证据解释这个 `.bin` 是怎样产生的。

## 17. 本地实验：从弱过滤到强过滤

本地资源是一份约 60 MB 的完整示例 WET，共 19,637 个 conversion records。它不是课程要求的 2,500 WET，只用于验证流程、观察失败模式和估计数量级。

### 17.1 Baseline 过滤

baseline 使用真实 language/NSFW/toxicity fastText 模型、Gopher 和 PII masking，不启用额外 broad-web / quality filter：

| counter | 数值 | 占全部输入 |
|---|---:|---:|
| `documents_total` | 19,637 | 100% |
| `rejected_language` | 13,795 | 70.3% |
| `rejected_gopher` | 690 | 3.5% |
| `rejected_nsfw` | 4 | 0.02% |
| `rejected_toxic` | 4 | 0.02% |
| `documents_kept` | 5,144 | 26.2% |

PII stage 共替换 2,240 个 email、3,229 个 phone、111 个 IPv4。baseline filtering 用单 worker 耗时 30.121 秒，输出约 32 MB 文本。

这些比例的正确读法仍是漏斗计数：例如 Gopher 的 690 是通过 language 后再被删除的文档，而不是 Gopher 独立扫描全部输入后的总失败数。

### 17.2 人工抽样发现的问题

baseline 固定 seed 的 5 个保留样本包括：

| 样本类型 | 判断 |
|---|---|
| 航空公司航线新闻 | 正文有用，但有大量重复导航 |
| 瑜伽学校页面 | 有领域内容，但联系方式和导航偏多 |
| 工业产品 SEO 页 | 商业模板、多语言导航，训练价值较弱 |
| 酒吧活动页 | 短 WordPress/search boilerplate，应进一步过滤 |
| 本地装修服务页 | 重复 SEO 文案明显，质量较低 |

这一步直接推动了 `--web-quality-filter`，而不是先凭直觉堆规则。

### 17.3 Strong 过滤

启用 broad-web filter 和 `--quality-filter` 后：

| counter | 数值 |
|---|---:|
| `documents_total` | 19,637 |
| `rejected_language` | 13,795 |
| `rejected_gopher` | 690 |
| `rejected_web_quality` | 754 |
| `rejected_nsfw` | 2 |
| `rejected_toxic` | 2 |
| `rejected_quality` | 1,704 |
| `documents_kept` | 2,690 |

web-quality 的 754 个拒绝进一步分解为：

| reason | 数值 |
|---|---:|
| repetitive n-grams | 430 |
| low word diversity | 186 |
| too short after normalization | 94 |
| repeated navigation phrases | 24 |
| storefront boilerplate | 11 |
| empty WordPress page | 7 |
| adult retail keywords | 2 |

保留率从 26.2% 降到 13.7%。但必须再次强调：这次 local `quality` backend 是 heuristic，不是训练好的 fastText `quality.bin`，所以 `1,704` 不能作为正式 classifier 指标。

strong run 抽到的保留样本包括自然个人博客、固定收益基金说明、长篇宗教文本、工业自动化服务页和 niche SEO 文章。质量总体改善，但商业导航、分布偏重和抽取 artifact 仍存在。说明规则增强后仍必须抽样，不能只看保留率下降。

丢弃样本则包括非英文政策问答、商业模板、成人视频索引、土耳其语组织页面和俄语产品页。对 English-only 目标而言 language rejection 基本合理，但其中也包含语言正确、内容本身有价值的页面，这正是 precision-oriented 策略的代价。

### 17.4 两级去重结果

对 2,690 篇 strong-kept JSONL：

| 阶段 | 结果 |
|---|---:|
| 输入行 | 500,503 |
| exact-line 删除行 | 290,263 |
| exact-line 删除率 | 58.0% |
| 去重后过短而删除的文档 | 8 |
| MinHash 额外删除文档 | 0 |
| 最终文档 | 2,682 |

58.0% 的 line deletion 是整个实验最显著的信号：这份 web 数据里的重复主要是导航、页脚和模板片段，而不是整篇完全相同的文档。

### 17.5 Tokenization 与 preflight

最终 2,682 篇文档得到：

| 指标 | 数值 |
|---|---:|
| GPT-2 tokens | 3,929,317 |
| dtype | `uint16` |
| 扫描到的最大 token ID | 50,256 |
| 100,000-token scan 中 EOS | 74 |
| CPU train/valid batch | `2 x 512`，成功 |

这个结果证明示例数据可以经过全部 pipeline 并进入训练 batch 构造；它不是 2,500 WET 的最终 token count。

## 18. 运行时间怎样解释，而不是怎样夸大

已测量值：

- baseline 单 WET、单 worker 过滤：30.121 秒；
- strong end-to-end runner 中过滤：110.753 秒；
- strong runner 中去重：61.708 秒。

如果粗略假设 2,500 个 WET 都和这个 60 MB 文件相似，仅按 baseline 线性外推：

$$
2500\times30.121\text{s}\approx20.9\text{ hours}
$$

理想 8-worker compute-only 估算约 2.6 小时。但它不是 benchmark，忽略了：

- 文件大小和文档数差异；
- 磁盘与网络吞吐；
- 每个进程的模型加载和内存压力；
- JSONL 审计输出；
- 去重阶段的全局数据结构；
- worker 并行效率不可能严格为 8 倍。

“整个 Common Crawl 要多久”更不能用一个文件直接给精确数字，应按总压缩字节数、records 数、目标机器吞吐和去重架构测量。当前 laptop 上没有足够数据与磁盘资源，所以这里只报告局部实测和带假设的数量级估算。

## 19. 测试如何覆盖边界，而不只覆盖 happy path

公开副本完整测试结果是：

```text
51 passed in 4.95s
```

primitive tests 覆盖：

- HTML bytes 提取；
- English / Chinese language ID；
- email、phone、IPv4 masking 与计数；
- NSFW/toxicity label；
- Gopher 每条阈值边界；
- exact duplicate 与 fuzzy duplicate；
- backend status 和 strict model requirement。

脚本 tests 重点覆盖容易造成数据事故的路径：

- WET 目录扩展不读取 raw WARC；
- JSONL 保留行、text 输出 flatten；
- broad-web rule 的正反例和 reason；
- filter/dedup/runner 默认拒绝 stale outputs；
- runner 正确构造完整命令链；
- report 的 rates、tokens 和 samples；
- token worker 失败时 pool 被终止；
- token bin 只在成功后原子替换；
- preflight 接受合法 bin、拒绝 out-of-vocab token。

真实 example-WET runner 则补上单元测试不能证明的部分：压缩 WET 读取、fastText 模型、进程执行、跨阶段文件格式和百万级 token 写出确实能连起来。

## 20. 如何从零复现本地小样本

### 20.1 安装依赖和下载离线资源

```bash
uv sync
uv run scripts/download_data.py --offline-only
```

资源也可以放在 `CS336_SHARED_DATA` 指向的目录。正式过滤先检查 summary 中 backend，或直接加 `--require-models`。

### 20.2 先 dry-run

```bash
uv run scripts/run_data_pipeline.py local-shared-data/CC/example.warc.wet.gz \
  --work-dir data/a4-smoke \
  --valid-bin local-shared-data/tokenized_paloma_c4_100_domains_validation.bin \
  --workers 1 \
  --tokenize-workers 1 \
  --max-docs-per-file 100 \
  --web-quality-filter \
  --quality-filter \
  --report \
  --dry-run
```

### 20.3 用新目录实际执行

去掉 `--dry-run`。第一次建议 `workers=1`，便于看到 deterministic error；确认后再增加并行度。

### 20.4 检查结果

重点检查：

1. `filter_summary.json` 的 `processing_backends`；
2. `documents_total = documents_kept + 各短路 rejection`；
3. `dedup_summary.json` 的 line/document count；
4. `pipeline_report.md` 中固定 seed samples；
5. `.bin` 的 token count、EOS 与 max token ID；
6. `train.py --inspect-data` 是否能构造 train/valid batch。

### 20.5 正式训练入口

全量数据和 Modal 资源准备好后：

```bash
uv run modal run scripts/train.py --train-bin /root/data/your_data.bin
```

训练过程固定，不应为了降低 loss 修改模型或 optimizer。真正应比较的是不同数据 pipeline 版本的：

- 最终 token 数与有效样本分布；
- rejection/dedup rates；
- best Paloma validation loss；
- learning curve；
- 固定 seed 的保留与丢弃样本。

## 21. 当前没有完成的部分

以下结果目前不存在，所以没有用估算值填充：

1. 2,500 English WET 的全量过滤、去重和最终 token count；
2. 在正式数据上训练并校准的 quality classifier 指标；
3. 8xB200、16,384 steps 的最终训练；
4. Paloma C4 100 best validation loss；
5. 对应 learning curve；
6. 根据全量 kept/discarded samples 和验证损失进行的最后阈值迭代。

本地没有 Stanford `/shared-data`、共享 Modal volume 和对应 GPU 配额，磁盘也不适合缓存 2,500 WET。完整状态可以看 [completion audit][audit]。

## 22. 这次实现留下的工程结论

1. **WET 是 plain text，不是 clean text。** HTML tag 消失后，网页模板问题仍然存在。
2. **过滤率不是质量指标。** 删除更多数据可能提高纯度，也可能破坏 Paloma 分布匹配。
3. **classifier backend 必须进入实验 metadata。** heuristic 跑通流程不能冒充 production model 结果。
4. **过滤器计数必须按漏斗解释。** 顺序会改变每个 rejection count，不能把它们当成独立命中率。
5. **行边界是数据契约。** 过早 flatten 会让 exact-line dedup 在语义上失效。
6. **LSH 只负责找候选。** 真正删除前仍应计算真实 Jaccard，并处理传递重复簇。
7. **模板重复可能比文档重复严重。** 本地 58.0% line deletion、0 fuzzy documents 是很直接的证据。
8. **长 pipeline 需要失败安全。** stale-output guard、临时文件、原子替换和 preflight 都是在保护实验可信度。
9. **最终判断仍来自训练。** 规则和抽样帮助提出候选数据版本，Paloma loss 才能回答哪种数据对固定任务更有效。

Assignment 4 最有价值的地方，不是某条正则或某个 fastText API，而是要求把“这批网页看起来不太好”变成可执行的过滤器、明确的计数口径、可审计样本、可复现的去重算法和最终验证损失。数据工程的难点正是在这些边界上。

[repo]: https://github.com/keepkeen/cs336-assignment4-data/tree/e7cced8bd953f881f035f2e6b2601ad19b889b21
[handout]: https://github.com/keepkeen/cs336-assignment4-data/blob/e7cced8bd953f881f035f2e6b2601ad19b889b21/cs336_assignment4_data.md
[processing]: https://github.com/keepkeen/cs336-assignment4-data/blob/e7cced8bd953f881f035f2e6b2601ad19b889b21/cs336_data/processing.py
[adapters]: https://github.com/keepkeen/cs336-assignment4-data/blob/e7cced8bd953f881f035f2e6b2601ad19b889b21/tests/adapters.py
[wet-files]: https://github.com/keepkeen/cs336-assignment4-data/blob/e7cced8bd953f881f035f2e6b2601ad19b889b21/cs336_data/wet_files.py
[download]: https://github.com/keepkeen/cs336-assignment4-data/blob/e7cced8bd953f881f035f2e6b2601ad19b889b21/scripts/download_data.py
[filter]: https://github.com/keepkeen/cs336-assignment4-data/blob/e7cced8bd953f881f035f2e6b2601ad19b889b21/scripts/filter_wet_data.py
[quality-trainer]: https://github.com/keepkeen/cs336-assignment4-data/blob/e7cced8bd953f881f035f2e6b2601ad19b889b21/scripts/train_quality_classifier.py
[dedup]: https://github.com/keepkeen/cs336-assignment4-data/blob/e7cced8bd953f881f035f2e6b2601ad19b889b21/scripts/deduplicate_filtered_data.py
[tokenization]: https://github.com/keepkeen/cs336-assignment4-data/blob/e7cced8bd953f881f035f2e6b2601ad19b889b21/cs336_data/tokenization.py
[tokenize-script]: https://github.com/keepkeen/cs336-assignment4-data/blob/e7cced8bd953f881f035f2e6b2601ad19b889b21/scripts/tokenize_filtered_data.py
[runner]: https://github.com/keepkeen/cs336-assignment4-data/blob/e7cced8bd953f881f035f2e6b2601ad19b889b21/scripts/run_data_pipeline.py
[inspect]: https://github.com/keepkeen/cs336-assignment4-data/blob/e7cced8bd953f881f035f2e6b2601ad19b889b21/cs336_data/training_inspect.py
[report]: https://github.com/keepkeen/cs336-assignment4-data/blob/e7cced8bd953f881f035f2e6b2601ad19b889b21/scripts/summarize_pipeline_run.py
[explanation]: https://github.com/keepkeen/cs336-assignment4-data/blob/e7cced8bd953f881f035f2e6b2601ad19b889b21/tasks/solution_explanation.md
[audit]: https://github.com/keepkeen/cs336-assignment4-data/blob/e7cced8bd953f881f035f2e6b2601ad19b889b21/tasks/completion_audit.md
