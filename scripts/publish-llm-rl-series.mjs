import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";


const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const blogRoot = path.resolve(scriptDir, "..");
const sourceRoot = path.resolve(
  blogRoot,
  "..",
  "leetcode",
  "笔试",
  "AI算法",
  "强化学习",
);
const outputRoot = path.join(blogRoot, "src", "content", "posts");
const repositoryBase =
  "https://github.com/keepkeen/llm-algo-job-notes/blob/main/";

const chapters = [
  {
    file: "00_专题导读与岗位地图.md",
    slug: "llm-rl-job-map",
    title: "大模型强化学习岗位地图与学习入口",
    description:
      "从 2025—2026 公开岗位和面经出发，区分后训练、Reasoning RL、Agentic RL 与 RL 系统岗位，并给出零基础优先级。",
  },
  {
    file: "01_数学地基与MDP.md",
    slug: "rl-math-mdp",
    title: "强化学习数学地基与 MDP",
    description:
      "用概率、期望、log-derivative trick、return、value 与 Bellman 方程建立大模型 RL 的共同语言。",
  },
  {
    file: "02_价值学习_MC_TD_Q-learning.md",
    slug: "rl-value-learning",
    title: "从 Monte Carlo、TD 到 Q-learning",
    description:
      "系统理解 bootstrap、TD error、SARSA、Q-learning、探索与价值学习，再连接到 LLM 的 critic 和 advantage。",
  },
  {
    file: "03_策略梯度_REINFORCE_ActorCritic_GAE.md",
    slug: "rl-policy-gradient-gae",
    title: "策略梯度、Actor-Critic 与 GAE",
    description:
      "从 REINFORCE 推导到 baseline、Actor-Critic、GAE 和 importance sampling，为 PPO 打牢公式与数值直觉。",
  },
  {
    file: "04_RLHF与PPO.md",
    slug: "llm-rlhf-ppo",
    title: "RLHF 与 PPO：从四模型数据流到训练指标",
    description:
      "拆解 actor、critic、reference 与 reward model，分优势正负解释 PPO clip，覆盖 KL 的 k1/k2/k3 估计器、“KL 能否换交叉熵”与训练排障。",
  },
  {
    file: "05_RewardModel_DPO与偏好学习.md",
    slug: "llm-reward-model-dpo",
    title: "Reward Model、DPO 与偏好学习",
    description:
      "从 Bradley–Terry 到 DPO 推导，解释 beta、reference、长度偏置与训练退化，附拒绝采样与 IPO/KTO/ORPO/SimPO 家族取舍。",
  },
  {
    file: "06_GRPO_RLVR与新方法.md",
    slug: "llm-grpo-rlvr",
    title: "GRPO、RLVR 与新方法坐标系",
    description:
      "组内相对优势、结构性失败、DeepSeek R1 四阶段管线、MoE 训推不一致机制，以及 DAPO/GSPO/CISPO/OPD 六轴坐标系。",
  },
  {
    file: "07_AgenticRL与多轮工具调用.md",
    slug: "agentic-rl-tool-use",
    title: "Agentic RL 与多轮工具调用",
    description:
      "从多轮 MDP、轨迹 schema、loss mask、六种信用分配（含 GiGPO 锚点状态分组）到异步 rollout、环境设计和安全。",
  },
  {
    file: "08_训练系统_框架_指标与排障.md",
    slug: "llm-rl-training-systems",
    title: "大模型 RL 训练系统、指标与排障",
    description:
      "梳理 rollout 与 trainer 数据流、并行和显存、TRL/verl/slime/OpenRLHF/AReaL/ROLL 选型，以及八类高频故障诊断。",
  },
  {
    file: "09_面经题库与答案卡.md",
    slug: "llm-rl-interview-cards",
    title: "大模型强化学习面经：76 张答案卡",
    description:
      "按 2025—2026 公开实录归纳：经典 RL、PPO/DPO/GRPO、R1 管线、MoE、Agentic RL、系统与 8 月前沿，配两轮追问与评分标准。",
  },
  {
    file: "10_手写练习与实验.md",
    slug: "llm-rl-coding-labs",
    title: "强化学习手写练习与递进实验",
    description:
      "闭卷实现 return、GAE、PPO、DPO、GRPO，配数值题、自动测试和从 GridWorld 到小模型 RL 的项目设计。",
  },
  {
    file: "11_30天学习与项目计划.md",
    slug: "llm-rl-30-day-plan",
    title: "大模型强化学习 30 天学习与项目计划",
    description:
      "每天安排 RL 主线、公式手写、项目、面经口述和两道 LeetCode，月底形成可展示的训练闭环。",
  },
  {
    file: "12_前沿专题_多模态RL_RM前沿与Scaling.md",
    slug: "llm-rl-frontier-topics",
    title: "多模态 RL、奖励模型前沿与 RL Scaling",
    description:
      "Visual-RFT、DeepSeek-GRM、RLVR 边界与 ScaleRL，并系统讲解多奖励饱和、组梯度冲突、OPD 过滤和 Agent 信用分配。",
  },
  {
    file: path.join("sources", "来源索引.md"),
    slug: "llm-rl-source-index",
    title: "大模型强化学习资料与面经来源索引",
    description:
      "汇总经典论文、2025—2026 新方法、官方框架、岗位页面和候选人面经，并说明证据等级与使用边界。",
  },
];

