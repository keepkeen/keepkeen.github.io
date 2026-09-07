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
    source: "笔试/AI算法/知识/LLM算法岗求职指南.md",
    output: "2026-07-26-llm-algo-interview-guide.md",
    slug: "llm-algo-interview-guide",
    title: "大模型算法岗面试与备战指南",
    description: "更新至 2026-09-08：训练、后训练、Agent 排障与项目深挖；新增完整 ML 提交和长任务延迟回答。",
    date: "2026-07-26",
    order: 1,
    tags: ["ai", "llm", "interview", "career"],
  },
  {
    source: "笔试/AI算法/题库/LLM算法岗题库与证据.md",
    output: "2026-07-26-llm-algo-interview-evidence.md",
    slug: "llm-algo-interview-evidence",
    title: "2025—2027 大模型算法岗题库与证据账本",
    description: "更新至 2026-09-08：历史算法面经与 23 张知识缺口卡，附九月跨岗位样本入口和证据边界。",
    date: "2026-07-26",
    order: 2,
    tags: ["ai", "llm", "interview", "career"],
  },
  {
    source: "笔试/公司题型/2024-2027大厂算法岗笔试作战手册.md",
    output: "2026-07-26-algo-written-exam-playbook.md",
    slug: "algo-written-exam-playbook",
    title: "2024–2027 大厂算法岗笔试作战手册",
    description: "更新至 2026-09-08：京东 NumPy/JSON 逻辑回归、数字构造、双向模拟与已有 LeetCode/AI Coding 训练。",
    date: "2026-07-26",
    order: 3,
    tags: ["algorithms", "interview", "career"],
  },
  {
    source: "笔试/计划与复盘/30天冲刺计划.md",
    output: "2026-07-26-llm-30day-sprint-plan.md",
    slug: "llm-30day-sprint-plan",
    title: "大模型算法岗 30 天冲刺计划",
    description: "2026-09-08 按真实进度校准：D17/D11/D1，并附 9.08–9.14 力扣、手写、口述执行表。",
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
    title: "2027 届秋招作战总计划（2026-09-08 更新）",
    description: "投递、笔试、面试和 offer 决策总控：正式批收口、新增 Agent 岗、训练分支与风险预案。",
    date: "2026-08-13",
    order: 12,
    tags: ["ai", "llm", "interview", "career"],
  },
  {
    source: "求职/招聘情报/2027届秋招时间线与投递策略.md",
    output: "2026-08-13-qiuzhao-2027-timeline-strategy.md",
    slug: "qiuzhao-2027-timeline-strategy",
    title: "2027 届秋招时间线与投递策略",
    description: "更新至 2026-09-08：九月笔面节奏、临近事项与按通知安排的公司定向复习。",
    date: "2026-08-13",
    order: 13,
    tags: ["ai", "llm", "interview", "career"],
  },
  {
    source: "求职/招聘情报/招聘窗口与刷新日志.md",
    output: "2026-08-13-recruit-window-refresh-log.md",
    slug: "recruit-window-refresh-log",
    title: "招聘窗口与刷新日志（2026-09-08 快照）",
    description: "2027 届校招当前状态表：正式批新岗位、过期批次、官方入口、毕业区间、AI Coding 与下一动作。",
    date: "2026-08-13",
    order: 14,
    tags: ["ai", "llm", "interview", "career"],
  },
  {
    source: "求职/招聘情报/2025-2026国内大模型算法岗招聘面经笔试汇总.md",
    output: "2026-08-13-llm-recruit-interview-roundup.md",
    slug: "llm-recruit-interview-roundup",
    title: "2025—2026 国内大模型算法岗招聘、面经与笔试汇总",
    description: "更新至 2026-09-08：美团/vivo 招聘流程、京东与字节公开样本、冲突试卷及三篇 RL 阅读案例。",
    date: "2026-08-13",
    order: 15,
    tags: ["ai", "llm", "interview", "career"],
  },
  {
    source: "求职/测评与流程/笔试测评与AI面试指南.md",
    output: "2026-08-13-assessment-ai-interview-guide.md",
    slug: "assessment-ai-interview-guide",
    title: "笔试测评与 AI 面试指南",
    description: "更新至 2026-09-08：近期笔试场次、测评要求、NumPy/JSON 完整交付与 AI Coding 计时策略。",
    date: "2026-08-13",
    order: 18,
    tags: ["ai", "llm", "interview", "career"],
  },
];

const sourceToSlug = new Map(posts.map((post) => [post.source, post.slug]));
sourceToSlug.set("笔试/AI算法/知识/LLM算法岗求职指南.md", "llm-algo-interview-guide");
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
    "updatedDate: 2026-09-08",
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
    "> 本文是个人求职工作区文档的发布版，更新于 2026-09-08（北京时间凌晨快照）。源文件托管在 GitHub 仓库 [llm-algo-job-notes](https://github.com/keepkeen/llm-algo-job-notes)；历史章节保留各自证据日期，岗位状态见最新窗口日志。",
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
