---
title: "2025–2026 国内大厂 Agent 面经：从 RAG 到 Harness Engineering"
description: "基于公开一手面经、官方岗位与结构化旁证，梳理国内大厂 Agent 岗年度变化、公司画像、硬题答法、题单和 14 天准备路线。"
date: 2026-08-30
tags:
  - coding-agent
  - interview
  - agent-harness
  - career
featured: false
draft: false
lang: zh-CN
series: coding-agent-source-analysis
seriesOrder: 11
---
> 检索截止：2026-08-30。本文覆盖公开的一手面经、官方招聘/JD、公司技术文章和两份结构化面经索引，并结合本项目对 Pi、OpenAI Codex、DeepSeek Harness、Claude Code 的源码分析。它是一份准备指南，不是任何公司的官方题库。

## 先说结论

2025 到 2026 的变化，不是 RAG、Transformer 和后端基础突然不考了，而是面试官开始把问题继续向模型外面的控制系统推进。

2025 年公开样本的共同底座主要是：Transformer/Attention、LoRA/SFT/DPO/PPO/GRPO，RAG 的切块、Embedding、混合检索与 Rerank，ReAct、Function Calling、LangChain/LangGraph，以及项目深挖、算法和数据库/缓存/消息队列。2025 年第四季度已经有少量深题进入 Claude Code/Cursor 上下文压缩、Reflection、工具失败归因和多 Agent；因此这里不是“2026 突然发明新范式”的断崖式切换。

2026 年这些内容仍然存在，变化在于下面这些主题开始跨公司、跨岗位反复出现，并被当前 JD 明确写成 Runtime/Harness 能力：

- Agent Loop 与 Harness/Orchestrator 的边界；
- Prompt Engineering、Context Engineering、Harness Engineering 的演进；
- Coding Agent 的上下文装配、压缩、Checkpoint、恢复和路径震荡；
- Skill、Tool、Function Calling、MCP、A2A 与 Subagent 的边界；
- 工具越权、Human-in-the-loop、Permission、Sandbox、凭证隔离与审计；
- 多 Agent 的共享状态、并发、取消、预算和文件冲突；
- Outcome、Trajectory、Tool、Safety、Latency、Token/Cost 的分层 Eval；
- Claude Code、Codex、DeepSeek Harness、OpenClaw、Hermes 等真实系统的架构或源码比较；
- AI Coding/Vibe Coding/Spec Coding 作为口头题，甚至直接进入现场编码或正式机考。

因此，2026 年的分水岭已经从“会不会用框架搭一个 Demo”，移到“能不能解释控制面、失败路径和验证证据”。但另一个同样重要的结论是：**传统工程基础没有消失**。京东、华为、美团、腾讯、蚂蚁、拼多多等样本仍在同一轮里考 Java/Go/Python、并发、MySQL/Redis/MQ、网络、操作系统和手撕算法。

还有一条比“厂味”更可靠的规律：**岗位类型通常比公司名称更能预测题目。** 同一家公司里的 Agent 应用开发、Agent 算法/RL、Agent Runtime/Harness，题目差异往往大于不同公司同类岗位之间的差异。

## 一、证据怎么筛

### 1. 证据等级

| 等级 | 来源 | 能证明什么 | 不能证明什么 |
|---|---|---|---|
| A | 公司官网、官方 JD、官方技术文章 | 当前岗位、产品和技术方向 | 不能单独证明某道题真的问过 |
| B | 第一人称面经，有岗位、轮次、日期/时长和自然的个人复盘 | 该候选人在该团队的大概率真实经历 | 不能外推为全公司统一题库 |
| C | 保留原帖线索的汇总、开源结构化样本、可信转载 | 发现重复主题、补充检索入口 | 不能与原帖重复计数，也不能替代一手来源 |
| D | 卖课/内推引流、SEO 拼接、“每题标准答案”、标题正文公司不一致、时间矛盾 | 只作为搜索线索 | 不进入公司画像和趋势判断 |

本文特意排除了多类看起来很“完整”、实际不可靠的材料：同一账号连续发布多家公司“被问麻了”且每题附标准答案；把 2025 内容重新包装为 2026；标题写拼多多、正文却写快手；含博彩/广告域名；以及无法回溯原始面经的题库文章。

### 2. 可用的结构化旁证