const chapterSlugByFile = new Map(
  chapters.map((chapter) => [chapter.file.replaceAll(path.sep, "/"), chapter.slug]),
);

function githubSourceUrl(relativeFile) {
  const repositoryPath = path.posix.join(
    "笔试",
    "AI算法",
    "强化学习",
    relativeFile.replaceAll(path.sep, "/"),
  );
  return repositoryBase + repositoryPath.split("/").map(encodeURIComponent).join("/");
}

function convertLinks(body, sourceFile) {
  const sourceDirectory = path.posix.dirname(sourceFile.replaceAll(path.sep, "/"));

  return body.replace(/\]\(([^)#]+)(#[^)]+)?\)/g, (match, rawTarget, hash = "") => {
    if (/^(?:https?:|mailto:|\/)/.test(rawTarget)) {
      return match;
    }

    const normalized = path.posix.normalize(path.posix.join(sourceDirectory, rawTarget));
    const targetSlug = chapterSlugByFile.get(normalized);
    if (targetSlug) {
      return `](/blog/${targetSlug}/${hash})`;
    }

    if (normalized.startsWith("templates/") || normalized.startsWith("tests/")) {
      return `](${githubSourceUrl(normalized)}${hash})`;
    }
    return match;
  });
}

function stripDocumentTitle(markdown) {
  return markdown.replace(/^# .+\r?\n(?:\r?\n)?/, "");
}

await mkdir(outputRoot, { recursive: true });

for (const [index, chapter] of chapters.entries()) {
  const sourcePath = path.join(sourceRoot, chapter.file);
  const raw = await readFile(sourcePath, "utf8");
  const body = convertLinks(stripDocumentTitle(raw), chapter.file).trim();
  const order = index + 1;
  const frontmatter = [
    "---",
    `title: ${JSON.stringify(chapter.title)}`,
    `description: ${JSON.stringify(chapter.description)}`,
    "date: 2026-08-13",
    "updatedDate: 2026-08-23",
    "tags:",
    "  - reinforcement-learning",
    "  - llm",
    "  - interview",
    "lang: zh-CN",
    ...(order === 1 ? ["featured: true"] : []),
    "draft: false",
    "series: llm-reinforcement-learning-interview",
    `seriesOrder: ${order}`,
    "---",
    "",
  ].join("\n");
  const sourceUrl = githubSourceUrl(chapter.file);
  const footer = [
    "",
    "---",
    "",
    `原始讲义与可运行材料：[GitHub 源文件](${sourceUrl})。`,
    "",
  ].join("\n");
  const outputPath = path.join(
    outputRoot,
    `2026-08-13-${chapter.slug}.md`,
  );
  await writeFile(outputPath, `${frontmatter}${body}${footer}`, "utf8");
}

console.log(`Published ${chapters.length} RL series posts from ${sourceRoot}`);
