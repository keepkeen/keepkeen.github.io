import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const blogRoot = path.resolve(scriptDir, "..");
const notesRoot = path.resolve(blogRoot, "..", "leetcode");
const outputRoot = path.join(blogRoot, "src", "content", "posts");
const repositoryBase = "https://github.com/keepkeen/llm-algo-job-notes/blob/main/";

const posts = [
  {
    source: "笔试/公司题型/2024-2027大厂算法岗笔试作战手册.md",
    output: "2026-07-26-algo-written-exam-playbook.md",
    slug: "algo-written-exam-playbook",
    title: "2024–2027 大厂算法岗笔试作战手册",
    description: "更新至 2026-08-23 的国内大厂算法岗笔试证据、LeetCode 映射、AI Coding 新卷型与限时训练策略。",
    date: "2026-07-26",
    order: 3,
    tags: ["algorithms", "interview", "career"],
  },
  {
    source: "笔试/计划与复盘/30天冲刺计划.md",
    output: "2026-07-26-llm-30day-sprint-plan.md",
    slug: "llm-30day-sprint-plan",
    title: "大模型算法岗 30 天冲刺计划",
    description: "把力扣、模型手写、面经知识和投递压进 30 天；含 2026-08-23 重排规则、逐日表和最终验收线。",
    date: "2026-07-26",
    order: 4,
    tags: ["ai", "interview", "career", "planning"],
  },
  {
    source: "笔试/AI算法/模型手写/ML-AI-Coding笔试补丁.md",
    output: "2026-07-26-ml-ai-coding-patch.md",
    slug: "ml-ai-coding-patch",
    title: "ML / AI Coding 算法岗笔试补丁",
    description: "JSON 契约、数值稳定、Viterbi、Attention、IRLS、搜索排序/NDCG、Apriori 与 MITM 的限时实现要点。",
    date: "2026-07-26",
    order: 11,
    tags: ["ai", "algorithms", "interview"],
  },
  {
    source: "求职/秋招作战总计划.md",
    output: "2026-08-13-qiuzhao-2027-master-plan.md",
    slug: "qiuzhao-2027-master-plan",
    title: "2027 届秋招作战总计划（2026-08-23 更新）",
    description: "投递、笔试、面试和 offer 决策总控：8 月 23 日截止任务、未来 7 天补投表、训练降载与风险预案。",
    date: "2026-08-13",
    order: 12,
    tags: ["ai", "llm", "interview", "career"],
  },
  {
    source: "求职/招聘情报/2027届秋招时间线与投递策略.md",
    output: "2026-08-13-qiuzhao-2027-timeline-strategy.md",
    slug: "qiuzhao-2027-timeline-strategy",
    title: "2027 届秋招时间线与投递策略",
    description: "更新至 2026-08-23：华为、快手、小米、美团、网易、荣耀等第二波启动，附投递节奏和 AI Coding 新信号。",
    date: "2026-08-13",
    order: 13,
    tags: ["ai", "llm", "interview", "career"],
  },
  {
    source: "求职/招聘情报/招聘窗口与刷新日志.md",
    output: "2026-08-13-recruit-window-refresh-log.md",
    slug: "recruit-window-refresh-log",
    title: "招聘窗口与刷新日志（2026-08-23 快照）",
    description: "2027 届校招当前状态表：8 月中旬新开批次、当日截止、官方入口、毕业区间、AI Coding 与下一动作。",
    date: "2026-08-13",
    order: 14,
    tags: ["ai", "llm", "interview", "career"],
  },
  {
    source: "求职/招聘情报/2025-2026国内大模型算法岗招聘面经笔试汇总.md",
    output: "2026-08-13-llm-recruit-interview-roundup.md",
    slug: "llm-recruit-interview-roundup",
    title: "2025—2026 国内大模型算法岗招聘、面经与笔试汇总",
    description: "更新至 2026-08-23：招聘批次、候选人面经、正式批笔试、AI Coding 和后训练/Agent RL 前沿增量。",
    date: "2026-08-13",
    order: 15,
    tags: ["ai", "llm", "interview", "career"],
  },
  {
    source: "求职/测评与流程/笔试测评与AI面试指南.md",
    output: "2026-08-13-assessment-ai-interview-guide.md",
    slug: "assessment-ai-interview-guide",
    title: "笔试测评与 AI 面试指南",
    description: "更新至 2026-08-23：行测、性格与 AI 面试规则，以及快手/荣耀/美团新增 AI Coding 的三种卷型和诚信边界。",
    date: "2026-08-13",
    order: 18,
    tags: ["ai", "llm", "interview", "career"],
  },
];

const sourceToSlug = new Map(posts.map((post) => [post.source, post.slug]));
sourceToSlug.set("笔试/AI算法/强化学习/09_面经题库与答案卡.md", "llm-rl-interview-cards");
sourceToSlug.set("笔试/AI算法/强化学习/12_前沿专题_多模态RL_RM前沿与Scaling.md", "llm-rl-frontier-topics");

function githubUrl(source) {
  return repositoryBase + source.split("/").map(encodeURIComponent).join("/");
}

function stripTitle(markdown) {
  return markdown.replace(/^# .+\r?\n(?:\r?\n)?/, "");
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
    "updatedDate: 2026-08-23",
    "tags:",
    ...post.tags.map((tag) => `  - ${tag}`),
    "featured: false",
    "draft: false",
    "lang: zh-CN",
    "series: llm-algo-job-hunt",
    `seriesOrder: ${post.order}`,
    "---",
    "",
  ].join("\n");
  const note = [
    "> 本文是个人求职工作区文档的发布版，更新于 2026-08-23。源文件与后续动态更新托管在 GitHub 仓库 [llm-algo-job-notes](https://github.com/keepkeen/llm-algo-job-notes)；公开面经与招聘信息均按正文证据等级使用，投递前请重新打开官方页面。",
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

console.log(`Published ${posts.length} refreshed job-hunt posts from ${notesRoot}`);
