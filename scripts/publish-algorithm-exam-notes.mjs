import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const blogRoot = path.resolve(scriptDir, "..");
const notesRoot = path.resolve(blogRoot, "..", "leetcode");
const outputRoot = path.join(blogRoot, "src", "content", "posts");
const repositoryBase = "https://github.com/keepkeen/llm-algo-job-notes/blob/main/";
const publishedAt = "2026-08-31";

const posts = [
  {
    source: "笔试/纯力扣算法/基础/Hot100算法模板与决策术.md",
    output: "2026-07-26-hot100-templates.md",
    slug: "hot100-templates",
    title: "LeetCode Hot100 · 18 大算法模板与决策术",
    description: "从识别信号到 Python/ACM 模板、复杂度和常见坑，系统掌握 Hot100 的 18 个核心算法模式。",
    date: "2026-07-26",
    order: 1,
  },
  {
    source: "笔试/纯力扣算法/基础/Hot100补充篇·位运算与技巧.md",
    output: "2026-07-26-hot100-bitwise-tricks.md",
    slug: "hot100-bitwise-tricks",
    title: "LeetCode Hot100 补充篇：位运算、数学与杂项技巧",
    description: "补齐位运算、摩尔投票、原地哈希、矩阵与前后缀分解等模板 19–27。",
    date: "2026-07-26",
    order: 2,
  },
  {
    source: "笔试/纯力扣算法/基础/Hot100缺失27题·Kindle补充.md",
    output: "2026-08-31-hot100-missing-27-problems.md",
    slug: "hot100-missing-27-problems",
    title: "LeetCode Hot100 · 缺失 27 题完整补充",
    description: "补齐两份算法模板中尚无独立代码的 27 道官方 Hot100 题，形成完整 100 题复习卡。",
    date: "2026-08-31",
    order: 3,
  },
  {
    source: "笔试/纯力扣算法/基础/2026 年 7 月 arXiv 大牛组大模型论文精选与解析.md",
    output: "2026-08-31-arxiv-llm-papers-july-2026.md",
    slug: "arxiv-llm-papers-july-2026",
    title: "2026 年 7 月 arXiv 大模型论文精选与解析",
    description: "从 2026 年 7 月大模型论文中精选表示学习、推理、安全、理论与 Agent 训练方向的代表工作。",
    date: "2026-08-31",
    order: 4,
  },
  {
    source: "笔试/纯力扣算法/应试/ACM输入输出速查.md",
    output: "2026-07-26-acm-io-cheatsheet.md",
    slug: "acm-io-cheatsheet",
    title: "ACM 模式输入输出速查（Python）",
    description: "覆盖快读、多组测试、EOF、树图构造和常见输出格式，避免算法会写却卡在 I/O。",
    date: "2026-07-26",
    order: 5,
  },
  {
    source: "笔试/纯力扣算法/应试/大厂笔试模式识别与组合题决策树.md",
    output: "2026-07-26-exam-pattern-decision-tree.md",
    slug: "exam-pattern-decision-tree",
    title: "大厂笔试模式识别与组合题决策树",
    description: "用约束、状态、不变量和复杂度识别原题、同构题与多算法组合题，减少错误套模板。",
    date: "2026-07-26",
    order: 6,
  },
  {
    source: "笔试/纯力扣算法/应试/大厂笔试超纲补丁.md",
    output: "2026-07-26-exam-beyond-syllabus-patch.md",
    slug: "exam-beyond-syllabus-patch",
    title: "大厂笔试超纲补丁：模板 28–35",
    description: "集中补齐二分答案、差分、最短路、快速幂、数论、区间贪心、单调队列与模拟题。",
    date: "2026-07-26",
    order: 7,
  },
  {
    source: "笔试/纯力扣算法/应试/大厂笔试提分补丁v2.md",
    output: "2026-07-26-exam-score-patch-v2.md",
    slug: "exam-score-patch-v2",
    title: "大厂笔试提分补丁 v2：模板 36–44",
    description: "补齐记忆化、二维前缀和、背包、进制、区间/树形 DP、逆序对、自定义排序与恰好 K。",
    date: "2026-07-26",
    order: 8,
  },
];

