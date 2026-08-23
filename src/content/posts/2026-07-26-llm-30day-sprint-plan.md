---
title: "大模型算法岗 30 天冲刺计划"
description: "把力扣、模型手写、面经知识和投递压进 30 天；含 2026-08-23 重排规则、逐日表和最终验收线。"
date: 2026-07-26
updatedDate: 2026-08-23
tags:
  - ai
  - interview
  - career
  - planning
featured: false
draft: false
lang: zh-CN
series: llm-algo-job-hunt
seriesOrder: 4
---
> 本文是个人求职工作区文档的发布版，更新于 2026-08-23。源文件与后续动态更新托管在 GitHub 仓库 [llm-algo-job-notes](https://github.com/keepkeen/llm-algo-job-notes)；公开面经与招聘信息均按正文证据等级使用，投递前请重新打开官方页面。

> 目标：一个月内把力扣/笔试算法、模型手写、面经知识三条线全部过完一轮并达到可投递线，赶上 2027 届秋招提前批与 8 月正式批笔试高峰。
>
> 假设：每天可投入约 8 小时（上午 3h 算法 + 下午 3h 知识卡与手写 + 晚上 2h 自测复盘）。时间不足时按文末"降载规则"砍，不要平均缩水。
>
> 原则：**先投再学**（指南 10.1）。边复习边面试，面试本身就是最好的复习。

> **2026-08-23 重排说明**：按原日历今天是 D25。如果 D1–D24 已完成 ≥80%，直接执行 D25–D30，并在 8.29 起进入维持模式；如果此前没有实际执行或完成率不足 80%，不要把未做项目勾掉——从今天把 D1 重新编号为新 D1，整体平移到 2026-09-21。无论走哪条线，今天的拼多多/阿里星截止和已收到的笔试面试通知优先于训练表。

## 0. 立刻要做的事（Day 0，2026-07-30）

- [ ] 打开[招聘窗口与刷新日志](/blog/recruit-window-refresh-log/)，逐条核验 P0 官方页；旧帖子里的 deadline 一律不直接使用。
- [ ] 今天完成第一批至少 2 个岗位投递，本周完成 10 家；每条保存岗位 ID、简历版本、投递时间和下一次跟进日。
- [ ] 简历母版按指南 10.6 定稿（后训练版/Agent 版二选一为主线，多模态版作为定向重排）。
- [ ] 先运行两套自动测试，记录当前真实基线；“参考实现通过”不能替代本人盲写。

## 1. 三条线与资料地图

| 线 | 用什么资料 | 怎么用 |
|---|---|---|
| A 力扣与笔试算法 | [作战手册](/blog/algo-written-exam-playbook/)（P0/P1 清单 + 2026 年 4–7 月增量节）、[Hot100 模板](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/%E7%BA%AF%E5%8A%9B%E6%89%A3%E7%AE%97%E6%B3%95/%E5%9F%BA%E7%A1%80/Hot100%E7%AE%97%E6%B3%95%E6%A8%A1%E6%9D%BF%E4%B8%8E%E5%86%B3%E7%AD%96%E6%9C%AF.md)、[组合题决策树](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/%E7%BA%AF%E5%8A%9B%E6%89%A3%E7%AE%97%E6%B3%95/%E5%BA%94%E8%AF%95/%E5%A4%A7%E5%8E%82%E7%AC%94%E8%AF%95%E6%A8%A1%E5%BC%8F%E8%AF%86%E5%88%AB%E4%B8%8E%E7%BB%84%E5%90%88%E9%A2%98%E5%86%B3%E7%AD%96%E6%A0%91.md)、[ACM 速查](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/%E7%BA%AF%E5%8A%9B%E6%89%A3%E7%AE%97%E6%B3%95/%E5%BA%94%E8%AF%95/ACM%E8%BE%93%E5%85%A5%E8%BE%93%E5%87%BA%E9%80%9F%E6%9F%A5.md)、[进阶模板](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/%E7%BA%AF%E5%8A%9B%E6%89%A3%E7%AE%97%E6%B3%95/%E8%BF%9B%E9%98%B6%E5%AE%9E%E7%8E%B0/templates/algorithm_exam_advanced.py) | 做题 + 24h/7d 盲写复写；不通读，按周主题查 |
| B 模型/ML 手写 | [模型手写验收矩阵](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/AI%E7%AE%97%E6%B3%95/%E6%A8%A1%E5%9E%8B%E6%89%8B%E5%86%99/%E6%A8%A1%E5%9E%8B%E6%89%8B%E5%86%99%E8%83%BD%E5%8A%9B%E9%AA%8C%E6%94%B6%E7%9F%A9%E9%98%B5.md)、[LLM 核心实现](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/AI%E7%AE%97%E6%B3%95/%E6%A8%A1%E5%9E%8B%E6%89%8B%E5%86%99/templates/llm_interview_coding.py)、[题库与证据 §3.2](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/AI%E7%AE%97%E6%B3%95/%E9%A2%98%E5%BA%93/LLM%E7%AE%97%E6%B3%95%E5%B2%97%E9%A2%98%E5%BA%93%E4%B8%8E%E8%AF%81%E6%8D%AE.md)、[ML-AI-Coding 补丁](/blog/ml-ai-coding-patch/) | 每天从空文件写 1 个模块，跑通边界测试；参考实现通过不代替盲写 |
| C 面经知识 | [求职指南 §9.6](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/AI%E7%AE%97%E6%B3%95/%E7%9F%A5%E8%AF%86/LLM%E7%AE%97%E6%B3%95%E5%B2%97%E6%B1%82%E8%81%8C%E6%8C%87%E5%8D%97.md)（51 张答案卡 T/R/A/P）+ [题库与证据 §4](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/AI%E7%AE%97%E6%B3%95/%E9%A2%98%E5%BA%93/LLM%E7%AE%97%E6%B3%95%E5%B2%97%E9%A2%98%E5%BA%93%E4%B8%8E%E8%AF%81%E6%8D%AE.md)（N1–N22）+ 指南 §3.6–3.8（趋势） | 每天 3–4 张卡：先自答再对卡，用"合格答案模板"六步口述 |
| D 投递与模拟 | [招聘窗口日志](/blog/recruit-window-refresh-log/)、[综合模拟卷](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/%E6%A8%A1%E6%8B%9F%E8%80%83%E8%AF%95/README.md)、[模拟与弱项记录](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/%E8%AE%A1%E5%88%92%E4%B8%8E%E5%A4%8D%E7%9B%98/%E6%A8%A1%E6%8B%9F%E4%B8%8E%E5%BC%B1%E9%A1%B9%E8%AE%B0%E5%BD%95.md)、指南 §10–11 | Day 1 起投递；W2 起每周 mock；每场必须留成绩和复写 |

**读的顺序上只需要通读三处**：指南 §3.8（2026 七个信号，10 分钟）、题库 §6（两周优先级）、作战手册"2026 年 4–7 月增量"节。其余全部按下表当天用到才翻。

## 2. 四周总览

| 周 | A 算法线 | B 手写线 | C 知识线 | 里程碑 |
|---|---|---|---|---|
| W1（7.30–8.5） | P0 基础：哈希/双指针/滑窗/前缀和/二分/栈堆链表/树图，约 25 题 + ACM I/O | Transformer 基础件 6 个 | 训练模块：T1–T16 + N7/N9/N12/N21 | 投完第一批；25 题；6 件盲写 |
| W2（8.6–8.12） | P0 DP + 竞赛骨架：二分答案/差分/DSU/Fenwick/二维前缀和，约 20 题 | 后训练件 6 个 | RL 模块：R1–R14 + N4/N5/N6/N13/N14/N22 | 首场 90min 模拟；首次 RL mock |
| W3（8.13–8.19） | 骨架收尾：最短路/单调队列/基环树/状压 BFS/MITM，约 12 题；重心转 ML 专场 | ML/AI Coding 专场件 8 个 | Agent/RAG 模块：A1–A14 + N2/N8/N19/N20 | ML 四模块过边界测试；Agent mock |
| W4（8.20–8.28） | 4 场 120min 套卷模拟 + 错题回炉 | 全部件盲写抽查 | N1/N3/N15–N18 + 多模态（§7.1）+ 项目 P1–P7 + 公司定向复盘 | 达到可投递线全部 5 条 |

## 3. 逐日安排

### W1：算法基础 + 训练模块（7.30–8.5）

| 日 | 上午·算法（A） | 下午·手写（B） | 晚上·知识卡（C） |
|---|---|---|---|
| D1 7.30 | 哈希/双指针：LC 1、15、49、128 | stable softmax/logsumexp + 交叉熵 | T1 数据→checkpoint、T2 Tokenizer；投递 |
| D2 7.31 | 滑窗：LC 3、76、239、560 | 手写 MHA（shape/mask/scale） | T3 Attention 公式、T4 Norm；N9 ML/数学自查 |
| D3 8.1 | 二分：LC 34、153、875、1011 | MHA 加 RoPE + RMSNorm | T5 RoPE 长上下文、T6 MQA/GQA/MLA+KV Cache |
| D4 8.2 | 栈/堆/链表：LC 146(LRU)、206、21、394 | response-only SFT loss（shift/-100/mask） | T7 SwiGLU/MoE/参数量 6ND、T8 显存 14B 例、N7 显存定量 |
| D5 8.3 | 树：LC 102、236、994 + 编辑距离 72 | LoRA 线性层（W0x+sBAx、merge） | T9 并行 DDP/ZeRO/TP、T10 混合精度/FlashAttn |
| D6 8.4 | 图：LC 200、207、1697 + 钥匙和房间 841 | 最小 BPE tokenizer（encode/decode 往返） | T11 loss spike/NaN/OOM、T12 SFT/LoRA/复读、N12 数据过滤 |
| D7 8.5 | ACM 改造日：把本周 4 道函数题改多测 ACM；90min 混合小测 | 本周 6 件全部空文件盲写一遍 | T13 继续预训练/RAG/DPO 选型、T14 蒸馏合并、T15 resume、T16 推理两阶段；N21 数据工程（字节 TikTok 整场数据工程一面就考这个） |

**W1 验收**：随机抽 8 道本周题，≥6 道 20 分钟内独立写对；6 个手写件盲写通过；能口算 7B/14B 训练显存。

### W2：DP/竞赛骨架 + 后训练 RL（8.6–8.12）

| 日 | 上午·算法（A） | 下午·手写（B） | 晚上·知识卡（C） |
|---|---|---|---|
| D8 8.6 | 线性 DP：LC 53(要求输出方案)、198、300 | temperature + top-k/top-p 采样（PDD-26-03 原题） | R1 为什么 RL/MDP、R2 RM 与 Value |
| D9 8.7 | 背包：LC 322(输出组合)、416、零钱兑换 II | DPO loss（chosen/rejected 口径） | R3 PPO clipped 完整损失、R6 DPO"chosen 也下降"；快手 KS-26-03 追问清单自测 |
| D10 8.8 | 字符串 DP：LC 1143、1246、5(最长回文子串) | GRPO clipped surrogate（group mask、零方差组） | R7 GRPO 退化与偏差、N6 normalization；字节 BY-26-04"KL 怎么算"自测 |
| D11 8.9 | 二分答案 + 差分：LC 1552、小米差分题型、区间覆盖 | MoE 前向（router/top-k/负载统计，美团 MT-26-01 手撕原题） | R8 DAPO/GSPO、N5 边界；R9 怎么选 |
| D12 8.10 | DSU + Fenwick：LC 307、逆序删边 DSU、二维前缀和 304 | GQA（KV head 复用，米哈游 MHY-26-01 手撕原题） | R4 异步 rollout/policy lag、R11 TRL vs veRL、R13 hacking/熵坍缩 |
| D13 8.11 | 贪心专练：LC 45、55、135(候选糖果=京东粽子题)、995 | PPO 训练循环伪码 + KL 发散排查清单 | R5 KL 两方向、R10 OPD、N22 奖励密度谱系、N13 RLVR 因果、N14 GRM |
| D14 8.12 | 90min 模拟（作战手册 2026-04-19 字节卷风格）+ 复盘 | 本周 6 件盲写 | R12 reward 设计、R14 credit assignment、N4；**自我 mock：口述 PPO/DPO/GRPO/DAPO/GSPO/OPD 一张表** |

**W2 验收**：GRPO/DPO/SFT loss 全部能空文件盲写并过边界；被追问"π_θ/π_old/π_ref 是谁""为什么组内归一化""β 大小影响"能秒答（这些是 2026 一面即问的实录题）。

### W3：ML 专场 + Agent/RAG/评测（8.13–8.19）

| 日 | 上午·算法（A） | 下午·手写（B） | 晚上·知识卡（C） |
|---|---|---|---|
| D15 8.13 | 最短路/分层：LC 787、Dijkstra 模板 | 对数域 Viterbi（蚂蚁 2026-04-09 笔试原型） | A1 Agent/Workflow 边界、A2 工具契约 |
| D16 8.14 | 单调队列/栈：LC 239 复写、GPU batch 调度题（拼多多 7.19） | IRLS 逻辑回归 + 决策树桩（美团笔试原型） | A3 MCP/Skill、N19 Agent 工程化生态（蚂蚁 ANT-26-01 实录：harness、skill 差异、会话变慢） |
| D17 8.15 | 基环树/函数图：LC 2360 + 拼多多抓苍蝇题型 | CLIP 对比损失（拼多多 7.2 笔试原题）+ InfoNCE | A4 RAG 全链路、A5 PDF/多模态入库、N8 RAG 归因 |
| D18 8.16 | 状压 BFS：LC 847 + 华为 7.15 轨迹压缩题型 | KV Cache 淘汰模拟 + RoPE 公式模拟（华为 AI 岗机考两道原型） | A6 故障定位/rerank 负收益、A11 热更新缓存；百度 BD-26-02 的 chunk=512 权衡自测 |
| D19 8.17 | MITM：LC 1755 + 携程四元组异或题型 | 流式 tokenizer（DeepSeek 7.12 机考原型）+ 简化向量检索 | A7 Memory/上下文、A8 Reflection/Multi-Agent、A12 DeepResearch |
| D20 8.18 | SQL 专练：连续登录、ROW_NUMBER 前三、累计首次达成（拼多多 7.2 数据卷三题） | sklearn Pipeline+StratifiedKFold+GridSearchCV（携程 5.21 原型）+ tool wrapper | A9 Agent 训练数据、A10 停止/防循环、A13 评测 pass@k、N20 LLM-as-a-Judge（rubric/swap consistency/打分方差） |
| D21 8.19 | 90min 模拟（美团算法专场风格：2 算法 + 1 ML 手写）| RAG evaluator（Hit@k/MRR 不混名） | A14 注入与防御、N2 推理时计算；**自我 mock：完整讲一遍"设计两个 Agent 对话系统"（蚂蚁实录场景题）** |

**W3 验收**：AI Coding 六条验收线全过（README 标准）+ 新四件（CLIP/决策树桩/KV Cache/流式 tokenizer）可运行；Agent 卡片全部能按"何时停/怎么恢复/怎么评测"三问口述。

### W4：新考点 + 项目答辩 + 套卷冲刺（8.20–8.28）

| 日 | 上午 | 下午 | 晚上 |
|---|---|---|---|
| D22 8.20 | 120min 套卷①（拼多多 7.19 通用卷复现） | 错题修复 | N17 DSA/两级注意力、N18 线性注意力混合（会推 KV 显存收益） |
| D23 8.21 | 120min 套卷②（华为 AI 岗：20 选择+2 编程，选择题按题库 §2.21/作战手册华为节准备） | 错题修复 | N1 MoE 负载均衡、N3 VLM、指南 §7.1 多模态最低线（CLIP/LLaVA/BLIP-2） |
| D24 8.22 | P0 盲写大抽查：随机 20 道 Medium | 手写件抽 6 个盲写 | N15 Search-R1、N16 Visual-RFT、N10 MTP、N11 Muon（30 分钟过完，只记边界） |
| D25 8.23 | 120min 套卷③（拼多多 8.16 骨架：栈模拟+带权区间调度+Fenwick 最长路） | 错题修复；手算 NDCG@10 | P1–P4 项目卡：转型叙事/贡献/消融/最大失败——对着自己简历逐条写答案 |
| D26 8.24 | 弱项回炉；MITM 按选择个数分桶 + Apriori 剪枝各做一题 | ACM I/O 终检；搜索排序 baseline 走通 query 切分→特征→NDCG→提交 | P5–P7：上线/预算减半/防作弊；准备 3 个"项目数字"随口可报 |
| D27 8.25 | 120min 套卷④（美团/蚂蚁算法专场：算法+ML 混合） | 全部手写件最后一轮盲写 | **完整 mock ①（75min，按指南 §11 评分表自评或找人）** |
| D28 8.26 | 公司定向复盘：按已约面试的公司读题库对应章节（每家 30min） | 该公司风格手撕预演 | 指南 §3.3 逐公司提示 + §3.8 七信号重读 |
| D29 8.27 | 错题清零日：所有 7 天内错题重写 | 盲写清单终检（Fenwick/DSU/二分答案/二维前缀/背包） | **完整 mock ②**；复盘表归档 |
| D30 8.28 | 休整 + 面试前 48h 清单（指南 §10.7）：官网 JD、目标团队最新模型版本、自己项目数字 | — | 总验收（见 §5） |

## 4. 手撕高频清单（按 2025–2026 实录频率排序，必须全会）

**力扣侧**（出现 ≥2 次的实录）：
1. 最长无重复子串 LC 3（字节/阿里国际/混元，3+ 次）
2. 快速排序（阿里国际/百度，"高频得不能再高"）
3. 编辑距离 LC 72（字节/快手）
4. 三数之和 LC 15、两数之和 LC 1（快手/小红书）
5. 最长回文子串 LC 5 / 回文变体（小鹏/快手/拼多多）
6. 零钱兑换 LC 322 + II（百度/网易/腾讯）
7. 反转链表 LC 206、合并有序链表 LC 21（小米/蔚来/快手/智谱）
8. 滑动窗口最大值 LC 239（滴滴/昆仑）
9. 层序遍历 LC 102、岛屿数量 LC 200、钥匙和房间 LC 841（快手/网易）
10. LRU LC 146（京东）；最大子数组和+输出方案 LC 53（京东）
11. 冷门但已出现：最小生成树（蚂蚁）、卡特兰数 DP（小红书）、rand7→rand10（阿里国际）、洗牌 O(1)（小鹏）、高精度开 n 次根（字节）

**模型侧**（题库 §3.2 全 17 项，按周分配见上；最高频 5 件）：
MHA/GQA（字节两轮手写、米哈游、滴滴）> response-only SFT loss > GRPO/DPO loss > top-k 采样（拼多多）> MoE 前向（美团）。
**新形态**：流式输出+MCP 调用规范（智谱）、AI Coding+AUC 诊断（淘天）——W3 的 tool wrapper 和流式 tokenizer 就是为这类准备。

## 5. 最终验收线（D30 全部打钩才算完成）

- [ ] 随机 20 道 P0 Medium，17 道 20 分钟内独立写对
- [ ] 4 场 120min 套卷至少 3 场拿下前两题 + 第三题有效分
- [ ] Fenwick、DSU、二分答案、二维前缀和、0/1 背包空文件盲写
- [ ] 手写件 17 项全部盲写过边界测试（重点 5 件能 15 分钟内写完）
- [ ] 51 张答案卡 + N1–N22：随机抽 10 张，能按六步模板（定义→公式/数据流→量级→失败模式→最小实验→落到项目）口述 8 张
- [ ] 两场完整 mock 按 §11 量表 ≥70 分
- [ ] 投递 ≥30 家；动态日志中的 P0/P1 均有最后核验日、岗位 ID 和状态

## 6. 每日模板与复盘规则

1. 上午第一件事：15 分钟盲写昨天的一个模板/手写件。
2. 每道错题：24 小时后无提示重写，7 天后再抽查（错题池就是 D29 的清单）。
3. 每天睡前 10 分钟：把当天知识卡里"自答失败"的问题记进一个 `弱项.md`，W4 只复习这个文件。
4. 有面试的日子：面试 > 计划。面后 30 分钟内把被问到的题记下来对照题库，缺的当天补卡。

## 7. 降载规则（时间不够时按顺序砍）

1. 先砍 W4 的 N10/N11/N15/N16（论文驱动冷门卡）→ 只读结论。
2. 再砍算法 P1（LC 787/1755/状压/基环树）→ 保 P0 盲写质量。
3. 再把 51 卡从"口述"降为"读卡+标弱项"。
4. **永远不砍**：手撕高频 5 件、GRPO/DPO 细节、P0 力扣 20 题抽查、投递。
5. 如果每天只有 4 小时：只做上午算法块 + 晚上知识卡，手写件隔天一个，周期拉长到 6 周（用 README 的六周表）。
---

原始文档：[GitHub 源文件](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/%E8%AE%A1%E5%88%92%E4%B8%8E%E5%A4%8D%E7%9B%98/30%E5%A4%A9%E5%86%B2%E5%88%BA%E8%AE%A1%E5%88%92.md)。