开源项目 [`smile-struggler/kaomian`](https://github.com/smile-struggler/kaomian) 披露的快照覆盖 2025-03-22 至 2026-04-18：抓取 767 帖，保留 248 帖，抽取 948 个问题并归并为 638 个 canonical question。它的高频项依次包含 Agent 评估、Agent 难点、场景流程设计、指标构建、多智能体协作、上下文超窗、工具参数幻觉、记忆、工具失败/超时与 Skill。

这组统计有价值，但不能当成无误的真题数据库：流水线使用 Qwen3-VL 做筛选、OCR、结构化抽取和语义归并，仓库又没有公开全部原始帖子。因此，本文只用它证明“多个独立样本反复触及哪些主题”，不据此计算公司的精确出题率。

另一份 [`agent-interview-hub`](https://github.com/Zchary1106/agent-interview-hub) 在 2026-08-13 生成了 51 条候选索引，含来源链接或小红书站内检索提示。本文把它当作导航，并回到可访问原帖交叉核对。

### 3. 这份面经的边界

- 公开样本明显偏校招、实习和一面，社招高级岗位、主管面与内部转岗样本更少。
- 牛客很多页面只显示月日。无法从帖子、评论和招聘届次共同确认年份的条目，不用于年度趋势核心判断。
- 同一公司不同 BG、业务线甚至面试官的差异非常大。下文的“公司倾向”都是有限样本归纳。
- 源码可以证明实现机制，不能直接推出成功率、模型质量、成本或 benchmark 排名。
- Claude Code 的详细实现只以本项目验证过的 npm 2.1.88 source map 为证据；2.1.251 已是 wrapper + 原生二进制，不能把旧实现无条件外推到最新版。

## 二、先按岗位分型，再看公司

### 1. Agent 应用/全栈开发

典型任务是客服、知识问答、投研、数据分析、办公、营销、运维和企业数字员工。面试重点通常是：

- 为什么需要 Agent，而不是一次 LLM 调用或固定 Workflow；
- RAG 全链路、意图识别、Prompt/Context、Tool Calling；
- SSE/WebSocket、异步任务、数据库、缓存、MQ、限流与幂等；
- 项目是否真的上线、用户是谁、失败成本是什么、指标如何得到；
- 幻觉、超时、重试、人工接管、降级和线上排障。

### 2. Agent 算法/后训练

这类岗位不是“会调 API”即可。常见深挖包括：

- Agent trajectory 与普通 SFT 语料的差别；
- 工具调用、环境 Observation、最终回答的 loss mask；
- SFT、DPO、PPO、GRPO、RLVR 何时使用；
- reward/verifier、credit assignment、reward hacking；
- 数据合成、正负样本、长度偏差、训练—服务分布偏移；
- 规划、搜索、Memory、工具选择、长程任务与 test-time scaling。

### 3. Agent Runtime/Harness/Infra

2026 年增长最明显的一类。面试会把“模型能不能回答”转成“系统能不能稳定执行”：

- Agent Loop、Task/Turn/Step 状态机和 Early Stop；
- Context assembly、Compaction、Checkpoint/Resume、Event Log；
- Tool registry/router、动态发现、并发门、结果规范化；
- Approval、Permission、Sandbox、凭证、租户与网络/文件边界；
- Runtime、模型网关、流式、语义缓存、熔断与故障恢复；
- Trace/Metric/Log、回放、Eval、成本和容量规划。

京东当前官方 Agent 专家 JD 直接列出 Agent Runtime、上下文状态、工具/插件注册、Streaming、Semantic Cache、熔断、Eval/回放与全链路 Trace；百度官方云原生 Agent Infra 岗则出现 K8s、gVisor/Firecracker、Skill/MCP/Plugin、Harness 与 OpenTelemetry。这类岗位本质上仍是分布式系统和平台工程，只是负载变成了概率模型驱动的长链任务。

### 4. Coding/GUI/Browser/Computer-use Agent

常见问题会进一步落到环境和产物：

- 如何选择代码上下文，grep、AST/符号索引、向量检索分别做什么；
- 仓库规则、Prompt、Skill 与工具描述怎样进入 Context；
- 代码编辑、测试、Review、回滚和工作区隔离；
- 长任务如何续跑，多 Agent 如何避免同时修改同一文件；
- 浏览器/桌面 Agent 如何处理本地文件权限、截图/DOM、多模态与不可逆操作；
- AI 生成代码怎样验证，什么由人负责。

## 三、公司画像：公开样本里更常追什么

### 字节跳动

2025 年代表样本仍以 RAG 检索/排序、Prompt 评测、ReAct、LoRA/SFT、Attention、幻觉、项目指标和算法为主。[2025-04-28 的四轮面经](https://www.nowcoder.com/discuss/746382064101908480) 很典型：Leader 会继续追为什么不用闭源 SOTA、为什么尚未上线、Precision/Recall 怎么算。

到 2026 年，字节是公开样本里最早、最密集直接追 Coding Agent 控制面的公司之一：

- [2026-08-13/16 的 Agent 实习两轮](https://www.nowcoder.com/feed/main/detail/8a553bb6ea8445d0b0abe11e87614cea?sourceSSR=post) 问 ReAct/Plan、上下文溢出与保真压缩、路径震荡、Context 与长期 Memory、工具描述过多、Prompt Cache、多 Agent 通信和同时改文件；
- [2026-06-04 一面](https://www.nowcoder.com/feed/main/detail/931a8a935a5e4b4f8d0b71cd4e818604) 问三级压缩、SDD/Spec、Harness 模块和评测集过拟合；
- [2026-07-01 中国交易与广告一面](https://www.nowcoder.com/feed/main/detail/ccba40c7281f4d9197b01fe9c140b13d) 直接比较候选人项目与 Claude Code、Codex、Hermes，继续追 Harness 取舍、Skill 加载、三层记忆、Context 拼装和 Checkpoint；
- [2026 年社招多轮记录](https://linux.do/t/topic/2416951) 还出现 OpenClaw/Hermes 源码、A2A 死循环、Subagent 幻觉、共享状态、Memory/RAG 与实际用户收益。

但不要因此忽略基础：同一批面经仍有 Transformer、RL、Python、数据库、浏览器链路和算法。字节官方 Seed 招聘也把 Code Agent RL、Long-Horizon Task、Multi-Agent RL、Memory/Search 与模型/系统训练同时列出。[Seed Early Career](https://seed.bytedance.com/zh/seedearlycareer)

**准备重点：** 项目失败轨迹、上下文与压缩、Skill/Tool、长任务、Eval、多 Agent 冲突；同时按岗位补齐 RL 或后端基础。

### 阿里巴巴、淘天、阿里云与阿里国际

阿里内部业务差异很大，按集团名准备会失焦。

- **阿里云/瓴羊**更偏 Runtime 与企业工程。[2026-08-27 Agent 算法一面](https://www.nowcoder.com/feed/main/detail/3a61d09fc2fb436f9bd5c1ed99b43330?sourceSSR=users) 直接问 Agent Loop、Harness 安全/权限、长任务 Early Stop 和 DeepSeek Harness；[2026-04-10 阿里云面试](https://www.nowcoder.com/discuss/872120976190816256) 同时考 Workflow/Agent、跨机通信、RPC，并让候选人现场用 AI Coding 完成功能后人工 Review。
- **淘天/淘宝闪购**更重业务落地、研发提效和真实故障。[2026-04-30 淘宝闪购 Agent 算法一面](https://www.nowcoder.com/discuss/879393838081597440) 追框架与部署、HITL、风险分级、熔断、沙箱、审计、跨周 Memory、反馈/RL、Tool Schema 和线上 AUC 下降；2026-08 的多份样本又出现 CR Agent、Meta-Harness、DeepSeek Harness、多 Agent 测试、MQ 幂等、OOM 和算法。
- **千问/夸克**通常是模型与应用双栈。[2026-08-25 千问应用开发](https://www.nowcoder.com/feed/main/detail/da6d74a34ceb4e52b9b4fbcac25cfb3b?sourceSSR=post) 问文档切块、BM25+向量、多跳、Query Rewrite、ACL/PII、长对话摘要与 Harness 数据流；算法岗还会继续进入数据合成、后训练和模型选型。
- **阿里国际/Accio**公开社招样本更强调云端环境、Search、Worktree、Sandbox、Harness Gate、Eval/Benchmark、Context 隔离/压缩和 Token ROI。

2025 的阿里云 AI 平台面经仍以 RAG 整体链路、Transformer、Embedding、MRR 与多路召回为主；2025 下半年的淘天/夸克开始出现工具冲突、超时降级、Memory、Prompt A/B 与 RL，但 2026 才把 Harness、权限和长任务明确推到台前。

**准备重点：** 先确认 BU。阿里云准备 Runtime/权限/可观测；淘天准备业务链路、AI Coding、并发与指标；千问/夸克准备模型—应用双栈；阿里国际准备搜索、云沙箱、长任务与成本。

### 蚂蚁集团

蚂蚁的辨识度是“可信执行 + 后端基本功”。2025 蚂蚁国际面经已在问 RAG vs Fine-tuning、Rerank/NDCG、Memory、Agent Eval、MCP/A2A；到 2026，安全与全自动链路被问得更具体：

- [2026-05-20 智能体/LLM 应用一面](https://ac.nowcoder.com/discuss/1646420?type=0) 问 Skill、Spring AI、Claude Code/Harness 源码、grep vs RAG、混合召回，再转入网络、MySQL、Spring 和 AI Coding；
- [2026-08-29 蚂蚁财富 Agent 开发](https://www.nowcoder.com/feed/main/detail/6490526c86124f92b79a993e171f7222) 问 Markdown Memory/RAG、Agent Teams、全自动任务可靠性、FC 内部流程、Harness、Skill 懒加载、Temperature=0 的非确定性，同时考 ACID、数据库日志、Redis、MQ、限流和算法；
- 算法轨还会深入 DPO/PPO/GRPO、FlashAttention、蒸馏、数据和金融信用建模。

**准备重点：** 权限、审计、隐私、HITL、Prompt Injection、不可逆操作、资金/状态一致性、幂等/补偿/熔断；不能只会说“加个人工确认”。

### 腾讯

腾讯样本显示出“模型适配 + Agent 应用 + 传统大规模后端”的混合特征。

- [2026-04-04 AI Agent 应用开发一面](https://www.nowcoder.com/feed/main/detail/28edcddf0c204c08b6562a3e6e6b73ae) 直接问为什么已有 Claude Code 还要自研 Coding Agent、产品差异、分层 Context、Summary 质量、Subagent 通信与防循环，再进入 GRPO/PPO、QLoRA、量化和 Python；
- [2026-04-10 两轮样本索引](https://www.nowcoder.com/discuss/878945851924627456) 包含 Qwen 工具调用适配、空调用、长短期 Memory、代码助手仓库依赖检索、Text2SQL、Rerank 变差的诊断、Query Rewrite 与多 Agent；
- [2026-05-21 一手样本](https://www.nowcoder.com/feed/main/detail/2a1e82db37244630a6e131d8c823dfc8?sourceSSR=dynamic) 把 Prompt Injection/Agent 安全与 Redis/Kafka 容灾、亿级表变更放在同一轮；
- [2026-07-07 跨公司面经](https://www.nowcoder.com/discuss/904029765160497152) 还提醒了一个现实风险：候选人投的是 Agent，腾讯实际团队调整后可能几乎只考云基础设施和算法。

2025 的混元算法样本更偏 SFT 动机、数据标注、Qwen 推理模式、RoPE、量化和 baseline。2026 当前招聘则已经细分出 Harness、Eval Infra、Agent RL 框架、Sandbox 和轨迹观测方向。

**准备重点：** 先问清团队。应用岗准备 Qwen/工具/记忆/RAG；平台岗准备协议、仓库理解与后端；算法岗准备数据、微调/RL 和模型基础。

### 百度

百度是 2026 年公开样本中把“Prompt → Context → Harness”问得最直白的一家。

- [2026-07-02/03 文心一、二面](https://www.nowcoder.com/feed/main/detail/681c33aafac84af0a70b6fd5e663a04c?sourceSSR=post) 一面偏 Agent 后训练：SFT 何时足够、reward/verifier、reward hacking、PPO/GRPO 和 task eval；二面偏系统：Action、长文本、Context/Memory、冲突指令、Harness/Loop、Skill 为什么在系统层，以及 Claude Code/Codex/GLM；
- [2026-08-18 大模型研发一面](https://www.nowcoder.com/discuss/921590204903723008?sourceSSR=enterprise) 直接问 Prompt/Context/Harness Engineering、上下文压缩、Claude Code 和从零 RAG；
- [2026-08-21 二面](https://www.nowcoder.com/discuss/920461634072477696?sourceSSR=post) 几乎改成开放式系统题：C 端 Agent 模块、主流产品比较、Claude Code 数据流、防重复 Tool Call、只有 LLM API 与 VS Code 时如何造 Agent；
- [官方 2027 AIDU 智能体算法岗](https://talent.baidu.com/jobs/detail/GRADUATE/4f1cbc80-8332-4a92-b8fa-c0132b17d47e) 同时列出感知—决策—执行、多 Agent、长期记忆、规划/工具/反思/代码、RAG+Agent，以及成功率、延迟、成本和用户体验 Eval。

**准备重点：** 一定先区分应用、算法和 Infra。应用要全栈与 RAG，算法要 reward/verifier/trajectory，Infra 要 Harness、Sandbox、K8s 和可观测。

### 华为

华为公开样本的特点不是最追新名词，而是流程正式、基础扎实、项目必须说清楚。

- [2025 AI 工程师实习](https://www.nowcoder.com/feed/main/detail/3bd15a280c334ccfa51c2d181c4b587c?sourceSSR=users) 已问 RAG 构建、分块、Query/知识歧义、Agent 模块/选型、边缘设备模型规模和算法；
- [2026-05-14 云软件 AI 技术应用](https://www.nowcoder.com/discuss/884479038142586880?sourceSSR=post) 有双机位、三数之和、项目架构/个人贡献，主管面才问 Agent 宏观架构与从零设计；
- [2026 某 BG Agent 岗完整记录](https://www.nowcoder.com/feed/main/detail/63f974c8a2214503bdc0ad7505cdc15b) 同时验证 ReAct/RAG Agent、TCP/C/存储/拓扑排序、Computer Use、Skill/MCP，并建议研究主流 Agent 框架和 Claude Code 实现；
- [华为官方挑战课题](https://career.huawei.com/cn/young-genius) 已出现“AI Agent 多模态智能通信”，华为云公开方向也包含 Agent 平台、Skill/CLI 和 Agentic Infra。

**准备重点：** 机试/手撕、C/C++/OS/网络、项目真实性、端云部署和业务价值优先；Harness/MCP/Skill 是加深项，不是基础差的替代品。

### 美团

美团最稳定的追问方式是：为什么这么选、替代方案是什么、如何验证、剩余坏例怎么发现。

- 2025 后端暑期样本已经把三个 Agent 的输入输出、RAG 消融、BM25、双路召回、Tool Calling、MCP 的 SSE/stdio、上下文过长与 MySQL/Redis/线程池放在同一轮；
- [2026-08-25 Agent 开发一面](https://www.nowcoder.com/feed/main/detail/58159306df52463ab75d72daa80d66df?sourceSSR=enterprise) 是很有价值的样本：RAG vs 长上下文直接读文件、RAG vs Coding Agent 用 grep 搜仓库、无标题 Markdown 切分、短 Query/长 Chunk、如何发现剩余 1%–2% 幻觉、单/多 Agent、Plan-and-Execute/ReAct、Agent vs Harness、Context 裁剪、Prompt Cache、Milvus、协程/线程、Vibe/Spec Coding 和两道算法；
- 2026 校招企业页有多名候选人独立报告“大模型选择题 + 算法 + AI Coding”；
- [美团官方 CatPaw](https://tech.meituan.com/2026/07/28/CatPaw-LongCat.html) 当前产品强调本地/云端长任务、专家/Skill/Subagent、跨会话 Memory、多 Agent 独立环境、凭证隔离、权限、Sandbox 和全链路可观测。这不能当作真题，但能解释岗位为何围绕这些机制继续追问。

**准备重点：** 每个架构选择必须带 baseline、指标、失败样本和替代方案；RAG 不能只背流程，要能说明什么时候不该用 RAG。

### 京东

京东的公开证据最像“后端/分布式系统 + Agent Runtime”。

- 2025 样本已问用户意图多样化、工具选择准确率下降、RAG 召回低和真实应用体会；
- [2026-02-10 实际 Agent 开发一面](https://linux.do/t/topic/1591661) 从告警 Agent 的输入输出、节假日/发布期准确性和非 AI fallback，问到 4000 页多模态/GB 文档、RAG 更新、LangChain 链路、MCP 工具选择和 Skill；
- [2026-03-13 京东零售后端](https://www.nowcoder.com/feed/main/detail/b610d6eb716c44a4a1c36d04c5db12c7) 把 Redis+Lua、MQ、性能与 RAG 分片/幻觉、Function Calling/Skill 和模型选型混合考；
- [2026-06-24 官方 Agent 专家 JD](https://zhaopin.jd.com/web/job-info-detail?requementId=219681) 明确要求 Model Gateway、Agent Runtime、上下文状态、工具/插件注册、Streaming、Semantic Cache、熔断、Eval/回放和 Trace/Metric/Log；
- [另一条官方大模型智能体岗位](https://zhaopin.jd.com/web/job-info-detail?requementId=219868) 进一步把 Skills、Subagents、MCP/A2A/A2UI、Coding Agent、Sandbox、Memory、Context Engineering 与 Harness Engineering 写进职责和能力要求，说明这些不只是社区热词，而是当前平台岗位的正式能力项。

**准备重点：** Java/Go、RPC/MQ/网关、并发、缓存和故障恢复不能丢；Agent 题按“状态、权限、fallback、Eval、可观测”回答。

### 快手

快手样本一条是后训练/模型，一条是 Data Agent/应用，不能混在一起。

- [2025-09-15 大模型二面](https://www.nowcoder.com/feed/main/detail/c7d3992e36b44234917382c3b7573a00) 深入 PPO/DPO/GRPO、GAE、reward/reward hacking、分层强化学习 Agent、FSDP/DeepSpeed、显存和手写 MHA；
- [2025 Data Agent 一面](https://www.nowcoder.com/feed/main/detail/4344d0da296944f8b6bcdb0acdbe141e) 仍以 LLM vs Agent、ReAct/LangChain、RAG 与模型微调为主；
- [2026 Data Agent 一面](https://www.nowcoder.com/discuss/904419777614049280) 已继续追父子索引、BM25/Rerank、Context vs Memory、Function Calling/Planning、Prompt Injection、工具安全、限流与 RAG Eval；另一份[问题密度更高、但需要保守使用的同类记录](https://api-cdn.nowcoder.com/feed/main/detail/8ef62dcdde1340f987507d2d1e1433a8) 又出现三层 Memory、Skill 渐进披露和工具选择。这里更可靠的结论是题面从“会搭框架”向检索、记忆、安全和评估深化，而不是把所有问题外推成快手统一题库。

**准备重点：** 应用岗把 RAG/Memory/Security 与限流/缓存/数据库一起准备；算法岗另开一条 RL/训练/显存路线。

### 拼多多

拼多多 2026 校招公开出现独立 AI Agent 研发方向，但当前可高置信核验的一手样本不够多，不能像字节、阿里那样概括稳定“厂味”。

- [2026-08 提前批一面短帖](https://www.nowcoder.com/feed/main/detail/d0c1a59663a2408fb9f8b52b87ccaaec) 主要问 LLM API 失败如何感知和定位、限流之外的异常、Context/Memory 较弱、多用户×多角色记忆，以及算法；
- 企业面经页还有代码生成全链路、断点恢复、Codebase Memory、代码审查和长耗时 Agent 资源管理等记录，但部分条目无法稳定取得独立原帖，只作二级线索；
- 网上同时存在标题写拼多多、正文写快手，或“含完整答案/专栏付费”的内容，均未用于公司画像。

**准备重点：** 以 JD 和自己投递团队为准，优先准备 LLM/Tool 故障定位、会话与多角色 Memory、分布式基础和算法；Coding Agent/DeepSeek Harness 只在能够说明来源和实现时展开。

### 小米

小米的业务方向决定了端侧/OS/GUI Agent 值得重点准备，但当前可核验的 2026 技术一手面经仍较少，下面是“岗位方向 + 有限样本”的组合判断，不代表稳定题库。

- 2025 大模型应用样本偏 RAG 指标、低延迟、Prefill/Decode、KV Cache、Python/GIL；
- [2026 AI Agent 暑期一面](https://www.nowcoder.com/discuss/891698510574153728) 追“为什么代码生成要微调，不能只用 Prompt/Spec Coding”、缺陷修复 Agent、静态 Spec 与动态环境反馈、模型选型、自托管/API 和 Memory；
- 普通汽车软件岗已经开始问 AI Coding、Skill、如何维护 `CLAUDE.md` 和 Loop；
- [小米官方顶尖人才课题](https://hr.xiaomi.com/website/top-talent.html) 明确列出“认知—记忆—问答链路及自动评估”“AI Agent 与操作系统深度集成”和端侧具身智能决策。

**准备重点：** 微调 vs Prompt/Spec、GUI/OS 权限与状态、端侧模型/推理、Memory、Sandbox/Trace，以及真实代码验证。

### 小红书

公开样本数量不如前几家稳定，但时间演进很有代表性：[2025-10 的二面](https://www.nowcoder.com/feed/main/detail/d84d8e69cb8a4caf9c4aefb60f04d7ac) 已经问 Skill 召回 vs Function Call/RAG、混合检索，以及 Cursor/Claude Code 的 System Prompt、上下文压缩和工具选择；[2026-08-06 Agentic 全栈一面](https://www.nowcoder.com/feed/main/detail/e5e9311a623940eead6ec98c65e7f9e8) 则继续进入写操作边界、Harness 层、编排/意图分流、Skill vs Tool、多模型一致性、十几万请求扩容、LangGraph vs 自研和 Java/MySQL。产品工程样本还会问多 Agent Context 共享、Skill 管理和业务指标。

**准备重点：** 内容/电商场景、检索与推荐数据、Agentic 全栈、状态/Checkpoint、Skill、模型一致性和服务扩缩。证据不足时不要套用“某厂固定风格”。

### 国内模型公司：阶跃星辰、智谱、月之暗面、MiniMax

模型公司公开样本更少，但岗位分化更鲜明。

- **阶跃星辰：** [2026 企业面经页](https://www.nowcoder.com/enterprise/26710/interview) 中的 Agent 算法一面会追工具调用训练的 reward、数据配比、ReAct 的 Plan/Observation/Action 输入输出、TRL/verl 类和参数；另一场问 LoRA 初始化、DPO 数据、SFT/DPO、Workflow 与采样。它更像 Agent 后训练岗，而不是应用框架岗。
- **智谱：** [2026 Agent 算法面经](https://www.nowcoder.com/feed/main/detail/24952c828c59435abd3c302c97fa358d) 追 DPO loss、负样本、长链 GUI 正负样本长度、GRPO、Tool Response 是否 loss mask、MCP 训练数据、bad case、参数量/KV Cache 和流式 Tool 输出处理。
- **月之暗面/Kimi：** 可信公开样本较少。[2026-07-23 Desktop AI-Native 研发](https://www.nowcoder.com/feed/main/detail/09158c1da13b420bbe00ba1751177efb?sourceSSR=dynamic) 主要问本地文件权限、产物面板、多模态 Context、长任务通知/回看/续跑、结果编辑—确认—发布和 Agent 任务中心。网上多篇“被吊打+完整答案”的 Kimi 面经模板化明显，不能作为核心证据。
- **MiniMax：** 2026 已有几份较自然的一手样本。[AI 应用开发一面](https://www.nowcoder.com/feed/main/detail/25aec4b727ac4985a7b83fa1e05594e8) 追 PRD/design 如何防需求丢失、需求到代码定位、Task 粒度、多 Agent 状态传递/冲突，以及 Rules vs OpenClaw Memory；同一候选人的[平台研发一面](https://www.nowcoder.com/feed/main/detail/5f9c694727504dee91f57b251702c607)和[二面](https://www.nowcoder.com/feed/main/detail/362fd78c774b4e80813f48e1139b8230) 又进入 Codex 数据采集耐久性、MQ、Agent 自进化、用户反馈有效性、协议扩展和平台能力产品化。官方 [Agent Team 技术文章](https://www.minimax.cn/blog/minimax-agent-team-long-running-1779893521) 可用于校准长程任务、多 Agent 并行和质量门禁，但仍不是面试题证据。

如果目标是 DeepSeek、MiniMax、Kimi、智谱、阶跃一类模型公司，至少要另外准备模型/后训练/推理与研究复现；只读 Agent 框架源码并不够。

## 四、一场 Agent 面试通常怎样推进

公开样本不能推出统一轮次，但问题的推进方式相当稳定。

### 第一层：确认项目是不是你做的

面试官先问背景、用户、输入输出、整体数据流、个人代码边界和实际结果。随后故意绕开简历里的框架名：

- 用户一句话进入系统后，第一个写入状态或日志的组件在哪里？
- 模型为什么选择这个工具，Schema 谁定义，错误码如何返回？
- 你说准确率提升，基线、样本量、统计窗口和归因是什么？
- 为什么不用 Workflow、规则、小模型或一次 API 调用？
- 哪个线上 bad case 最难，最终确认根因的证据是什么？

这一层不是考架构词汇，而是检查“输入、状态、动作、观察、指标”能否连成可追踪的链。

### 第二层：沿失败路径追问

项目讲顺后，2026 年面试官经常把系统推到异常状态：

- 工具超时、返回空值或部分成功怎么办？
- 同一个 Action+参数重复五次，在哪里停止？
- 压缩后丢掉用户硬约束，如何发现和恢复？
- 两个 Agent 同时改一个文件或写同一行数据库怎么办？
- 高风险工具被 Prompt Injection 诱导调用怎么办？
- 进程在第七步崩溃，能否从 Checkpoint 恢复而不重复副作用？

优秀答案不是堆“重试、熔断、降级”四个词，而是说明：哪些错误可重试，哪些操作幂等，状态写在哪里，副作用如何确认，恢复从哪个边界继续，什么时候必须交给人。

### 第三层：要求你比较，而不是背定义

常见比较题包括：

- Agent vs Workflow；ReAct vs Plan-and-Execute；
- LangChain vs LangGraph vs 自研 Loop；
- RAG vs 长上下文直接读文件 vs grep/代码索引；
- Function Calling vs Tool vs MCP vs Skill；
- Context vs Session vs Memory；
- Permission vs Sandbox；
- 单 Agent vs Multi-Agent；
- Claude Code vs Codex vs 自研 Coding Agent；
- Prompt/Spec 工程 vs SFT/DPO/GRPO。

回答结构最好固定为：**目标约束 → 两种机制 → 适用条件 → 失败模式 → 自己项目的选择与证据**。

### 第四层：基础与现场题

Agent 岗的“基础”由岗位决定：

- 应用/后端：Java/Go/Python、协程/线程、MySQL、Redis、MQ、RPC、限流、SSE/WebSocket；
- 算法：Transformer、Attention、KV Cache、显存、LoRA/SFT/DPO/PPO/GRPO、reward；
- Infra：OS、容器/K8s、隔离、网络、调度、存储、可观测和分布式一致性；
- Coding/GUI：代码仓库、IDE/CI、工作区、浏览器/桌面权限和流式 UI。

手撕仍常见，难度从 Hot100 到 DP、图、并查集不等。2026 还出现了两种新形态：让候选人用 AI Coding 完成功能后 Review，以及正式笔试里的 AI Coding 题。面试官真正看的是需求拆解、上下文提供、验证、回退和代码责任，不是提示词写得多华丽。

## 五、结合四个源码仓库，回答 12 类高频硬题

### 1. Agent、Workflow、Orchestrator 和 Harness 有什么区别？

可以按控制范围从小到大回答：

- **Agent Loop** 是局部迭代：模型基于当前 Context 选择 Action，环境执行并返回 Observation，系统继续或停止。
- **Workflow** 是开发者预先定义的状态转移、分支和失败处理；模型可以是某个节点，但不是全部控制逻辑。
- **Orchestrator** 负责计划、路由、调度、依赖与并发，可能编排一个或多个 Agent/Workflow。
- **Harness** 是模型外完整运行与治理环境，除了 Loop/Orchestrator，还包括 Context、Tool Registry、Policy/Approval/Sandbox、Session/Compaction、Workspace/Subagent、Telemetry/Eval 和恢复。

本项目四仓正好给出四种控制权分配：

- Pi 的生产主链很薄，把大量控制交给 provider 与扩展；核心没有内置 Permission、OS Sandbox、MCP 或 Subagent Scheduler。
- Codex 把控制放在 app-server、Session/Task/turn、Tool Registry/Router、安全状态机、ThreadStore 和共享多 Agent 控制面。
- DeepSeek Harness 把控制放在 Cordis 插件组合与持久事件面，Loop 薄而 Session/Event 很重。
- Claude Code 2.1.88 把产品能力收进共享 async-generator `query()`，再叠加工具验证、Hook、Permission、可选 Sandbox、压缩与 AgentTool。

详见[Agent Loop、模型调用与工具执行](/blog/coding-agent-loop-tools/)和[功能总矩阵](/blog/coding-agent-feature-matrix/)。这比把 Harness 解释成几份 Markdown 文件更准确。

### 2. Context、Working State、Session、Transcript 和 Memory 怎么分？

- **Context**：下一次模型调用真正能看到的 Token/消息表面。
- **Working State**：任务当前目标、计划、未完成步骤、工具状态、产物句柄等结构化状态。
- **Session/Thread**：一次任务或对话的生命周期、身份与可恢复边界。
- **Transcript/Event Log**：持久记录用户、模型、工具、审批和系统事件。
- **Long-term Memory**：经过写入门控、作用域、冲突与过期治理后，跨会话按需召回的事实或经验。

关键句是：**磁盘上有完整 Transcript，不代表模型当前 Context 完整可重放。** 压缩、过滤、角色映射、工具结果裁剪都可能改变模型表面。四仓分别采用会话树、ThreadStore、事件投影和 JSONL 父链，差异见[上下文、会话、压缩与子代理](/blog/coding-agent-context-session-subagents/)。

### 3. 上下文快超窗时，怎样设计压缩？

先定义不可丢失集合，而不是先让模型“总结一下”：

1. 固定保留系统/项目规则、权限边界、当前目标、用户硬约束和输出契约；
2. 最近交互、未完成步骤、尚未确认的工具副作用保留原文；
3. 已完成阶段压成结构化字段，例如 `decisions/completed/open/artifacts/risks`；
4. 原始消息、日志和大文件留在外部事件/对象存储，摘要只保存可回读的 ID/句柄；
5. 按 Token 软/硬水位、阶段完成或目标切换触发，而不是机械地“每五轮总结”；
6. 用回放集比较压缩前后约束保留、下一步工具选择和终态成功率。

源码里，Codex 把 Compaction 当作 Loop 内状态转换；DeepSeek Harness 是持久事件不删、模型 Surface 被替换；Claude Code 2.1.88 有 microcompact、collapse/full compact 的分层路径；Pi 在会话分支上记录摘要。不要把任何一个旧版本的具体阈值说成行业通则。

### 4. Tool 调用链怎样做到生产级？

一个完整回答至少包括：

`发现/目录 → Schema → 模型选择 → 参数验证 → Policy/Approval → Sandbox → 执行 → 结果规范化 → Observation → Trace/Eval`

进一步说明：

- 工具名和描述解决“模型能否选对”；Schema 与验证器解决“参数是否合法”；
- Approval 决定是否授权，Sandbox 限制授权后实际触达范围；
- 只对幂等或有明确补偿的操作自动重试，指数退避不能替代副作用设计；
- 错误应作为结构化 Observation 返回，区分可重试、需 Replan、权限拒绝和终止；
- 无依赖只读工具可并行，有文件/数据库写依赖必须由执行器而不是模型文本保证顺序；
- Trace 要关联 `session/turn/tool_call/attempt/policy/result`，便于回放与 bad case 归因。

Codex 的 Registry/Router 与读写并发门、Claude Code 的 validation→hooks→permission→call→post-hook 流水线，以及 DSH 的 ToolRuntime 都可作为具体例子。见[Loop 与工具执行](/blog/coding-agent-loop-tools/)。

### 5. Function Calling、Tool、MCP 与 Skill 有什么区别？

- **Function Calling** 是模型输出结构化调用意图的一种接口形式；它不负责真正执行、权限或传输。
- **Tool** 是可执行能力及其输入输出契约，可以是本地函数、Shell、HTTP 服务或 MCP 端点。
- **MCP** 是工具/资源/提示的发现与通信协议，解决客户端与外部 Server 的互操作，不等于业务流程。
- **Skill** 通常是面向任务的可复用 playbook/能力包，包含说明、脚本、资源、示例、验收和失败处理；它不是统一网络协议。

工具很多时可采用渐进披露：Context 里常驻名称、短描述和触发条件，命中后再加载完整 Skill 和资源。但 Harness 仍要执行依赖校验、权限、版本、输出裁剪和观测，Skill 不能把未经审计的动作藏在 Prompt 里绕过安全。

### 6. Permission 和 Sandbox 为什么必须分开？

一句话：**Permission 决定“是否允许”，Sandbox 决定“允许后最多能碰到什么”。**

面试里可画两层状态机：先根据身份、工具、参数、资源和风险等级作 deny/ask/allow；允许后再用文件系统、网络、进程、凭证、容器/虚机边界限制实际能力。高风险操作还要有二次确认、审计和可逆/补偿设计。

四仓差异很适合举例：Codex 有显式 Approval/Sandbox 编排；DSH 用 Permission Preset、Approval Provider 与 Sandbox 组合；Claude Code 2.1.88 有 Permission Context 和可选 Sandbox Adapter；Pi 默认把边界交给宿主。详见[权限、沙箱、信任与扩展](/blog/coding-agent-security-extensions/)。

### 7. 什么时候该用 Multi-Agent？

不要用“复杂任务就多 Agent”作答。只有以下收益大于协调成本时才拆：

- 子任务可并行且依赖清晰；
- 不同子任务需要隔离 Context、权限、工具或工作区；
- 专业角色能带来可测的质量增益；
- 单 Agent 的上下文污染或搜索空间已成为瓶颈。

设计时要回答：root/controller 是谁，共享状态 Schema，任务 Ownership，预算与取消传播，结果/错误协议，重试与幂等，工作区/Worktree，Merge/Review Gate，孤儿任务清理和 Trace。

还要指出“支持 Subagent”不是一个统一能力：Pi 的示例扩展、DSH 的 provider seam、Claude 的 AgentTool sidechain、Codex 的 root-tree scheduler 不能互换。见[Subagent 架构对比](/blog/coding-agent-context-session-subagents/#5-subagent-架构)。

### 8. Agent 死循环、路径震荡、偏航怎样处理？

按“检测—限制—恢复”回答：

- 检测：最近 N 步 Action+参数重复、状态哈希不变、计划在两个节点间往返、错误类型连续相同、里程碑长期不推进；
- 限制：Step/Time/Token/Cost Budget、工具级熔断、递归深度、并发与子 Agent 数；
- 恢复：保留目标和失败证据后 Replan，切换工具/模型，回到最近 Checkpoint；
- 副作用：工具幂等键、事务/补偿、已提交动作清单，避免恢复时重复付款、发信或写库；
- 人工：高风险、重复失败或证据不足时转 HITL，而不是无限 Reflection。

### 9. Agent Eval 应该怎样分层？

至少四层：

| 层 | 例子 |
|---|---|
| Outcome | 任务成功率、正确性、约束满足、人工验收 |
| Process | 规划/工具选择、参数正确率、无效轮次、恢复成功率、轨迹长度 |
| Safety | 越权、Prompt Injection、秘密泄露、不可逆副作用、误拒绝 |
| Efficiency | P50/P95 延迟、Token、工具次数、并发资源、单任务成本 |

评测时固定模型、Prompt、工具 Schema/版本、权限和环境快照；保存可回放的 Session/Event Log；按失败阶段分桶；LLM-as-Judge 必须用人工或可验证终态校准。离线回归只能支持发布门禁，不能替代线上 A/B、用户反馈和安全监控。

### 10. RAG、长上下文与 grep/代码索引怎样选？

- 大规模、持续更新、需要权限过滤和证据引用的异构知识，优先 RAG；
- 小而完整、结构强耦合的材料，可以直接放长上下文；
- 代码里的精确标识符、路径、错误字符串和当前工作区状态，grep/符号/AST 索引通常比纯向量更可靠；
- 模糊语义、跨文件概念和历史设计可用向量/图检索补充；
- 生产 Coding Agent 常把精确搜索、结构索引、语义检索和按需读文件组合，而不是三选一。

无论哪种方案，都要用任务数据验证：检索层看 Recall@K/MRR/NDCG，生成层看 Faithfulness/引用，端到端看任务成功率、延迟和成本。Rerank 变差时先检查候选召回、训练域、Query 长度、Chunk 粒度和截断，不要只调 TopK。

### 11. SFT、DPO、PPO/GRPO 在 Agent 中分别解决什么？

先确认问题是否真的需要训练。私有 Schema、固定格式和初始轨迹模仿可用 SFT；成对偏好可用 DPO 类目标；多步决策、可执行终态或过程 Reward 明确时再考虑 PPO/GRPO/RLVR。没有可靠 verifier/reward 和对照实验，RL 只会把错误放大。

Agent 轨迹数据要区分 System/User、Assistant 决策、Tool Call、环境 Tool Response 和最终答案。环境返回通常不是模型要预测的目标，需要明确 loss mask；训练还要处理长短样本偏差、无效调用、工具版本漂移、训练—服务 Schema 不一致和 Reward Hacking。

### 12. AI 生成的代码怎样验证？

可以给出五层门禁：

1. 需求与约束：先写 acceptance criteria、禁止改动范围和接口契约；
2. 静态检查：类型、Lint、依赖、秘密与安全扫描；
3. 动态验证：单测、集成、回归、边界/故障注入；
4. 差异审阅：逐文件解释为什么改、是否有无关重构、迁移/回滚方案；
5. 责任边界：AI 可生成，候选人必须理解、Review、验证并对提交负责。

现场 AI Coding 时应先让 Agent 理解仓库和测试，再做最小可运行版本；每轮只修改可归因的一小组问题，保留提交/检查点，避免把越来越长的失败上下文继续喂回去。

## 六、项目深挖：一套不容易被问穿的讲法

### 2 分钟版本

用七句话讲清：

1. **用户与任务：** 谁在什么场景下要完成什么；
2. **原始基线：** 人工、规则、搜索或固定 Workflow 的痛点；
3. **为什么 Agent：** 哪个决策必须根据 Observation 动态变化；
4. **核心链路：** Context → Loop/Planner → Tool → State → Validation；
5. **个人边界：** 自己直接拥有的模块、代码和决策；
6. **证据：** 数据集、baseline、指标、样本数和观测窗口；
7. **失败与取舍：** 一个真实 bad case、根因、修复和仍未解决的限制。

### 10 分钟架构版本

建议按下面的执行顺序画图，而不是按技术栈罗列名词：

`入口/身份 → Policy → Context Builder → Loop/Orchestrator → Tool Router → Validation/Approval/Sandbox → Executor → Observation → State/Event Log → Eval/Trace → 用户确认/交付`

每一层都准备四个问题：输入输出是什么、状态在哪里、失败怎么处理、指标怎么验证。

### 指标怎样说才可信

不要临场编“从 60% 提升到 85%”。一个可信表述至少包含：

- 基线版本和比较变量；
- 数据来源、样本量、时间范围和难度分布；
- 主指标和护栏指标；
- 是否重复运行、是否有置信区间或人工复核；
- 改进究竟来自 Agent 机制，还是数据清洗、规则、模型升级或人工补丁；
- 当前证据的限制。

没有线上 A/B 就明确说离线回放；没有用户就说尚未验证真实使用价值。诚实的证据边界通常比漂亮但无法复现的数字更有说服力。

## 七、P0 必答题单

下面 36 题建议都能在白板上讲 3–5 分钟，并承受两轮追问。

### 架构与控制面

1. Agent 与 Chatbot、一次 Function Call 的本质区别是什么？
2. Agent、Workflow、Orchestrator、Harness 怎么分？
3. ReAct 与 Plan-and-Execute 各自的失败模式是什么？
4. Planning 应由模型还是框架负责？
5. 为什么自研，不直接用 LangGraph、Claude Code 或公司平台？
6. 画出一次用户请求从输入到交付的完整数据流。

### Context、Session 与 Memory

7. Context、Session History、Working State、Long-term Memory 怎么分？
8. Context 超窗时如何触发、压缩、验证和恢复？
9. 哪些信息绝不能交给摘要模型决定是否保留？
10. Memory 何时写入，如何做 Scope、Authority、TTL、去重与冲突？
11. Transcript 完整保存，为什么仍不能保证精确重放？
12. Prompt Cache 怎样受 Context 顺序和动态内容影响？

### Tool、Skill 与协议

13. 模型如何从几百个工具中选到正确工具？
14. Tool Schema、参数幻觉和错误码怎样设计？
15. Function Calling、Tool、MCP、Skill 与 A2A 的边界是什么？
16. Skill 渐进披露如何节省 Context，又有什么安全风险？
17. 工具超时、空返回、部分成功、重复副作用分别怎样处理？
18. 哪些 Tool Call 可以并行，谁来保证依赖顺序？

### 安全与可靠性

19. Permission 与 Sandbox 为什么不能互相替代？
20. 如何防 Prompt Injection 诱导越权或秘密泄露？
21. 付款、发信、删库、执行 Shell 分别怎样分级与确认？
22. Agent 死循环、路径震荡和任务偏航如何检测？
23. 进程崩溃后如何恢复而不重复副作用？
24. 高并发下如何做幂等、限流、熔断、降级和补偿？

### Multi-Agent 与 Coding Agent

25. 什么场景单 Agent 更好，什么场景值得多 Agent？
26. 多 Agent 如何共享状态、传播取消和控制 Token 预算？
27. 两个 Agent 同时改文件/数据库怎样避免冲突？
28. Claude Code、Codex 与你的 Coding Agent 控制面有何差异？
29. 代码上下文为什么不能只靠向量库？
30. AI 生成代码怎样 Review、测试、回滚和追责？

### RAG、Eval 与训练

31. RAG、长上下文、grep/符号索引如何选？
32. Chunk、Hybrid Retrieval、Rerank 和 Query Rewrite 怎样调？
33. Agent Eval 为什么不能只看最终准确率或 LLM Judge？
34. 怎样构建可回放的 bad case 集与发布回归门禁？
35. SFT、DPO、PPO/GRPO 各自适合 Agent 的什么问题？
36. Tool Response 是否参与 loss，reward hacking 如何发现？

## 八、按岗位追加的 P1 题

### 应用/全栈

- SSE 与 WebSocket 如何选，断线续传和取消怎样做？
- RAG 索引怎样不停服更新，权限过滤放在哪一层？
- Redis Semantic Cache 的 key、失效与污染怎样治理？
- 消息队列如何保证长任务至少一次消费下的业务幂等？
- Agent 输出怎样转成可验证的结构化业务对象？

### Harness/Infra

- Session/Task/Turn/Step 如何建模？
- Tool Registry 与动态插件如何版本化和热更新？
- 模型网关如何路由、限流、缓存与统计 Token？
- 容器、gVisor、Firecracker 和宿主进程隔离怎样取舍？
- Trace 如何跨模型调用、工具、子 Agent 与审批串起来？
- 长任务调度怎样处理租户公平性、取消和孤儿任务？

### 算法/后训练

- Agent trajectory 数据如何生成、筛选和去重？
- SFT 何时足够，切 RL 的判据是什么？
- DPO 正负样本长度差异会带来什么偏差？
- GRPO 的 reward、group 与 credit assignment 如何设计？
- Tool 使用的过程 reward 与终态 reward 如何组合？
- Train-serving 的 Prompt/Schema/工具版本偏移如何诊断？

### GUI/Browser/端侧

- DOM、截图、OCR、Accessibility Tree 如何组合？
- 本地文件和目录授权如何可见、可撤销、可审计？
- GUI 动作怎样检测页面已变化、动作是否真正生效？
- 端侧模型在延迟、内存、功耗和隐私之间如何选型？
- 长任务在本地关机、断网或 App 重启后怎样续跑？

## 九、14 天突击计划

### 第 1–3 天：把项目讲成状态机

- 画完整数据流和失败流；
- 写出个人代码边界、baseline、指标口径和三个 bad case；
- 为每个框架选型准备一个替代方案和拒绝理由；
- 把 2 分钟与 10 分钟版本各录两遍。

### 第 4–6 天：RAG、Context、Memory

- 用同一批文档比较 BM25、向量、混合+Rerank；
- 实现 Query Rewrite 和权限元数据过滤；
- 做一次压缩前后回放，记录约束丢失、Token、延迟和任务成功；
- 能明确说出 Context、Session、Transcript 和 Memory。

### 第 7–9 天：Loop、Tool、安全与恢复

- 自己写一个最小 Loop，不依赖黑盒 Agent API；
- 加 Schema 验证、结构化错误、Step/Time/Token Budget；
- 为写操作加幂等键、Approval 和最小 Sandbox；
- 注入一次工具超时、进程崩溃和 Prompt Injection，验证恢复/拒绝。

### 第 10–11 天：Eval 与可观测

- 建 30–50 条小型回放集，按 outcome/process/safety/efficiency 评分；
- 保存模型、Prompt、Tool、权限和环境版本；
- 把 bad case 分成检索、Context、规划、工具、权限、状态和验证七类；
- 不用单一 LLM Judge 代替全部评测。

### 第 12–14 天：公司与岗位定向

- 按 JD 判断自己在应用、算法、Harness、Coding/GUI 哪条线；
- 从上面的公司画像选 10 道定向题；
- 每天手撕 2–3 道算法，并复习岗位对应的数据库/OS/网络或 RL；
- 做两次 60 分钟模拟：20 分钟项目、20 分钟场景、15 分钟基础/代码、5 分钟反问。

如果有四周时间，把第 7–11 天的最小 Harness 做成可运行项目，并保留 Eval 报告、Trace 截图、故障注入和设计文档。这个证据比再堆一个 LangChain Demo 更有区分度。

## 十、反问面试官

反问的目标是确认岗位的真实控制面与失败成本：

1. 这个团队更接近 Agent 应用、模型后训练，还是 Runtime/Harness？三者工作比例如何？
2. 当前最大的失败来源是模型、Context、工具、状态、评测还是业务接入？
3. Agent 的输出是建议，还是会直接触发不可逆动作？HITL 和责任边界是什么？
4. 团队用哪些 outcome/process/safety/cost 指标做发布门禁？
5. 是否保存可回放轨迹，线上 bad case 如何进入回归集？
6. 自研能力与 Claude Code/Codex/开源框架的边界在哪里？
7. 实习生/新人的第一个可独立交付模块通常是什么，如何判断完成？

## 十一、最后的准备优先级

如果时间只够抓五件事，顺序建议是：

1. 把自己的项目、指标和坏例说到可复现；
2. 保住算法与岗位对应的工程/模型基础；
3. 真正理解 Context、Tool、State、Permission/Sandbox 和 Eval；
4. 读一个 Coding Agent 的完整调用链，而不是只看产品介绍；
5. 针对目标团队补 RAG、RL 或 Infra，不按“Agent 八股大全”平均用力。

2026 年面试官真正区分候选人的问题，往往不是“你知道多少新名词”，而是：**模型做了一个概率决策之后，你怎样让真实系统仍然可控、可恢复、可验证、可追责。**

## 主要来源索引

下面只列本文反复使用的核心来源；各公司章节中的链接提供更细的一手样本。

### 一手面经

- 字节：[2026-08 Agent 两轮](https://www.nowcoder.com/feed/main/detail/8a553bb6ea8445d0b0abe11e87614cea?sourceSSR=post)、[2026-06 Harness/Context/Eval](https://www.nowcoder.com/feed/main/detail/931a8a935a5e4b4f8d0b71cd4e818604)、[2025 四轮大模型](https://www.nowcoder.com/discuss/746382064101908480)
- 阿里/淘天：[2026 淘宝闪购 Agent 算法](https://www.nowcoder.com/discuss/879393838081597440)、[2026 阿里云 AI Coding](https://www.nowcoder.com/discuss/872120976190816256)、[2026 瓴羊 Harness](https://www.nowcoder.com/feed/main/detail/3a61d09fc2fb436f9bd5c1ed99b43330?sourceSSR=users)
- 蚂蚁：[2026 智能体与 LLM 应用](https://ac.nowcoder.com/discuss/1646420?type=0)、[2026 蚂蚁财富 Agent](https://www.nowcoder.com/feed/main/detail/6490526c86124f92b79a993e171f7222)、[2025 蚂蚁国际](https://www.nowcoder.com/discuss/800426409796624384)
- 腾讯：[2026 Coding Agent/Context/Subagent](https://www.nowcoder.com/feed/main/detail/28edcddf0c204c08b6562a3e6e6b73ae)、[2026 腾讯多样本索引](https://www.nowcoder.com/discuss/878945851924627456)
- 百度：[2026 文心 Agent RL/Harness](https://www.nowcoder.com/feed/main/detail/681c33aafac84af0a70b6fd5e663a04c?sourceSSR=post)、[2026 Prompt→Context→Harness](https://www.nowcoder.com/discuss/921590204903723008?sourceSSR=enterprise)
- 华为：[2026 某 BG Agent 完整流程](https://www.nowcoder.com/feed/main/detail/63f974c8a2214503bdc0ad7505cdc15b)、[2025 AI 工程师](https://www.nowcoder.com/feed/main/detail/3bd15a280c334ccfa51c2d181c4b587c?sourceSSR=users)
- 美团：[2026-08 Agent 开发一面](https://www.nowcoder.com/feed/main/detail/58159306df52463ab75d72daa80d66df?sourceSSR=enterprise)、[2025 后端/Agent](https://www.nowcoder.com/discuss/comment/21611834)
- 京东：[2026 实际 Agent 开发一面](https://linux.do/t/topic/1591661)、[2025 一面](https://www.nowcoder.com/feed/main/detail/f5be83cbaeb3420aa3c255b4f825a4e0)
- 快手：[2026 Data Agent/RAG/Tool Security](https://www.nowcoder.com/discuss/904419777614049280)、[2025 Data Agent](https://www.nowcoder.com/feed/main/detail/4344d0da296944f8b6bcdb0acdbe141e)、[2025 Agent RL](https://www.nowcoder.com/feed/main/detail/c7d3992e36b44234917382c3b7573a00)
- 拼多多：[2026 提前批 Agent 一面短帖](https://www.nowcoder.com/feed/main/detail/d0c1a59663a2408fb9f8b52b87ccaaec)
- 小米：[2026 AI Agent 一面](https://www.nowcoder.com/discuss/891698510574153728)、[2025 大模型应用](https://www.nowcoder.com/feed/main/detail/8cdd5da8b4ea4b139e0e54d1e102867b?sourceSSR=users)
- 小红书：[2026 Agentic 全栈](https://www.nowcoder.com/feed/main/detail/e5e9311a623940eead6ec98c65e7f9e8)、[2025 Skill/Context](https://www.nowcoder.com/feed/main/detail/d84d8e69cb8a4caf9c4aefb60f04d7ac)
- 阶跃星辰：[2026 企业面经页](https://www.nowcoder.com/enterprise/26710/interview)；智谱：[2026 Agent 算法](https://www.nowcoder.com/feed/main/detail/24952c828c59435abd3c302c97fa358d)；MiniMax：[2026 AI 应用开发](https://www.nowcoder.com/feed/main/detail/25aec4b727ac4985a7b83fa1e05594e8)、[2026 平台研发](https://www.nowcoder.com/feed/main/detail/5f9c694727504dee91f57b251702c607)

### 官方岗位与技术方向

- [百度 2027 AIDU 智能体算法工程师](https://talent.baidu.com/jobs/detail/GRADUATE/4f1cbc80-8332-4a92-b8fa-c0132b17d47e)
- [京东大模型应用算法/开发专家（Agent）](https://zhaopin.jd.com/web/job-info-detail?requementId=219681)
- [京东大模型智能体岗位（Skills/Subagents/Harness）](https://zhaopin.jd.com/web/job-info-detail?requementId=219868)
- [字节 AI Agent Memory Infrastructure](https://joinbytedance.com/search/7626144409813387573)
- [字节 Seed Early Career](https://seed.bytedance.com/zh/seedearlycareer)
- [阿里 2027 校园招聘](https://campus-talent.alibaba.com/campus/gov)
- [美团 CatPaw Agent 平台技术文章](https://tech.meituan.com/2026/07/28/CatPaw-LongCat.html)
- [小米全球顶尖人才前沿课题](https://hr.xiaomi.com/website/top-talent.html)
- [华为挑战课题专项招聘](https://career.huawei.com/cn/young-genius)

### 本项目源码分析

- [Pi Agent 源码详解](/blog/pi-agent-source-analysis/)
- [OpenAI Codex 源码详解](/blog/openai-codex-source-analysis/)
- [DeepSeek Harness 源码详解](/blog/deepseek-harness-source-analysis/)
- [Claude Code 源码详解](/blog/claude-code-source-analysis/)
- [Agent Loop 与工具执行](/blog/coding-agent-loop-tools/)
- [权限、沙箱、信任与扩展](/blog/coding-agent-security-extensions/)
- [上下文、会话、压缩与子代理](/blog/coding-agent-context-session-subagents/)
- [接口与可观测性](/blog/coding-agent-interfaces-observability/)
