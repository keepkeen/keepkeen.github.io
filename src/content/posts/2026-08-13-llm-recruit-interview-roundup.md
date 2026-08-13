---
title: "2025—2026 国内大模型算法岗招聘、面经与笔试汇总"
description: "年份与届别口径、公司覆盖矩阵、面试笔试信号、按岗位方向的准备矩阵、社交平台证据边界与 2026-08 增量。"
date: 2026-08-13
tags:
  - ai
  - llm
  - interview
  - career
featured: false
draft: false
lang: zh-CN
series: llm-algo-job-hunt
seriesOrder: 15
---

> 本文是个人求职工作区文档的发布版，核验日期 2026-08-13。源文件与后续动态更新托管在 GitHub 仓库 [llm-algo-job-notes](https://github.com/keepkeen/llm-algo-job-notes)；面经与组织情报均为公开来源转述，证据分级见正文说明。

> 检索截止：2026-08-13（§12 为本轮增量；正文其余部分口径仍为 2026-07-30）
>
> 范围：国内头部互联网/科技公司、代表性大模型公司、研究机构、车企与中型公司；覆盖公开可检索的实习、春招、秋招/提前批、补录、面经和笔试。
>
> 边界：这是一份“代表性公开证据集”，不是企业内部题库，也不可能穷尽小程序、已删除帖子、私域群和未公开团队直招。

## 0. 先看结论

1. **必须分开“届别”和“自然年”**：2026 届的暑期实习、提前批和秋招主周期主要发生在 2025 年；2026 年 7 月的校招主力已经是 2027 届，2026 届多为春招、补录、海外项目或残留页面。
2. **岗位已经分成四条主链**：基础模型/预训练、后训练与 RL、Agent/RAG/搜索应用、AI Infra/模型优化；另有多模态、评测安全和具身智能横向贯穿。筛 JD 时要先判断交付物，而不是只看“大模型”三个字。
3. **项目深挖是最稳定的考查项**：数据、baseline、训练资源、指标、bad case、上线成本、失败实验和个人贡献，比通用八股更能区分候选人。
4. **2025—2026 的技术增量**集中在 GRPO/DAPO/GSPO、异步 rollout、Agentic RL、RAG 责任归因、LLM-as-a-Judge、多模态对齐、KV Cache/显存和数据工程；但传统 ML、SQL、算法手撕仍然没有退出。
5. **公司流程不是固定模板**：公开个人样本常见“可能的笔试/机试 → 2–3 轮技术面 → 主管/HR”，但 BU、岗位、候选人和批次差异很大。只有公司官方写明的流程才能当规则。
6. **牛客是本轮最可复核的个人面经来源**；知乎可补充索引和复盘，但培训号/合集很多；CSDN、博客园常见搬运或由 JD 扩写的模拟题；小红书内容平台和公众号原文对公开搜索引擎不友好，无法核验时不提取事实。

---

## 1. 年份与批次口径

### 1.1 怎样理解“2025 年、2026 年招聘”

| 自然时间 | 主要对象 | 常见批次 | 资料归档方式 |
|---|---|---|---|
| 2024 下半年 | 2025 届 | 提前批、秋招、补录 | 只作为 2025 届历史流程画像 |
| 2025 2–5 月 | 2025 届全职、2026 届实习 | 春招、补录、暑期实习 | 同时标记“自然年 2025”和“候选人届别” |
| 2025 6–12 月 | 2026 届 | 提前批、秋招、补录 | 这是 2026 届最主要的招聘窗口 |
| 2026 1–5 月 | 2026 届全职、2027 届实习 | 春招、补录、暑期实习 | 不把 2027 届实习误写成 2026 届 |
| 2026 6–12 月 | 2027 届 | 提前批、秋招、正式批 | 当前重点；2026 届旧页可能仍被搜索到 |

每条动态至少记录五个字段：`cohort`（届别）、`event_date`、`stage`、`last_checked`、`status`。只有页面发布日期而没有实际面试日时，写“页面日期”，不能擅自推断。

### 1.2 覆盖口径

- 核心大厂：字节跳动、阿里/蚂蚁、腾讯、百度、华为、美团、快手、京东、小红书、拼多多。
- 大型补充：小米、网易/有道、哔哩哔哩、滴滴、OPPO、vivo、荣耀、携程、米哈游。
- 大模型公司与研究机构：智谱、MiniMax、DeepSeek、月之暗面/Kimi、阶跃星辰、百川、面壁、商汤、科大讯飞、上海 AI Lab、北京智源。
- 相邻高价值样本：理想、蔚来、小鹏等车企，以及微软亚洲研究院等在华研究团队。

“未找到强证据”表示公开资料不足，不表示公司没有招聘或不考该主题。

---

## 2. 2025 自然年：可确认的招聘事件

下面只列能稳定追溯的代表性事件。历史官网页面常被下架，因此部分使用高校就业网、国家就业平台或招聘平台中的企业/HR 职位页；它们只能证明当时公开过，不能证明现在仍开放。

| 公司/机构 | 批次与对象 | 大模型相关方向 | 证据与边界 |
|---|---|---|---|
| 淘天集团 | 2026 届春季/暑期实习，2025-03-03 启动 | AIGC、多模态、CV、NLP、三维/视频 | [高校托管企业简章 PDF](https://jiuye.uestc.edu.cn/uploadify/employer/recruit/upload_1742888723/%E6%B7%98%E5%A4%A9%E9%9B%86%E5%9B%A22026%E5%B1%8A%E6%98%A5%E5%AD%A3%E5%AE%9E%E4%B9%A0%E7%94%9F%E6%8B%9B%E8%81%98%E7%AE%80%E7%AB%A0.pdf)，`A-Relay` |
| 美团 | 2025 届秋招在 2024-07 启动；2025 年继续有 2026 届实习/秋招 | 大模型、Agent、本地生活、搜广推 | [美团 2025 届官方新闻](https://www.meituan.com/news/NN240729051006994)可核验历史规模；不同年份不能混用，`A-Official` |
| 小红书 | 2025 校招 | 通用基础大模型、多模态、Alignment、模型轻量化 | [2025 通用大模型算法 JD](https://job.xiaohongshu.com/campus/position/13498)，`A-Official`；页面可能为历史残留 |
| 百度 | 2025 年公开职位 | 多模态预训练/后训练、跨模态对齐、RL、Agent | [多模态校招岗位](https://talent.baidu.com/jobs/detail/GRADUATE/2db37b8c-ea57-444c-ab8d-72e66cd88a6f)，`A-Official` |
| 华为 | 2025 届岗位 | 盘古/行业模型、昇腾训推、RLHF、MoE、多模态 | [招聘平台历史职位](https://www.nowcoder.com/jobs/detail/337739)，`A-Relay`，不是官网归档 |
| 字节跳动 | 2025 春招/2026 届实习与秋招 | 基础模型、内容/电商治理、SFT、CoT、RL、RAG/Agent | [电商治理岗位页](https://www.nowcoder.com/jobs/detail/386020)，`A-Relay` |
| 阿里 | 2025 补招/2026 届实习与秋招 | Qwen、多模态搜索、post-training、电商 Agent | [多模态搜索职位](https://www.nowcoder.com/jobs/detail/371657)，`A-Relay` |
| 小米 | 2025 届春招 | 手机端大模型、多模态助手、搜索/规划/推荐 | [手机大模型职位](https://www.nowcoder.com/jobs/detail/384443)，`A-Relay` |
| 网易/有道 | 2025 春招 | 教育大模型、低成本高质量数据、语音多模态、游戏 AIGC/NPC | [有道春招简章](https://jdjyw.jlu.edu.cn/mportal/recruit/details?id=607a6addf84e405683b7dbba6f36fac3)，`A-Relay` |
| 哔哩哔哩 | 2025 春招 | 视频理解、多模态、搜广推；具体大模型岗历史页有限 | [高校转发春招](https://ee.seu.edu.cn/2025/0308/c25267a520920/pagem.htm)，`A-Relay` |
| 上海人工智能实验室 | 2025 届全职、2026 届转正实习 | 基础模型、多模态、具身、安全可信、AI4S、基础平台 | [实验室官方春招](https://www.shlab.org.cn/news/5444067)，`A-Official` |
| 北京智源 | 2025 届“智星”计划 | 大模型、开源系统、行业模型、AI for Science | [高校转发简章](https://jdjyw.jlu.edu.cn/portal/recruit/details?id=873ccde079914f0692f445f00ddd4c28)，`A-Relay` |
| 微软研究院 | 2025 LLM Research/Engineering 实习 | 多模态、云系统、Text2SQL、代码智能 | [Microsoft Research 官方岗位](https://www.microsoft.com/en-us/research/opportunity/llm-research-engineering-intern/)，`A-Official` |
| 腾讯 | 2025 全模态生成式推荐竞赛，可产生校招机会 | 全模态生成式推荐 | [腾讯官方新闻](https://www.tencent.com/zh-cn/tencent-hosts-chinas-first-all-modal-generative-recommendation-competition-attracting-more-than-6000-students-worldwide/)，属于竞赛入口，不是常规网申 |
| 智谱 | 2025 届春招/日常岗位 | 大模型、多模态生成、RLHF、Reward/Critique、蒸馏量化 | [25 届多模态生成算法职位](https://www.nowcoder.com/jobs/detail/391712)，`A-Relay` |
| 阶跃星辰 | 2025 团队滚动招聘 | 视觉生成后训练、Reward Model、PPO/GRPO、训练框架 | [团队招聘帖](https://www.nowcoder.com/creation/subject/443d9f84025740d885b459e38eda0a5c)，身份未由官网交叉验证，`B-Weak` |

### 2.1 2025 年应怎样使用

- 用历史 JD 识别团队长期能力结构，不再点击旧链接盲投。
- 2026 届候选人应把 2025 年 3–5 月实习、7–10 月秋招面经放在同一届别下，但保留自然时间。
- 2025 年年底发布的“26 届面经”仍是 2026 届秋招，不是“2026 年面经”。

---

## 3. 2026 自然年：当前招聘版图

### 3.1 当前主力已经转为 2027 届

截至 2026-07-30，能从官方页直接确认的典型状态如下：

| 公司/项目 | 当前页能确认什么 | 状态判断 | 官方入口 |
|---|---|---|---|
| 字节 Seed | 2027 届应届生为 2026-09 至 2027-08 毕业；实习面向 2027-09 及以后毕业；方向覆盖基础模型、系统、视觉、语音、AI 搜索、个性化、具身 | 当前有效；官网还明确一般为 3–5 轮技术面 + 1 轮 HR，具体以 HR 为准 | [Seed 大模型人才校招](https://seed.bytedance.com/zh/seedearlycareer)、[2026-04-01 启动公告](https://seed.bytedance.com/zh/blog/bytedance-seed-2027-foundation-model-campus-recruitment-is-now-open-internships-included) |
| 百度 | 校招面向 2027 届；2027 暑期实习已结束，日常实习全年开放且不限毕业时间；大模型岗位覆盖预训练、后训练、数据、Agent、多模态 | 校招/日常实习可查；具体岗位逐条核验 | [校园职位](https://talent.baidu.com/jobs/list?projectType=1)、[实习职位](https://talent.baidu.com/jobs/list?recruitType=INTERN) |
| 美团 LongCat | 基础模型、Infra、Agentic 模型训练、多模态/具身、模型评测；页面有校招/实习 Q&A | 当前专项页有效；未从静态正文确认统一截止日 | [LongCat 人才招聘](https://zhaopin.meituan.com/longcatprogram) |
| MiniMax | 2027 校招、2028 转正实习、全年日常实习、Top Talent 全年开放 | 当前有效 | [MiniMax Careers](https://www.minimaxi.com/careers) |
| 智谱 | 官网有校招算法、校招研发；算法强调训练框架与策略，研发包括 RL 训练框架 | 当前有入口；具体职位和届别以落地页为准 | [智谱加入我们](https://www.zhipuai.cn/zh/joinus) |
| DeepSeek | 官方动态页覆盖预训练、后训练、多模态、数据、AI 搜索、Agent Infra、训练/推理框架等 | 持续招聘；不能自动等同“2026 届专项校招” | [DeepSeek 招聘](https://talent.deepseek.com/) |
| 月之暗面/Kimi | 官方 Careers 为动态岗位页 | 持续核验；当前公开 Web 难以确认统一校招批次 | [Kimi Careers](https://careers.kimi.com/) |
| 阿里 | 官网当前校招对象已切换到新届别，动态前端可能不保留历史批次 | 当前岗位逐条核验 | [阿里校园招聘](https://campus-talent.alibaba.com/) |
| 华为 | 官网当前实习/校招按学历与地区给出不同毕业区间 | 当前岗位逐条核验，不抄第三方统一口径 | [华为校园招聘](https://career.huawei.com/cn/campus-recruitment) |
| 腾讯 | 官网仍显示 2026 校招、春招、海外校招和全年在校实习入口，部分页面可能为项目残留 | 对具体项目和岗位做登录后核验 | [腾讯校园招聘](https://careers.tencent.com/campusrecruit.html) |

### 3.2 2026 届补录、春招与残留页

| 公司 | 公开信号 | 正确解读 |
|---|---|---|
| 小红书 | 官网仍可检索 `2026校招` 大模型应用、训练/压缩/推理 Infra，及 `2026春季校园招聘` 增长方向职位 | JD 内容可信；“投递简历”按钮不等于批次仍有效，必须实际登录验证 |
| 小米 | 官网仍展示 2026 届春招口径 | 动态页面存在口径异常的可能，不复制毕业区间，投前核验 |
| 科大讯飞 | 2026-05 仍有 2026 届春招补录公告，飞星计划面向算法人才 | [高校转发补录公告](https://careercenter.hkust-gz.edu.cn/2026/05/29/%E6%A0%A1%E6%8B%9B-%E7%A7%91%E5%A4%A7%E8%AE%AF%E9%A3%9E-2026-%E5%B1%8A%E6%A0%A1%E5%9B%AD%E6%8B%9B%E8%81%98%E3%83%BB%E6%98%A5%E6%8B%9B%E8%A1%A5%E5%BD%95%E5%85%AC%E5%91%8A/)，历史事件，不代表 7 月仍开放 |
| 哔哩哔哩 | 2026 春招同时包含 2027 暑期实习，技术方向含搜广推、大模型、游戏算法 | [高校转发公告](https://power.seu.edu.cn/_t1654/2026/0311/c33447a557821/page.psp)，注意两个届别并存 |
| 京东 | 2026-04 的官网动态职位可见大模型、多模态、全模态 RL Infra | 页面未充分证明是 2026 届校招，按具体职位而非统一批次记录 |
| 网易有道 | 高校托管简章可见大模型、多模态 LLM、Agent、ASR | PDF 标题、正文和页面元数据可能冲突，需下载首页人工核验 |

### 3.3 2026 年岗位方向的共同变化

- 基础模型：稀疏/MoE、长上下文、数据治理、训练稳定、模型/数据/系统协同。
- 后训练：SFT、偏好数据、DPO、PPO/GRPO、RLVR、异步 rollout、Agentic RL、Reward/Verifier。
- 应用算法：RAG、Search Agent、Coding Agent、Memory、工具调用、DeepResearch、生成式搜索/推荐。
- 多模态：图文/音视频统一建模、VLM/VLA、视频生成、跨模态检索、GUI/具身 Agent。
- 评测与安全：动态 benchmark、LLM-as-a-Judge、内容安全、Prompt Injection/Jailbreak、多模态 AIGC 识别。
- 模型优化/Infra：分布式训推、KV Cache、量化/蒸馏/剪枝、低精度、通信与算子；若不投纯 Infra，只掌握对算法实验有效性的边界。

---

## 4. 核心公司：招聘方向、面试和笔试信号

表中的“面试信号”来自个人公开复盘，只能用于定向准备；“未见统一笔试证据”不表示没有笔试。

| 公司 | 岗位方向 | 公开面试信号 | 编程/笔试信号 | 准备重点 |
|---|---|---|---|---|
| 字节跳动/Seed | 基础模型、后训练、多模态、AI Search、Agent、数据、安全 | 项目/论文；数据合成清洗；RoPE/MHA；DPO/GRPO；RAG；DeepSpeed；Agent 终止与评测 | MHA、岛屿/DFS、字符串、DP；不同 BU 是否有统一笔试不确定 | 准备一份完整“数据→训练→后训练→评测”链和两次模型手写 |
| 阿里/通义/蚂蚁 | Qwen、模型对齐、电商多模态搜索、Agent、金融/生产系统 | PPO/DPO/GRPO；LoRA/QLoRA；量化；MLA/MoE；RAG/Memory；权限/事务/fallback | 算法题、AI Coding、场景设计；没有可靠的全公司固定卷型 | 一半模型训练，一半业务闭环；蚂蚁额外准备安全、审计和一致性 |
| 腾讯/混元 | MoE/多模态、对话、推荐、游戏与内容 Agent | 项目/论文；MoE；LoRA；FlashAttention；CoT 数据；PPO/GRPO；多 Agent | 字符串/括号、树/DP；轮次因团队差异大 | 读目标团队技术报告，训练显存与多模态场景都要能算/设计 |
| 百度/文心 | 基础模型、后训练、Coder、搜索/RAG、多模态、Agent | 数据与训练；PPO/DPO/GRPO；RAG/幻觉；CLIP；异步 rollout；现场最小 SFT | 常规算法 + 模型手写；当前暑期实习已结束但日常实习开放 | 搜索/检索与生成不能割裂；准备责任归因实验 |
| 华为 | 盘古、行业模型、昇腾训推、多模态、Agent、模型数据/评测 | 数学与传统 DL；Transformer；显存；训练并行；项目；部分团队问 SFT/Prompt | 个体样本为机试后测评、技术面、主管面；机试常见栈/哈希/堆 | 先按 JD 区分算法与 CANN/HCCL/算子岗；机试单独练 ACM |
| 美团/LongCat | 基础模型、Agentic RL、多模态/具身、评测、业务 Agent | 项目深挖；SFT→RL；Reward/Reward Hacking；PPO/DPO/GRPO；MoE | 一份 2025-08 个体样本为 8 道 ML 选择 + 4 道编程；不能外推所有批次 | 强化数据、reward、业务指标和失败实验；传统 ML 不丢 |
| 快手/可灵 | 视频/多模态、LLM 应用、Agent/RL、推荐、压缩 | MHA/RMSNorm/KV Cache；推理加速；数据去重；Instruction Tuning；LoRA；DAPO | 26 届亲历两轮含字符串全排列、树序列化；另有编辑距离等 | 视频/VLM 与模型基础并重，准备至少两道中等算法 |
| 京东 | 零售大模型、多模态、RAG、后训练、模型优化 | SFT/PEFT；PPO/DPO/GRPO；量化；PagedAttention；Prefix Cache；RAG 切片 | 字符串、数组、LRU 等个人样本；固定笔试口径未核验 | 解释精度—吞吐—成本 Pareto，别只列优化名词 |
| 小红书 | 基础/应用大模型、生成式搜广推、Agent、内容安全、训推压缩 | 项目深挖；RAG/Agent/MCP/Skill；RL；多模态；内容安全 | 常规算法与模型组件均有个体样本；官网 JD 明确强调 coding | 独立问题定义、Web Scale 数据、生成式推荐/搜索和安全 |
| 拼多多/Temu | 电商大模型、推荐后训练、风控、Agent | Transformer；RL；推荐×LLM；业务指标；SQL/传统 ML | 公开个体样本整体偏强算法、SQL、组合题；不是统一原题库 | 传统算法、SQL、AUC/KS 与 LLM 一起准备 |
| 小米 | 端侧/手机大模型、多模态、个人助手、搜索规划 | 3D/多模态、端云取舍、Attention、项目 | self-attention、链表/数组等个体样本 | 端侧延迟/功耗/隐私与模型效果四方权衡 |
| 网易/有道 | 游戏 AIGC/NPC、教育大模型、语音、多模态 | response-only SFT、蒸馏、RAG 目标错配、Agent、数据 | 图/树/DP 与模型手写并存 | 将生成质量、可控性、安全与游戏/教育业务指标连起来 |
| 哔哩哔哩 | 视频理解、多模态内容、搜广推、大模型 | DPO 理论、Agent/DeepResearch、多模态内容 | 算法与搜广推基础仍重要 | 视频长序列、内容安全、推荐指标和 DPO 失败 |
| OPPO/vivo/荣耀 | 端侧、多模态、Agent、手机助手 | GSPO/GRPO、MoE、DeepResearch、VLM、Reward Hacking | 常规算法题 | 端云协同、模型压缩、多模态交互和业务约束 |
| 滴滴/携程 | 出行/旅行大模型、客服、推荐、Agent | RAG、基座选择、SFT 失败、Agent、数据构造 | 图/树/SQL/ML Coding | 业务约束、实时性、地理/时序特征和线上指标 |

### 4.1 两个值得单独保留的亲历样本

**快手 26 届大模型应用算法，两轮技术面，`B-First`**

- [原帖](https://www.nowcoder.com/feed/main/detail/bc89e6d705794c81838dd48c4a46acd9)，发布/编辑于 2025-09-27，明确写“26 届校招”。
- 一面约 50 分钟：项目与论文、MHA、RMSNorm vs LayerNorm、KV Cache、推理加速、微调过拟合；手撕字符串全排列、二叉树序列化/反序列化。
- 二面约 40 分钟：项目深挖、生成数据去重、超大词表 Softmax 加速、中文 Instruction Tuning 数据、LoRA vs Prompt Tuning。
- 作者带项目辅导推广，因此只保留为单个候选人样本，不升格为“快手固定两轮/固定题单”。

**智谱大模型 90 分钟一面，`B-Weak`**

- [原帖](https://www.nowcoder.com/feed/main/detail/e546ae199c7c417d88c9b468e42a6d50)，2025-06-08。
- 题型覆盖 tokenizer/RAG 伪代码、NL2SQL、PPO/DPO/GRPO、KL estimator、LoRA/P-tuning v2、DeepSeek-R1/MLA、PyTorch 与多机多卡。
- 账号同样带辅导导流，适合发现准备缺口，不用于估计智谱频率。

---

## 5. 大模型公司、研究机构和其他规模公司

| 公司/机构 | 招聘与岗位事实 | 面经证据现状 | 应用方式 |
|---|---|---|---|
| 智谱 | 官网当前有校招算法/研发，涉及训练策略与 RL 框架 | 2024 全流程、2025 应用算法、2026 Agent 样本；另有 AI Infra 样本 | 模型/Agent 岗重点准备 RL、MoE、长程任务、流式工具调用 |
| MiniMax | 当前明确 2027 校招、2028 转正实习、日常实习与 Top Talent | 2025 有一条 7 天内两技术面+HR+Offer 的流程帖，但岗位未明；历史算法样本较少 | 用官网 JD 和技术报告反推，不把未知岗位流程当算法岗证据 |
| DeepSeek | 官方动态招聘覆盖模型、数据、AI 搜索、Agent、系统 | 未找到满足“2026 届/明确算法岗/候选人亲历/可确认日期”的强闭环 | 读官方岗位和技术报告；不采用“只问实战不问八股”媒体口号 |
| 月之暗面/Kimi | 官方 Careers 动态招聘；国家就业平台曾有多模态 RL 实习 | 2025 可核验内容多为开发/Infra；算法亲历闭环不足 | 按具体 JD 准备，对齐/RL/数据构造与 Kimi 场景 |
| 阶跃星辰 | 2025 团队帖有 RL for AIGC；2026 有 LLM/语音/多模态实习转发 | 2026 聚合页有 LoRA/DPO/Agent/MoE/RLVR 题型，但多为个人聚合 | 降级为题型候选池，投递状态回到官方/招聘方 |
| 百川 | 搜索到的 2026 实习面经只有标题残留，正文不可取 | 2025 强样本不足；2024 样本不能伪装成 2025 | 暂不构造公司题库 |
| 面壁 | 2025 有候选人自述拿到基座团队 Offer | 无题目和轮次 | 只能证明当时存在招聘活动 |
| 商汤 | 有动态实习/校招转发 | 统一批次和算法亲历不足 | 官网或公众号人工核验 |
| 科大讯飞 | 2026 届春招补录、飞星计划有高校转发 | 有 NLP/语音/行业模型样本 | 传统语音/NLP 与大模型结合准备 |
| 上海 AI Lab | 2025 春招官方覆盖大模型、多模态、具身、安全、AI4S | 研究型面试更看论文和实验 | 准备 research talk、可复现实验和开放问题 |
| 北京智源 | “智星”计划覆盖大模型及开源系统 | 面经公开量少 | 读目标研究方向和开源项目 |
| 理想/蔚来/小鹏 | 视觉基座、VLM/VLA、Agent、端侧/车端 | 有 Transformer/Tokenizer、GSPO/DAPO、投机采样、多模态系统样本 | CV/3D 背景候选人的重要交叉投递池 |

---

## 6. 面试流程与高频考点

### 6.1 安全的流程概括

```text
官方投递/内推
  → 简历与团队匹配
  → 可能的统一笔试、机试或测评
  → 1–3+ 轮技术面（研究专项可能更多）
  → 主管/综合面
  → HR/意向/审批
```

- 这是跨样本概括，不是任何公司的承诺。
- 字节 Seed 当前官方页明确“一般 3–5 轮技术面 + 1 轮 HR”；这条只适用于该专项且仍以 HR 安排为准。
- 华为个体样本常见“机试→测评→技术面→主管面”，但部门和岗位会改变流程。
- AI 创业公司可能推进很快，也可能增加论文/代码审查、加面或交叉面。

### 6.2 2025—2026 共同考查链

1. **项目真实性**
   - 问题和用户是谁；
   - 数据从哪里来，规模、许可、污染和 split；
   - baseline 为什么合理；
   - 模型、超参、卡数、时长、成本；
   - 提升是多少，置信区间/显著性如何；
   - 最大失败和 bad case；
   - 个人贡献怎样由 commit、实验和决策证据支撑。
2. **模型结构与训练**
   - Attention shape/mask/scale，MHA/MQA/GQA/MLA；
   - RoPE、RMSNorm、SwiGLU、MoE；
   - 数据清洗、去重、混合、Tokenizer；
   - DDP/ZeRO/FSDP/TP/PP/EP、显存、混合精度、FlashAttention；
   - prefill/decode、KV Cache、PagedAttention、量化/蒸馏。
3. **后训练**
   - response-only SFT、LoRA/QLoRA；
   - RM、PPO、DPO、GRPO 的数据流和角色；
   - KL、clip、group normalization、policy lag；
   - Reward Hacking、熵坍缩、离线/在线指标。
4. **Agent/RAG**
   - sparse/dense/hybrid retrieval、chunk、rerank；
   - 责任归因、工具 schema、超时重试、幂等和 fallback；
   - Memory、终止条件、循环检测、知识库热更新；
   - pass@k/pass^k、任务终态、LLM-as-a-Judge 一致性和安全。
5. **传统基础**
   - 树、图、DFS/BFS、字符串、DP、哈希、堆；
   - LR/GBDT/XGBoost、AUC/校准、样本不平衡；
   - 搜广推的召回/排序、负采样、曝光偏差；
   - SQL 窗口函数、留存/连续登录、Top-N、累计指标；
   - 概率、期望、矩阵、优化器。

### 6.3 2026 相对新增的准备动作

- 能从代码层解释 $\pi_\theta$、$\pi_{old}$、$\pi_{rollout}$、$\pi_{ref}$，而不是只背算法名。
- 能设计 Agent 的成功终态、预算、失败恢复和外部 verifier。
- 能把数据质量问题量化：去重率、污染、切片、分布漂移、拒答与安全。
- 能现场写一个最小正确的模型组件，并说明 mask、数值稳定、dtype/device、梯度和边界。
- 能回答“为什么不用另一个方案”，给出最小消融和成本比较。

---

## 7. 笔试与手撕：能确认什么

### 7.1 公开个体样本

| 来源 | 样本描述 | 可用于训练 | 不能外推 |
|---|---|---|---|
| [美团算法策略笔试](https://www.nowcoder.com/feed/main/detail/b3f49e87bf1944d08ac623e8b6044c67) | 2025-08 个体样本：8 道 ML 选择 + 4 道编程，涉及朴素贝叶斯、图论、计数等 | 一场“ML + 编程”混合模拟 | 美团所有算法岗都固定为此题量 |
| [快手 26 届大模型应用算法](https://www.nowcoder.com/feed/main/detail/bc89e6d705794c81838dd48c4a46acd9) | 面试手撕字符串全排列、二叉树序列化/反序列化 | 字符串回溯、树编码 | 快手统一笔试题 |
| [华为 2025 届 AI 软开流程](https://www.nowcoder.com/feed/main/detail/d40fbf4776b14c6fb63828b0124eee32) | 候选人自述机试含栈/哈希/堆，之后测评与多轮面试 | 三题 ACM 风格模拟、输入输出与部分分 | 华为所有大模型算法团队相同 |
| [智谱 2025 大模型](https://www.nowcoder.com/feed/main/detail/e546ae199c7c417d88c9b468e42a6d50) | tokenizer/RAG 伪代码，后续大量模型问题 | 模型 coding + 解释 | 智谱固定 90 分钟或固定题单 |

### 7.2 建议练成的题型篮子

- 传统算法 P0：哈希、滑窗、二分、树/图、BFS/DFS、堆、链表、基础 DP。
- 竞赛增量：DSU、Fenwick、二分答案、差分、最短路、状态压缩。
- 模型手写：stable softmax、RMSNorm、RoPE、MHA/GQA、SFT loss、DPO/GRPO、top-k/top-p、MoE、LoRA。
- ML Coding：LR/IRLS、AUC、决策树桩、Viterbi、KFold 防泄漏、检索指标。
- SQL：窗口函数、连续行为、分组 Top-N、留存、漏斗、累计首次达成。

本仓库对应入口：

- [纯力扣算法路线](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/%E7%BA%AF%E5%8A%9B%E6%89%A3%E7%AE%97%E6%B3%95/README.md)
- [模型手写核心实现](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/AI%E7%AE%97%E6%B3%95/%E6%A8%A1%E5%9E%8B%E6%89%8B%E5%86%99/templates/llm_interview_coding.py)
- [传统 ML、搜广推与 SQL 专项](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/AI%E7%AE%97%E6%B3%95/%E7%9F%A5%E8%AF%86/%E4%BC%A0%E7%BB%9FML_%E6%90%9C%E5%B9%BF%E6%8E%A8_SQL%E4%B8%93%E9%A1%B9.md)
- [LLM 题库与证据](/blog/llm-algo-interview-evidence/)

---

## 8. 社交平台扩大检索后的结论

### 8.1 平台可用性

| 平台 | 本轮结果 | 证据策略 |
|---|---|---|
| 牛客 | 最容易取得作者、发布日期、正文和轮次；也存在培训引流、拆帖重发和合集账号 | 优先收一手；检查作者历史、岗位/日期、评论纠错；推广帖降级 |
| 知乎 | 找到通义、跨公司求职总结、快手招聘转发、2026 大模型题型合集 | 个人完整复盘可用；机构号、培训号和搜索摘要只作 `C-Lead` |
| 小红书内容平台 | 对 `site:xiaohongshu.com/explore` 定向搜索未取得可验证的面经正文；搜索引擎常把“小红书”识别为公司招聘站 | 不从无法打开的图片/摘要提取题目；可人工在 App 内按关键词复查 |
| CSDN | 可找到个人博客和搬运题库；推荐时间常被误当原文时间 | 原创全流程可用；跨平台题库必须追到原帖 |
| 博客园 | 命中多为结合 JD、技术报告和牛客扩写的模拟题 | 作为练习题，不标“真实面经” |
| 微信公众号 | 原文、图片海报和发布时间不易被稳定索引 | 保存官方原文/二维码截图时人工记录日期；媒体转述不能冒充官方 |
| 一亩三分地 | 可补 MiniMax 等历史招聘/流程 | 登录墙和摘要限制较多；不从标签页推断完整题目 |

### 8.2 具体新增线索

- [知乎 2026 大模型项目追问汇编](https://zhuanlan.zhihu.com/p/2039673415901106968)提到量化精度恢复、RAG 延迟、Agent fallback 等，但作者为机构号且没有稳定原帖映射，只作为 `C-Lead`。
- [知乎快手 2026 届招聘转发](https://zhuanlan.zhihu.com/p/1996586527384413230)声称部分热推岗免笔试；并非快手官方账号，不能当统一规则。
- [知乎 Agent 面经索引](https://zhuanlan.zhihu.com/p/2001762598350247368)适合继续发现原帖，但它本身是链接合集，不能计作独立样本。
- [CSDN 快手多模态题库](https://blog.csdn.net/ZHHHHH15/article/details/160497336)声称汇总 2025—2026 面经，但无逐题原帖映射，归入练习池而非证据账本。
- [博客园 Kimi AI Infra 题库](https://www.cnblogs.com/xmwblogs/p/19669357)混合技术报告和模拟题，不作为 Kimi 真实面经。

### 8.3 在 App 内人工补查时的关键词

```text
公司名 + 26届/27届 + 大模型算法 + 面经
公司名 + 暑期实习/提前批/春招补录 + LLM/Agent/VLM
团队名 + 一面/二面/笔试/机试 + 日期
岗位名 + OC/offer/挂 + 项目深挖/手撕
```

人工记录时必须保存：帖子链接或分享 ID、作者、发布日期、作者自述面试日、届别、岗位、轮次、是否推广、是否有评论纠错。只有截图而无可追溯 ID 时标 `C-Lead`。

---

## 9. 按岗位方向的准备矩阵

| 能力 | 基础模型 | 后训练/RL | Agent/RAG | 多模态 | AI Infra/优化 |
|---|---:|---:|---:|---:|---:|
| 数据治理/Tokenizer | P0 | P0 | P1 | P0 | P1 |
| Transformer/RoPE/Norm/MoE | P0 | P0 | P1 | P0 | P0 |
| 显存/并行/混合精度 | P0 | P0 | P1 | P1 | P0 |
| SFT/LoRA/DPO/PPO/GRPO | P1 | P0 | P0/P1 | P1 | P1 |
| RAG/Tools/Memory/Eval | P2 | P1 | P0 | P1 | P2 |
| CLIP/VLM/视频数据 | P1 | P2 | P1 | P0 | P1 |
| 推理/KV Cache/量化 | P1 | P1 | P1 | P1 | P0 |
| 传统 ML/搜广推/SQL | P1 | P1 | P0（业务岗） | P1 | P2 |
| LeetCode/ACM | P0 | P0 | P0 | P0 | P0 |
| 论文与实验答辩 | P0 | P0 | P1 | P0 | P0 |

`P0` 必须闭环，`P1` 按 JD 补齐，`P2` 只保底。目标不是每列都学满，而是形成“一条主线 + 一条相邻线 + 传统基础不掉线”。

---

## 10. 对当前资料库的查漏补缺

### 10.1 已有强项

- 证据分级严谨，明确“个人面经不等于公司频率”。
- Transformer、训练/推理、SFT/DPO/PPO/GRPO、Agent/RAG、评测和排障正文完整。
- 传统算法从 Hot100 延伸到 DSU、Fenwick、MITM、MST 等进阶骨架。
- 项目规划已经包含 baseline、消融、止损门、数据 lineage 和 GPU 预算。

### 10.2 本轮已经补上的缺口

- 新增独立求职情报层，不再把动态招聘窗口塞进知识指南。
- 新增年份/届别口径、公司覆盖矩阵、2025/2026 招聘事件和社交平台证据边界。
- 新增[招聘窗口与刷新日志](/blog/recruit-window-refresh-log/)，集中处理过期和状态变化。
- 新增[传统 ML、搜广推与 SQL 专项](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/AI%E7%AE%97%E6%B3%95/%E7%9F%A5%E8%AF%86/%E4%BC%A0%E7%BB%9FML_%E6%90%9C%E5%B9%BF%E6%8E%A8_SQL%E4%B8%93%E9%A1%B9.md)。
- 新增[多模态大模型专项](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/AI%E7%AE%97%E6%B3%95/%E7%9F%A5%E8%AF%86/%E5%A4%9A%E6%A8%A1%E6%80%81%E5%A4%A7%E6%A8%A1%E5%9E%8B%E4%B8%93%E9%A1%B9.md)，补视觉 token、训练数据、grounding、视频/3D 和评测。
- 新增零依赖[模型手写核心实现](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/AI%E7%AE%97%E6%B3%95/%E6%A8%A1%E5%9E%8B%E6%89%8B%E5%86%99/templates/llm_interview_coding.py)及自动测试，覆盖最高频核心件。
- 将 30 天计划从当前日期重排，并移除已过期 deadline。

### 10.3 仍需你用真实产物完成的缺口

- 至少四场计时套卷的真实分数、错题和 24 小时/7 天复写记录。
- 17 项模型手写的“盲写通过日”，不能用“看懂参考实现”代替。
- 一个项目从规划文档推进到可运行 baseline、结果 JSON、失败案例和复现命令。
- 根据你的最终主投方向，在后训练、Agent、多模态三者中选一条做深，不继续平均扩写文档。
- 面试后 30 分钟内回填真实题目；敏感业务、面试官信息和公司保密内容不得记录或传播。

---

## 11. 每周刷新协议

每周一和周四各 20 分钟：

1. 打开[招聘窗口与刷新日志](/blog/recruit-window-refresh-log/)中的官方入口；
2. 只记录新批次、截止日变化、岗位新增/关闭和毕业区间；
3. 搜索过去 7 天的牛客/知乎/小红书 App 亲历；
4. 对重复题只增加来源 ID，不重复抄题；
5. 将 `last_checked` 更新为当天，过期项改为 `closed` 或 `stale`；
6. 只因两个以上独立强样本才调整准备优先级；
7. 新 JD 到来时优先修改投递矩阵，不因单篇面经重写整套计划。

投递当天再核验一次资格、地点、岗位 ID 和截止时间。任何付费内推、索要账号密码或要求向私人邮箱发送敏感材料的渠道一律放弃。

---

## 12. 2026-08-13 增量刷新

### 12.1 招聘版图变化：2027 届正式批全面开闸

2026-08 第一周起，字节（8.3）、京东（8.3）、B站（8.3）、阿里集团（8.4）、美团北斗（8.5）、蚂蚁（8.10）、腾讯（8.11）相继全面启动 2027 届校招；拼多多提前批 8.23 截止、阿里星 8.23 截止。逐公司启动日期、投递机制（字节 4 次投递、专项不占次数等）与策略移至新文档[《2027 届秋招时间线与投递策略》](/blog/qiuzhao-2027-timeline-strategy/)统一维护，本文不再扩写；动态状态仍看[窗口日志](/blog/recruit-window-refresh-log/)。

### 12.2 新增面经样本

| 样本 | 内容要点 | 分级 |
|---|---|---|
| [腾讯 WXG 暑期大模型算法](https://www.nowcoder.com/discuss/891322059656052736)（转载于汇总帖内） | 一面 2.5h：手撕 AdamW、两道 SQL、海量数据清洗与敏感词处理、Q-learning vs DQN；二面 2.5h：GRPO/PPO/RM/MDP 追问、bf16/fp16/fp32 计算、LoRA 细节、手撕 PPO、算 MDP 折扣阈值（无穷级数）、算 SFT 参数量与显卡利用率、相交链表、全连接层输出基底趋近正交基的开放题；三面为面委会（两篇顶会论文答辩+RL 趋势）；HR 面 | `B-First`（转述自一手，轮次时长完整） |
| [26 届秋招字节大模型算法三轮](https://www.nowcoder.com/feed/main/detail/87dfef5fdef64f77a1d7e294c28626dd) | 一面：训练数据构造 Pipeline 场景题+编辑距离；二面：GRPO、DeepSeek-R1 奖励函数与两阶段训练、MHA 原理、Agent 项目、手撕 MHA；三面：RL 如何落到业务+再撕 MHA | `B-Weak`（带辅导推广） |
| [阿里大模型算法（RAG 项目深挖 16 问）](https://www.nowcoder.com/feed/main/detail/805f901bae8844fcba673f8e36bf9543) | 分块策略、embedding 选型、rerank 算法、微调数据格式与显卡占用、幻觉处理、Transformer 三架构应用场景、llama2 结构与位置编码、训练资源、langchain、显存优化、主流模型 loss 对比、半精度、DeepSpeed；手写 GQA + 合并 K 个升序链表 | `B-Weak`（带辅导推广，题目结构完整可作深挖预演清单） |
| [阿里大模型一面 GRPO 深挖复盘](https://yunpan.plus/t/23865-1-1) | GRPO loss 逐项写出并解释（ρ_t、组内标准化 A_t、min/clip、β·KL）、追问 ε=0.2 从哪来、Reward Hacking 应对（人工抽检+多 RM 集成）、信用分配 | `B-Weak`（平台转载，技术内容与原论文一致） |
| [DeepSeek 大模型算法岗笔试帖 2026-07-26](https://www.nowcoder.com/discuss/913482312753418240) | 手写完整 MHA（不能只写框架）、DPO 全流程推导、MoE 通信开销与负载不均衡、vLLM PagedAttention+投机解码、DeepSeek-V4 KV 缓存压缩计算、DeepSeek MoE 无辅助损失负载均衡推导；另提及 2026-07-12 Agent 开发岗实习机考 | `C-Lead`（含题库广告，无法确认为真实卷面；作为练习池） |

### 12.3 考点趋势增量（相对 §6.3）

- 手撕从"MHA/softmax"扩展到**优化器（AdamW）与完整 PPO 训练循环**；SQL 开始出现在大模型算法面试里（WXG 样本）。
- 追问深度进入"计算层"：现场算 MDP 折扣阈值、SFT 参数量、显卡利用率、混合精度数值——对应 30 天计划 B 线的显存/参数量口算训练。
- 公司自研模型的技术报告成为题源（DeepSeek-V4 KV 压缩、R1 两阶段奖励、无辅助损失负载均衡）→ 面试前 48h 必读目标公司最新报告（信息源手册 §5 有清单）。
- Agent 方向考"工程化生态"（Harness、Skill、终止与评测）的频率继续上升，与 DeepSeek 扩招方向一致。

### 12.4 新增信息源

GitHub 面试仓库（wdndev/llm_interview_note、laoshan-song/Awesome-LLM-Interview、MisterBooo/llm-interview-questions、Meko1/llm-interview-guide、adongwanai/AgentGuide、WeThinkIn/AIGC-Interview-Book 等）经核验真实活跃，已连同组织情报、薪资、技术跟进渠道一并整理进[《信息源清单与检索手册》](/blog/job-hunt-info-sources/)；使用纪律与本文 §1 证据分级一致。