const requiredDirectories = [
  "笔试/纯力扣算法/基础",
  "笔试/纯力扣算法/应试",
];

const discoveredSources = (
  await Promise.all(
    requiredDirectories.map(async (directory) => {
      const entries = await readdir(path.join(notesRoot, directory), { withFileTypes: true });
      return entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
        .map((entry) => path.posix.join(directory, entry.name));
    }),
  )
).flat();

const configuredSources = new Set(posts.map((post) => post.source));
const missingSources = discoveredSources.filter((source) => !configuredSources.has(source));
const staleSources = posts
  .map((post) => post.source)
  .filter((source) => !discoveredSources.includes(source));

if (missingSources.length || staleSources.length) {
  const messages = [];
  if (missingSources.length) messages.push(`未配置发布的文档：\n- ${missingSources.join("\n- ")}`);
  if (staleSources.length) messages.push(`配置中不存在的文档：\n- ${staleSources.join("\n- ")}`);
  throw new Error(messages.join("\n"));
}

const sourceToSlug = new Map(posts.map((post) => [post.source, post.slug]));
sourceToSlug.set("笔试/公司题型/2024-2027大厂算法岗笔试作战手册.md", "algo-written-exam-playbook");
sourceToSlug.set("笔试/AI算法/模型手写/ML-AI-Coding笔试补丁.md", "ml-ai-coding-patch");

function githubUrl(source) {
  return repositoryBase + source.split("/").map(encodeURIComponent).join("/");
}

function stripTitle(markdown) {
  return markdown.replace(/^\s*(?:-\s*)?# .+\r?\n(?:\r?\n)?/, "");
}

function convertLinks(markdown, source) {
  const sourceDir = path.posix.dirname(source);
  return markdown.replace(/\]\(([^)#]+)(#[^)]+)?\)/g, (match, rawTarget, hash = "") => {
    if (/^(?:https?:|mailto:|\/)/.test(rawTarget)) return match;
    const normalized = path.posix.normalize(path.posix.join(sourceDir, rawTarget));
    const slug = sourceToSlug.get(normalized);
    if (slug) return `](/blog/${slug}/${hash})`;
    return `](${githubUrl(normalized)}${hash})`;
  });
}

await mkdir(outputRoot, { recursive: true });

for (const post of posts) {
  const raw = await readFile(path.join(notesRoot, post.source), "utf8");
  const body = convertLinks(stripTitle(raw).trim(), post.source);
  const frontmatter = [
    "---",
    `title: ${JSON.stringify(post.title)}`,
    `description: ${JSON.stringify(post.description)}`,
    `date: ${post.date}`,
    `updatedDate: ${publishedAt}`,
    "tags:",
    "  - algorithms",
    "  - leetcode",
    "  - interview",
    "featured: false",
    "draft: false",
    "lang: zh-CN",
    "series: algorithm-exam-training",
    `seriesOrder: ${post.order}`,
    "---",
    "",
  ].join("\n");
  const note = [
    `> 本文完整同步自个人求职工作区，更新于 ${publishedAt}。源文件及后续更新托管在 GitHub 仓库 [llm-algo-job-notes](https://github.com/keepkeen/llm-algo-job-notes)。`,
    "",
    "",
  ].join("\n");
  const footer = [
    "",
    "---",
    "",
    `原始文档：[GitHub 源文件](${githubUrl(post.source)})。`,
    "",
  ].join("\n");
  await writeFile(path.join(outputRoot, post.output), `${frontmatter}${note}${body}${footer}`, "utf8");
}

console.log(`Published all ${posts.length} Markdown files from 基础/ and 应试/`);
