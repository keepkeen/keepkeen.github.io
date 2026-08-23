// Import the local Ilya reading-guide project into this Astro blog.
//
// Usage from the blog repository root:
//   node scripts/import-ilya30.mjs ../ilya_30_papers
//
// The importer creates exactly 30 series posts, rewrites local cross-links to
// blog routes, converts LaTeX delimiters for remark-math, and mirrors the
// research/code artifacts under public/code/ilya30. It intentionally excludes
// PDFs, MinerU output, virtual environments, caches, and agent handoff files.

import {
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from 'node:fs';
import { join, resolve } from 'node:path';

const blogRoot = process.cwd();
const sourceRoot = resolve(process.argv[2] ?? '../ilya_30_papers');
const paperSourceDir = join(sourceRoot, 'docs/papers');
const postTargetDir = join(blogRoot, 'src/content/posts');
const seriesTarget = join(
  blogRoot,
  'src/content/series/ilya-sutskever-reading-list.md'
);
const mirrorRoot = join(blogRoot, 'public/code/ilya30');
const publicationDate = '2026-08-23';
const seriesId = 'ilya-sutskever-reading-list';
const repositoryUrl = 'https://github.com/keepkeen/keepkeen.github.io';

const topicTags = {
  1: 'transformer',
  2: 'complexity',
  3: 'rnn',
  4: 'rnn',
  5: 'rnn',
  6: 'mdl',
  7: 'attention',
  8: 'computer-vision',
  9: 'set-learning',
  10: 'distributed-systems',
  11: 'computer-vision',
  12: 'computer-vision',
  13: 'graph-neural-networks',
  14: 'transformer',
  15: 'attention',
  16: 'computer-vision',
  17: 'relational-reasoning',
  18: 'generative-models',
  19: 'memory',
  20: 'complexity',
  21: 'memory',
  22: 'speech-recognition',
  23: 'scaling-laws',
  24: 'mdl',
  25: 'artificial-intelligence',
  26: 'complexity',
  27: 'computer-vision',
  28: 'meta-learning',
  29: 'meta-learning',
  30: 'meta-learning'
};

function fail(message) {
  console.error(`Import failed: ${message}`);
  process.exit(1);
}

function ensureProjectShape() {
  try {
    const packageJson = JSON.parse(readFileSync(join(blogRoot, 'package.json'), 'utf8'));
    if (packageJson.name !== 'liuliming-blog') fail('run this script from the blog root');
    readFileSync(join(sourceRoot, 'sources/catalog.yaml'), 'utf8');
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

function stripMarkdown(value) {
  return value
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[`*_>#]/g, '')
    .replace(/\\[()[\]]/g, '')
    .replace(/\\([A-Za-z]+)/g, '$1')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getDescription(body) {
  const match = body.match(/## 一句话定位\s+([\s\S]*?)(?=\n## |$)/);
  if (!match) fail('a chapter is missing its “一句话定位” section');
  const firstParagraph = match[1].trim().split(/\n\s*\n/)[0];
  const plain = stripMarkdown(firstParagraph);
  return plain.length > 220 ? `${plain.slice(0, 217).replace(/\s+\S*$/, '').trim()}…` : plain;
}

function convertMathDelimiters(body) {
  return body
    .replace(/^[ \t]*\\\[[ \t]*$/gm, '$$$$')
    .replace(/^[ \t]*\\\][ \t]*$/gm, '$$$$')
    .replace(/\\\(([^\n]+?)\\\)/g, (_, expression) => `$${expression}$`);
}

function copyFiles(sourceDir, targetDir, predicate) {
  mkdirSync(targetDir, { recursive: true });
  for (const name of readdirSync(sourceDir).sort()) {
    if (!predicate(name)) continue;
    copyTextFile(join(sourceDir, name), join(targetDir, name));
  }
}

function copyTextFile(source, target) {
  const content = readFileSync(source, 'utf8').replace(/\s+$/, '');
  writeFileSync(target, `${content}\n`);
}

ensureProjectShape();
mkdirSync(postTargetDir, { recursive: true });

const paperFiles = readdirSync(paperSourceDir)
  .filter((name) => /^\d{2}-[a-z0-9-]+\.md$/.test(name))
  .sort();

if (paperFiles.length !== 30) {
  fail(`expected 30 chapter files, found ${paperFiles.length}`);
}

const slugByFile = new Map(
  paperFiles.map((file) => [file, `ilya-reading-${file.replace(/\.md$/, '')}`])
);

for (const file of paperFiles) {
  const id = Number(file.slice(0, 2));
  if (!Number.isInteger(id) || id < 1 || id > 30) fail(`invalid chapter id in ${file}`);

  const raw = readFileSync(join(paperSourceDir, file), 'utf8');
  const heading = raw.match(/^# (.+)\r?\n/);
  if (!heading) fail(`${file} is missing its H1 title`);

  const title = heading[1].trim();
  let body = raw.slice(heading[0].length).replace(/^\s+/, '');
  const description = getDescription(body);

  body = convertMathDelimiters(body);
  body = body.replace(
    /\((\d{2}-[a-z0-9-]+\.md)(#[^)]+)?\)/g,
    (_, target, anchor = '') => {
      const slug = slugByFile.get(target);
      if (!slug) fail(`${file} links to unknown chapter ${target}`);
      return `(/blog/${slug}/${anchor})`;
    }
  );
  body = body.replace(
    /\(\.\.\/\.\.\/src\/ilya30\/([^)]+)\)/g,
    (_, target) => `(${repositoryUrl}/blob/main/public/code/ilya30/src/ilya30/${target})`
  );

  const tags = ['deep-learning', 'paper-reading', 'ilya-reading-list', topicTags[id]];
  const frontmatter = [
    '---',
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(description)}`,
    `date: ${publicationDate}`,
    'tags:',
    ...tags.map((tag) => `  - ${tag}`),
    'lang: zh-CN',
    'featured: false',
    'draft: false',
    `series: ${seriesId}`,
    `seriesOrder: ${id}`,
    '---',
    ''
  ].join('\n');

  const targetName = `${publicationDate}-${slugByFile.get(file)}.md`;
  writeFileSync(join(postTargetDir, targetName), `${frontmatter}${body.trim()}\n`);
}

const seriesBody = `---
title: "Ilya Sutskever 必读材料：30 项深度导读"
description: "从可核查的 27 项保留清单出发，逐篇解释核心理论、实现、同期替代路线、优缺点与跨领域价值，并以三篇元学习代表作完成课程结构。"
lang: zh-CN
featured: true
draft: false
---

这套专题把网上流传的 “Ilya 推荐阅读清单” 整理成一条可以顺序学习、也可以按主题跳读的技术路线。每篇都会回答：为什么它可能出现在这套材料中、贡献与理论是什么、怎样实现、证据支持到哪里、其他路线如何解决同一问题，以及今天还能迁移到哪里。

## 先说明历史边界

[John Carmack 回忆](https://dallasinnovates.com/exclusive-qa-john-carmacks-different-path-to-artificial-general-intelligence/)收到的是一份**大约 40 项**的材料清单；原邮件后来丢失。2024 年 [Andrew Carr 公开的部分资料](https://x.com/andrew_n_carr/status/1752526711311507526)稳定保留 27 项，并注明缺少 “Meta Learning” 一组。因此：

- 01–27 是多个公开副本一致的高可信重建，仍不是 Ilya 本人正式发布的完整书单；
- 28–30 是 MANN、Prototypical Networks、MAML 三条元学习路线的编辑补全；
- 补成 30 项只是在构造课程，不表示已经恢复其余历史缺项。

逐篇的“为什么推荐”都会把**已知事实**和**课程作用推断**分开，避免替 Ilya 虚构没有留下记录的个人理由。

## 推荐阅读路线

| 阶段 | 建议顺序 | 建立的能力 |
|---|---|---|
| 训练与视觉 | 27 → 08 → 11 → 16 → 12 | 反向传播、卷积、残差路径与 dense prediction |
| 序列与注意力 | 03 → 04 → 05 → 15 → 07 → 14 → 01 | RNN/LSTM、软对齐、动态输出与 Transformer |
| 集合、关系与记忆 | 09 → 17 → 13 → 21 → 19 | 对称性、图消息传递与可微外部记忆 |
| 生成、语音与系统 | 18 → 22 → 10 → 23 | 潜变量、CTC、流水并行与规模规律 |
| 压缩与通用智能 | 26 → 24 → 06 → 02 → 20 → 25 | Kolmogorov、MDL、复杂性与智能形式化 |
| 元学习候选 | 28 → 29 → 30 | 通过记忆、度量与梯度完成快速适应 |

若只想先建立一条现代深度学习骨架，可以先读：**27 → 08 → 11 → 04 → 15 → 14 → 01 → 13 → 23 → 24**。

## 代码与研究档案

关键机制都提供独立 NumPy 实现和自动测试，包括 attention、RNN/LSTM、卷积与残差、集合与图、NTM/LRUA、CTC、VAE/MDL、GPipe/scaling、ProtoNet 与 MAML。教学实现验证公式和不变量，不冒充 ImageNet、Deep Speech 2 或完整大模型训练复现。

- [完整代码与原始研究档案](${repositoryUrl}/tree/main/public/code/ilya30)
- [出处、边界与研究方法](${repositoryUrl}/blob/main/public/code/ilya30/docs/00-provenance-and-method.md)
- [依赖式阅读路线](${repositoryUrl}/blob/main/public/code/ilya30/docs/01-reading-path.md)
- [30×8 完备性审计](${repositoryUrl}/blob/main/public/code/ilya30/docs/02-completeness-audit.md)
- [综合机制示例](${repositoryUrl}/blob/main/public/code/ilya30/examples/core_mechanisms.py)

这份档案已通过 58 个自动测试；25 份可公开获取的 PDF 使用带令牌的 MinerU VLM 完成解析，公式、实验数字和限制仍以论文原文、正式页面和作者勘误为准。
`;

writeFileSync(seriesTarget, seriesBody);

// Mirror the curated source artifacts. Keep the selection explicit so caches,
// PDFs, VLM extractions, and private handoff state can never leak by accident.
mkdirSync(mirrorRoot, { recursive: true });
for (const name of ['README.md', 'pyproject.toml']) {
  copyTextFile(join(sourceRoot, name), join(mirrorRoot, name));
}

copyFiles(join(sourceRoot, 'docs'), join(mirrorRoot, 'docs'), (name) => name.endsWith('.md'));
copyFiles(paperSourceDir, join(mirrorRoot, 'docs/papers'), (name) => name.endsWith('.md'));
copyFiles(join(sourceRoot, 'src/ilya30'), join(mirrorRoot, 'src/ilya30'), (name) => name.endsWith('.py'));
copyFiles(join(sourceRoot, 'tests'), join(mirrorRoot, 'tests'), (name) => name.endsWith('.py'));
copyFiles(join(sourceRoot, 'examples'), join(mirrorRoot, 'examples'), (name) => name.endsWith('.py'));
copyFiles(join(sourceRoot, 'scripts'), join(mirrorRoot, 'scripts'), (name) => name === 'fetch_sources.py');

mkdirSync(join(mirrorRoot, 'sources/pdfs'), { recursive: true });
for (const [source, target] of [
  ['sources/README.md', 'sources/README.md'],
  ['sources/catalog.yaml', 'sources/catalog.yaml'],
  ['sources/pdfs/manifest.json', 'sources/pdfs/manifest.json']
]) {
  copyTextFile(join(sourceRoot, source), join(mirrorRoot, target));
}

console.log(`Imported ${paperFiles.length} posts into series “${seriesId}”.`);
console.log(`Mirrored curated artifacts to ${mirrorRoot}.`);
