# 原始材料与 MinerU 解析

[`catalog.yaml`](catalog.yaml) 是机器可读书目和出处标签。`scripts/fetch_sources.py` 会下载存在公开 PDF 的 25 项材料（05–26、28–30），并在 `sources/pdfs/manifest.json` 写入来源、字节数与 SHA-256。01–04 是网页材料，27 是课程，因此不伪造 PDF 版本。

```bash
python3 -m pip install pyyaml certifi
python3 scripts/fetch_sources.py
```

本次研究按用户要求使用已配置 token 的 MinerU `vlm` 模型，而不是把早期 `flash-extract` 输出当作最终文本。常规批处理命令形式为：

```bash
mineru-open-api auth --verify
mineru-open-api extract sources/pdfs/*.pdf \
  --model vlm --format md --language en \
  --output sources/extracted_vlm
```

VLM 已成功处理全部 25 份 PDF。519 页的第 26 项因长文档任务限制按 `1-200`、`201-400`、`401-519` 三段提交，再按页序合并为 `26-kolmogorov-complexity.md`；三个分段文件保留用于核对。解析文本只用于定位公式、表格和上下文，最终事实仍与论文页面、PDF 版面、作者勘误及正式元数据交叉核验。VLM 可能误读公式或产生罕见幻觉，不能把抽取结果本身当作权威来源。

以下目录均由工具生成并已加入 `.gitignore`：

- `sources/pdfs/`：原始 PDF 和 checksum manifest；
- `sources/extracted_vlm/`：带 token 的 VLM Markdown 与图片；
- `sources/extracted/`：早期 flash-extract 输出，仅作备用；
- `.cache/text/`：`pdftotext -layout` 的独立文本回退。
