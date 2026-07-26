---
title: "2025—2027 大模型算法岗题库与证据账本"
description: "按证据分级整理的大厂大模型算法岗公开面经账本：约 75 组样本、22 张知识缺口答案卡，明确区分公开事实与预测。"
date: 2026-07-26
tags:
  - ai
  - llm
  - interview
  - career
featured: false
draft: false
lang: zh-CN
series: llm-algo-job-hunt
seriesOrder: 2
---

> 本文是个人求职工作区文档的发布版，最后核验 2026-07-26。文档源文件与可运行模板、测试托管在 GitHub 仓库 [llm-algo-job-notes](https://github.com/keepkeen/llm-algo-job-notes)；文中所有面经均为公开帖子的转述，证据分级见正文说明。

> 最后核验：2026-07-26（第四轮检索：新增 2026 年 27 届暑期实习与 2027 届提前批样本、13 家新公司章节、N17—N22 答案卡）
>
> 用途：配合[《LLM 算法岗求职指南》](/blog/llm-algo-interview-guide/)使用。本文件记录“公开材料里出现了什么题”和新增知识缺口；主指南负责系统讲解。
>
> 重要边界：2027 年秋招尚未发生。本文件所有 2027 内容都是基于 2025—2026 公开样本和官方岗位/技术方向的预测，不是真实面经。
>
> 岗位边界：只收基座/预训练、后训练/RL、Agent/RAG、多模态及与模型效果直接相关的数据/评测问题；纯推理引擎、CUDA/kernel、通信库、编译器、Serving 调度和硬件适配岗位不在目标范围。算法岗仍需掌握显存、KV Cache 和训推一致性的最低边界，因为这些会直接影响训练与 RL 实验是否成立。

## 1. 证据规则

### 1.1 等级

| 标记 | 含义 | 可以怎样用 |
|---|---|---|
| `B` | 帖子自述为候选人亲历，且公司、岗位、日期或轮次较清楚 | 证明“这场公开复盘声称问过”，仍不能推断全公司频率 |
| `B-` | 日期/岗位/轮次不完整，来自合集，或账号带明显整理属性 | 只进入候选题池，必须二次核验 |
| `A-JD` | 公司官方或可追溯岗位描述 | 判断技能方向，不能改写成真题 |
| `A-Tech` | 原论文、官方实现、官方技术文档 | 核验答案，不证明面试出现过 |
| `P` | 对 2027 的预测 | 只用于准备优先级，绝不计入历史题量 |

### 1.2 使用限制

- 日期优先记录帖子明确写出的面试/届别；只有发布日期时写“页面日期”，不擅自当作面试日。
- 问题全部是转述，不把帖子里的参考答案当权威答案。
- 同一帖子的一组问题算一个公开样本，不按题数制造“高频”。
- 公司、团队、岗位方向和候选人项目对题目的影响通常大于公司名。
- 牛客内容无法独立证明作者确实参加过面试，因此这里使用“帖子自述/公开复盘”的谨慎表述。

## 2. 公开复盘题目（主窗口 2025—2026；2.20 为窗口外画像样本）

### 2.1 字节跳动

#### BY-25-01｜大模型算法一面｜2025｜`B`

来源：[公开复盘，页面 2025-08-11](https://www.nowcoder.com/feed/main/detail/aa20f3b350b94880b64a4139ee4e515c)

- RAG 为什么选当前 embedding，相似度如何算，召回后为什么还要 rerank；
- 知识图谱与 RAG 为什么可以同时存在，各解决什么问题；
- SFT 数据如何生成，是否只对 response token 计算 loss；
- 从公式和数据流解释 GRPO、组采样、advantage 与 reward 修改；
- 手写 response-only SFT loss 和 temperature sampling；
- 有序数组中目标值出现次数，要求二分定位左右边界。

#### BY-25-02｜SeedLM 二面｜2025｜`B`

来源：[公开复盘，页面 2025-04-02](https://www.nowcoder.com/feed/main/detail/5b0fc2ba1157494d9a2d94d7db01e051)

- Transformer decoder 与 LLaMA 的结构差异；
- 正弦位置编码与 RoPE 形式相似，但注入 attention 的方式为何不同；
- RLHF 全流程、Reward Model 类型和训练目标；
- DPO loss 如何得到，有哪些可改进点；
- 找数组中的唯一重复数；手写 MHA 并加入位置编码。

#### BY-25-03｜26 届秋招三轮｜2025｜`B`

来源：[公开复盘，页面 2025-11-01](https://www.nowcoder.com/feed/main/detail/029a292419294b4a8227acde5a00124b)

- 从原始数据到训练 batch 设计完整数据 pipeline；
- GRPO 与 DeepSeek-R1 的分阶段训练、奖励设计；
- 怎样把 RL 引入候选人的实际业务，而不是只复述论文；
- Agent 项目的状态、工具、终态指标和失败案例；
- 编辑距离；两轮均要求手写 MHA。

#### BY-26-01｜27 届暑期大模型算法一面｜2026｜`B`

来源：[公开复盘，页面自述为 27 届暑期](https://www.nowcoder.com/feed/main/detail/28b254940eb940189188d795f4606c52)

- Agent 行为怎样做过程奖励；轨迹级 reward 如何分配到 token；
- 长尾 rollout 拖慢 GPU 时，调度、截断、采样和训练目标怎样联动处理；
- DAPO 与 GRPO 的 clip、采样和 loss aggregation 差异；
- MoE 的 rollout 路由与训练路由为何不一致；GSPO 试图解决什么。

#### BY-26-02｜TikTok 大模型算法实习一面｜2026｜`B`

来源：[公开复盘，页面 2026-03-23](https://www.nowcoder.com/feed/main/detail/bfbdc21d644241579529e520a173938c)

- 数据合成方法与优化；数据标注方式与优化；
- 数据混合怎样保证多样性；去重与多样性怎样平衡；聚类去重怎么做；
- SFT 高质量数据清洗从哪些维度做；预训练数据下采样时怎样保持多样性；
- 小语种数据怎样低成本合成；LoRA 相对全参微调的显存优势；
- 手写"高精度开 n 次根号"。

> 一整场几乎全是数据工程；发帖账号用语模板化，题目具体可信但不据此推频率。

#### BY-26-03｜豆包大模型算法一面｜2026｜`B`

来源：[公开复盘，页面 2026-03-25](https://www.nowcoder.com/feed/main/detail/6a90ead033ce48889f7d724ddbe4d417)

- 知识库怎样构建；基于知识库的召回与作答全流程；文档类型；
- 多路召回每路取多少、权重怎样设；单路与多路召回怎样对比评估；
- 用 LangChain 还是从零搭，用了多少节点，大模型怎样调用；还了解哪些 Agent 框架。

> 一面完全围绕 RAG/Agent 工程链路，无手撕记录。

#### BY-26-04｜大模型算法实习一面｜2026｜`B`

来源：[公开复盘，页面 2026-04-14](https://www.nowcoder.com/feed/main/detail/cf4b6a0aa7f74b9c93a69e4c153e7ce5)

- 项目拷打（一个 RL 项目、一个大模型项目）；
- GRPO 有什么改进；GRPO 里 KL 散度怎么计算；
- 手写最长无重复子串。

#### BY-26-05｜番茄小说推荐大模型一面｜2026｜`B-`

来源：[公开复盘，页面 2026-07-09，账号有整理属性](https://www.nowcoder.com/feed/main/detail/3cb01002b3204cebb63501a53ebdc2ac)

- 推荐项目深挖；LHUC 独立建 Embedding 与复用主干 Embedding 的差异；
- 新用户交互稀疏的优化；冷启动到用户 Embedding 主导的动态切换；
- LayerNorm 在深网络中的作用；RankMixer/OneTrans 序列排序架构。

> 相邻推荐大模型岗；也是目前少见落在 2027 届提前批窗口（2026-07）的字节样本。

### 2.2 阿里巴巴与蚂蚁

#### ALI-25-01｜淘工厂大模型一面｜2025｜`B`

来源：[公开复盘，页面 2025-12-11](https://www.nowcoder.com/feed/main/detail/d553eddb3de84dff87496a440f370f3b)

- 推导 MoE 负载均衡损失，如何诊断和防止 expert collapse；
- 推导标准 MHA/GQA 的 KV Cache 大小与 attention 复杂度；
- 对比学习损失与重构损失怎样加权，如何证明不是拍脑袋；
- Qwen 微调时 validation loss 震荡如何定位；
- 激活量化溢出如何复现、定界和修复；
- 多工具调用怎样用 DAG 并行调度；
- 怎样设计实验区分知识幻觉和推理幻觉。

#### ALI-25-02｜阿里控股机器学习｜26 届秋招｜`B`

来源：[公开复盘，页面 2025](https://www.nowcoder.com/feed/main/detail/360ba31f35604227a5cfdedaf6aa80c5)

- LoRA 应接在哪些线性层，rank 影响参数量、容量和稳定性的机制；
- 少数据时怎样在全参 SFT、LoRA 和只做 prompt baseline 间选择；
- DeepSeek-R1 的训练阶段与传统 RLHF 流程有何异同。

#### ANT-25-01｜Agent 算法二面｜2025｜`B`

来源：[公开复盘，页面 2025-11-30](https://www.nowcoder.com/feed/main/detail/7d54ef121e484997b14addceb2d23b03)

- system prompt 如何迭代，能否自动优化，如何避免在验证集上过拟合；
- 用户意图不完整时怎样澄清、补全和安全拒绝；
- 多用户并发时 memory 怎样隔离，冲突写入怎样保证一致性；
- 微调样本如何筛选清洗，哪些质量问题会显著改变模型行为；
- Agent preference pair 如何构造，怎样避免 chosen/rejected 的 shortcut；
- vLLM/KV Cache 为什么加速，streaming 延迟超标时怎样取舍；
- 工具调用怎样做超时、幂等、重试、失败反馈和人工升级。

#### ANT-25-02｜网银 NLP 算法一面｜2025｜`B`

来源：[公开复盘，页面含 4/25 一面时间线](https://www.nowcoder.com/discuss/746715889906495488)

- token 到 embedding 的完整过程；
- self-attention 与 cross-attention 的输入、mask 和使用场景；
- pre-norm 与 post-norm；LoRA；
- teacher forcing 带来的训练—推理 gap 如何缓解。

#### ALI-26-01｜淘天（淘宝闪购）Agent 算法 27 届实习一面｜2026｜`B`

来源：[公开复盘，页面 2026-04-30，约 60 分钟](https://www.nowcoder.com/discuss/879393838081597440)

- 为何选 OpenAI Agents SDK 而非开源框架；
- Human-in-the-Loop 与人工强制中断怎样处理；高风险在线环境的 Agent 异常管控；
- Token 用量规模；长周期对话的历史管理；对比不同 Agent 产品的记忆机制；
- 除 API 调用外的 SFT/模型层经验；你的 Agent 与他人的核心差异；
- AI Coding 压轴：本地 AUC 92% 上线后 62%，从数据、标签、serving 三个维度分析原因并排序。

> 全程项目深挖、无笔试；AI Coding 允许用大模型完成，再追问思路。

#### ALI-26-02｜通义多模态算法一面｜2026｜`B`

来源：[公开复盘，页面 2026-05-09](https://www.nowcoder.com/feed/main/detail/e317fb7cb6a64174ab1788da90c897a7)

- 论文新增模块是否会破坏预训练能力，怎样规避；
- 方法在更大模型尺寸上的泛化怎样评估；
- Reward 机制设计与原理；不改架构能否达到论文效果；
- 明确无手撕。研究向一面全部围绕论文与 reward 设计。

#### ALI-26-03｜阿里国际 AI 算法（对话对齐）｜2026｜`B-`

来源：[公开复盘，页面 2026-05-13，账号整理属性明显](https://www.nowcoder.com/feed/main/detail/21fe1ff2b5de4c6fa2a56a27b54f3d3c)

- GRPO 选型原因、优化目标与数学原理；奖励函数设计；RL 训练质量评估；Reward Hacking 案例；
- Attention 复杂度；KV Cache、GQA、MLA、FlashAttention、稀疏注意力；推理慢的排查思路；
- 手写 rand7 实现 rand10、浮点数组取整最小变化和、最长无重复子串。

#### ALI-26-04｜阿里国际算法 27 届实习二面｜2026｜`B-`

来源：[公开复盘，页面 2026-05-02](https://www.nowcoder.com/feed/main/detail/0898d57cd4514487a20b56fa88c4fd14)

- 是否考虑向量/图检索，避免每次调大模型；正负样本比例与效果；Prompt 设计方法；
- Transformer 归一化实现方式；位置编码方案；手写快速排序。

#### ANT-26-01｜蚂蚁 Agent 算法 27 届暑期一面｜2026｜`B`

来源：[公开复盘，页面 2026-05-07](https://www.nowcoder.com/feed/main/detail/8af3f3bce1aa478a8a2c688853b4210f)

- Agent 不适配其他手机机型怎样处理；日志为什么并发处理；
- Coding Agent 产品响应速度为何随会话变长而变慢；
- 自研 LangGraph Agent 中 VL 模型与文本模型怎样分工；
- 向量库相似度计算的优化；Agent 的 harness 能力体现在哪；
- 不同 Coding Agent 在创建 skill 时的差异；哪些 Agent 形态会被淘汰；
- 场景题：设计"两个不同 Agent 产品互相对话"的系统方案，需要加哪些模块。

> 题面高度绑定 2026 年 Agent 工具生态（Claude Code、skill、harness），无手撕记录。

#### ANT-26-02｜蚂蚁大模型算法实习一面｜2026｜`B`

来源：[公开复盘，页面 2026-03-27，约 1 小时](https://www.nowcoder.com/feed/main/detail/46dc3bfc070a4128bb63cfc91003f509)

- Dense 与 MoE 区别；MoE 路由机制实现；
- 验证集怎么选；SFT 方法；讲 PPO；RAG 项目；分类任务评测指标；
- LoRA 原理、A/B 矩阵初始化、秩设多少；
- 手写最小生成树。

#### ANT-26-03｜蚂蚁 Code Agent 与 Agent 应用开发一、二面｜2026｜`B-`

来源：[整理属性明显且带辅导导流的复盘，页面 2026-04-25](https://www.nowcoder.com/feed/main/detail/05c60e2987aa45b784be56ae43b8c5fa)

- 工程级 Code Agent 处理项目上下文与代码生成的核心挑战；
- 保障 AI 生成代码质量、安全、可控的系统方法；生成代码正确性验证与治理；
- 上下文工程、RAG 与渐进式披露的关系。

> 帖内自造术语不作为行业事实引用；只进入候选题池。

### 2.3 腾讯

#### TX-25-01｜混元大模型｜2025｜`B`

来源：[公开复盘，页面 2025-09-24](https://www.nowcoder.com/discuss/800417287118340096)

- SFT 数据怎样构造，人工标注比例与数据量如何辩护；
- Qwen3 的 thinking/non-thinking 模式是什么，怎样做非推理模式微调；
- 是否量化，量化后与 prompt 直出的等预算基线差多少；
- Qwen3/RoPE；最长公共子序列二维 DP。

#### TX-26-01｜混元大模型算法一面｜2026｜`B`

来源：[公开复盘，页面 2026-03-24](https://www.nowcoder.com/feed/main/detail/a6635434f01241118fff6629de73b95a)

- CKA 指标怎么算，用它评估对齐程度是否有效；
- ModalityAdapter 模块设计、作用机制与消融；
- 对比学习正负样本构造、难分样本处理、是否用困难样本挖掘；
- 多 Loss（MSE+Contrastive+KL）组合理由；是否出现 loss 冲突；
- 知识库是否静态、向量索引方案；医疗幻觉怎样避免与评估；
- 车端部署推理框架选型对比与理由；14B 车端模型 SFT 数据构建与评测体系；
- 车载 Agent 平台链路调度、多轮对话状态维护；Rewrite 模型输入输出、放检索前还是后、训练数据构造；
- 场景题：摄像头+力传感器做驾驶员状态识别的多模态模型设计。

> 单轮题量极大，覆盖多模态、RAG、Agent、评测全链路。

#### TX-26-02｜混元 TEG 实习二、三面｜页面 2026-01｜`B-`

来源：[二面](https://www.nowcoder.com/feed/main/detail/be32d2f82c4a4d6390b9d34f9926264c)、[三面](https://www.nowcoder.com/feed/main/detail/30d3886e7f4c4a76a5f1a4f3c243dfb4)，页面 2026-01-29

- ZeRO-1/2/3 区别；ZeRO-3 微调 72B 模型的每卡显存估算及原因；
- LoRA 原理与 A/B 初始化；RLHF 全流程；SFT 后为何还需 RLHF；GRPO 相比 PPO 的改进；
- 微调数据构造、清洗与配比；手写最长无重复子串、零钱兑换 I+II。

> 与 2025-03 的一篇[混元四轮复盘](https://www.nowcoder.com/feed/main/detail/14a719792a834d42bf6d6585cb6fb98e)逐题高度重合，疑为搬运拆分；题型可用，但只按原帖计一个样本。

### 2.4 百度

#### BD-25-01｜大模型一面｜2025｜`B-`

来源：[公开复盘，账号存在整理属性](https://www.nowcoder.com/feed/main/detail/419c927fd28542c4891e09994447a3a9)

- 从海量视频中检索相关内容：抽帧、关键帧、时序索引与 rerank；
- InternVL2/VLM 训练流程，图片怎样变成视觉 token；
- 估算图文 token 数、step 数和单 epoch 时间；
- 为什么用 DPO，写出训练数据与 loss；是否训练显式 reasoning；
- 零钱兑换并输出一组具体组合。

#### BD-25-02｜提前批大模型二面｜2025｜`B`

来源：[公开复盘](https://www.nowcoder.com/feed/main/detail/88bd58fecce848559c6a15428cf07371)

- 多路召回的分数不可直接比较时，怎样训练和评估统一 reranker；
- 召回融合怎样处理重复、来源偏置和某一路完全漏召。

#### BD-26-01｜大模型 27 届暑期实习一面｜2026｜`B`

来源：[公开复盘，页面 2026-04-06](https://www.nowcoder.com/feed/main/detail/8b73da84c5c94c3b9c8e32e5b2376500)

- GRPO 常用的奖励有哪些；
- 上下文从 4-8k 到 128k 经历了哪些技术变化；
- Agent 生态里 Skill 的定义；decoder-only 为何流行；
- 模型量化；BF16 与 FP16 区别；常用优化器；U-Net 架构特点；手写快速排序。

> "Skill 的定义"是 2026 年 Agent 生态新词直接入题的例证。

#### BD-26-02｜大模型算法日常实习一面｜2026｜`B`

来源：[公开复盘，页面 2026-04-17，约 80 分钟](https://www.nowcoder.com/feed/main/detail/2a19166e45954fb2a6ccfc4fad84adc1)

- Agent 属于问答/决策/执行哪类，边界怎样定义；哪些环节必须用大模型；只用规则、检索或模板 SQL 能否对标（Agent 必要性论证）；
- RAG：知识源（API 文档/日志/DDL/Wiki）各自处理难点；入库预处理每一步解决什么问题；chunk=512 的理由及与 128/1024 的权衡；"模型上下文长度"与"知识切片长度"的概念区分；Top-k 已召回正确证据但模型仍答错怎么诊断；证据冲突或不充分时的约束手段；
- 为何 QLoRA 而非全量；SFT 本质在教什么（知识/风格/行为边界）；DPO 的 chosen/rejected 怎样定义、差异过小的后果、怎样判断 rejected 是有效负样本；
- LLM-as-a-Judge 的 rubric 硬门槛与加分项怎样划分；swap consistency 防什么；
- 消融怎样归因 RAG/SFT/DPO/Judge 各自贡献；
- 手写一道 DP；开放题：把 DPO+Judge 思路迁移到视频二创场景。

> 2026 上半年信息量最大的百度样本，接近一份 LLM 应用算法全链路考纲。

### 2.5 美团

#### MT-25-01｜大模型算法两轮｜2025/2026 页面｜`B-`

来源：[公开题目记录，账号存在整理属性](https://www.nowcoder.com/feed/main/detail/b264abf14d4d4c44bc022c9ea1dce981)

- 已有 reasoning SFT 为什么仍需要 RL；达到什么条件才切换；
- 7B 模型做 GRPO 时怎样估算权重、梯度、优化器、activation、rollout 与 KV 显存；
- 标注质量如何量化，多源 SFT 数据如何配比；
- thinking 开关对微调数据和部署有什么影响；
- 字段提取任务的 reward 怎样避免格式投机；
- reward hacking 如何发现；reward 先降后升有哪些可证伪解释。

#### MT-26-01｜大模型 27 届暑期二面｜2026｜`B`

来源：[公开复盘，页面 2026-04-21](https://www.nowcoder.com/feed/main/detail/2a6f4ec48301465084022eca621b89dc)

- Qwen 系列幻觉问题怎样处理；新版 Qwen 的推理模式切换机制；
- 当下主流 Coding Agent 产品为何流行、彼此差别；是否用过 AI 编码工具；
- MoE 原理、负载均衡方法、专家激活发生在 batch 还是 token 维度；
- 手写：用 Python 实现一个 MoE 前向。

### 2.6 快手

#### KS-25-01｜大模型岗位｜2025｜`B`

来源：[公开复盘，页面 2025-09-02](https://www.nowcoder.com/discuss/792430274750521344)

- next-token loss、CoT、Transformer、位置编码与 RoPE；
- LoRA 初始化为什么常令一侧为零，rank 怎样影响效果；
- MLA 与 MoE 的核心数据流；
- 二叉树层序遍历。

#### KS-25-02｜26 校招大模型一面｜2025｜`B`

来源：[公开复盘，页面 2025-12-30](https://www.nowcoder.com/feed/main/detail/b1da5731c34e4a3d99becef4f0a0c169)

- 8B 模型训练显存现场估算；
- RAG 错答如何区分检索责任与生成责任，设计最小归因实验；
- 通用指令、垂类问答和 CoT 数据如何配比与做消融；
- 编辑距离。

#### KS-26-01｜NLP 算法实习｜2026｜`B-`

来源：[2026-05-07 汇总页，含原帖入口](https://www.nowcoder.com/discuss/882573284426932224)

- 基座模型怎样选，全参还是 LoRA；
- 长尾样本是否重采样，复读与幻觉如何处理；
- SFT 何时转 RL；视觉和文本用什么模块对齐；
- 两数之和、三数之和。

#### KS-26-02｜大模型算法校招一面｜2026｜`B`

来源：[公开复盘，页面 2026-02-04](https://www.nowcoder.com/feed/main/detail/732fb4a7842b4dca97c18a9e864cb4f3)

- 预训练数据源与构建方法；电商领域数据怎样构造；预训练之后的 SFT 流程；
- 介绍 DAPO；去掉 KL 约束并 clip-higher 之后的稳定性问题与解决；
- Function-call 的训练方法与语料构建；
- 推理慢的原因分析；剪枝量化与线上部署方案；
- 手写最小回文串。

#### KS-26-03｜大模型算法一面｜2026｜`B`

来源：[公开复盘，页面 2026-04-22，后段付费](https://www.nowcoder.com/discuss/876503715031572480)

- 为什么用 DPO，数据来源；DPO 为何常配合 rejection sampling 而非随机负样本；
- DPO 数据为何最好来自上一版 checkpoint 的采样分布；
- DPO 公式、$\pi_\theta$ 与 $\pi_{ref}$ 的含义、$\beta$ 过大过小的影响；
- GRPO 公式；实际使用中 $\pi_\theta$ 与 $\pi_{old}$ 怎样处理；组内归一化 advantage 的原因；
- 文档类 RAG 为何不一定按固定长度分段。

> 同作者[二面帖](https://www.nowcoder.com/discuss/876505573997432832)未逐题核验，暂不计样本。

#### KS-26-04｜大模型评测一面｜2026｜`B`

来源：[公开复盘，页面 2026-04-10](https://www.nowcoder.com/feed/main/detail/bf83e85ade1c4efbb68811878dd6f8d7)

- 若公司做视频生成，初期怎样扩展评测维度、构建数据集、选 benchmark；
- 国内外视频生成模型对比；项目里评测集怎样构建、为何选这些模型；
- 手写合并两个有序链表。

> 疑与视频生成团队相关，原帖未点名具体团队。

另有两条候选池记录：[Agent 开发算法岗，页面 2026-02-08，整理属性](https://www.nowcoder.com/feed/main/detail/ed7e8ffa1f7643e293243bb7ba9b3c33)偏业务理解式提问；[推荐大模型三面，日期不明](https://www.nowcoder.com/feed/main/detail/402d6789f751489db6a8103dfdf0b126)问合成数据优缺点、离线与线上指标、推荐×LLM，手写最长回文子串并要求 O(n²) 优化到 O(n)。均 `B-`。

### 2.7 小红书

#### XHS-25-01｜NLP 算法一面｜2025｜`B`

来源：[公开复盘，页面 2025-08-12](https://www.nowcoder.com/feed/main/detail/b7a8c7865ada4bdb8c7fa9bc6fb0b741)

- 近期 LLM RL 技术，GRPO 原理与后续改进；
- DPO、MoE、Qwen3；
- RAG 缺少电商知识时怎样构建更新闭环；
- 三数之和。

#### XHS-25-02｜NLP 实习｜页面发布于 2025｜`B-`

来源：[公开复盘；正文只写 10.16，面试年份不完全确定](https://www.nowcoder.com/feed/main/detail/7046e2d24f1446e4b8947837e28f143e)

- 数据集如何构建与评估，怎样发现污染和泄漏；
- 跨模态对齐、PEFT、多智能体协作；
- SFT 与 RL 分别适合什么场景，怎样做公平对照。

#### XHS-26-01｜大模型实习一面｜2026｜`B`

来源：[公开复盘，页面 2026-03-31](https://www.nowcoder.com/feed/main/detail/13da3468f6f8486e8536a0a443df6742)

- Embedding 模型预训练/微调怎样提点；参数量与性能关系；蒸馏与量化经验；
- RAG 低延迟问题；意图分类标签体系设计；query 改写是否用了 RL；query 质量怎样评估；
- LLM 的文本理解会否降低对传统 embedding 模型的依赖；
- 大模型在文本分类等传统任务上为何没有表现出涌现；
- 手写：卡特兰数推导递推式并用 DP 实现。

#### XHS-25-03｜大模型算法｜页面 2025-12｜`B-`

来源：[整理属性明显的复盘，页面 2025-12-01](https://www.nowcoder.com/feed/main/detail/32594855133d427ab983700e238e20f7)

- 生成评测方式；RAG 缺陷；输出一致性保证；R1 训练流程与原理；
- DPO/PPO/GRPO 区别；SFT 与 RL 优缺点与适用场景；提示工程；幻觉抑制；多智能体协同。

### 2.8 拼多多 / Temu

#### PDD-25-01｜大模型算法一面｜2025｜`B`

来源：[公开复盘，自述面试时间 2025-11-08](https://www.nowcoder.com/feed/main/detail/52642a11007e440388aa28a568c2dca0)

- Transformer；PPO 与 GRPO；attention 为什么除以 $\sqrt{d_k}$；
- 在 01 矩阵中寻找四角均为 1 的矩形，并分析不同做法复杂度。

#### PDD-25-02｜Temu 搜广推/风控相邻岗，多轮｜2025｜`B`

来源：[公开复盘，页面 2025-08-29](https://www.nowcoder.com/discuss/790993306028167168)

- 大模型反欺诈系统怎样从开发到部署；Agent 框架与 prompt；
- 交叉熵加正则项后的目标；恶意退款风险特征、IV 与 PSI；
- 无重复字符最长子串、三数之和、最大连续登录天数 SQL。

> 这是一条相邻岗位记录，不能把其中所有问题都标成“基础模型岗真题”。

#### PDD-26-01｜搜广推大模型一面｜2026｜`B`

来源：[公开复盘，自述 2026-07-15](https://www.nowcoder.com/discuss/906953010406772736)

- On-Policy Distillation 中 forward KL 与 reverse KL 各自的 mode-covering/mode-seeking 倾向；
- PPO ratio 已经 clip，目标为何还要对 unclipped/clipped surrogate 取 `min`。

#### PDD-26-02｜日常实习大模型算法一面｜2026｜`B`

来源：[公开复盘，页面 2026-04-15](https://www.nowcoder.com/feed/main/detail/ba50ad3b3777443da540fcd9cfaf7377)

- Pretrain 与 SFT 各自解决什么问题；多模态模型结构与常见坑；
- SFT 数据业务化：怎样避免模板化、train/test 怎样去重；
- 主流 Coding Agent 的记忆机制；检索多条相关内容的排序策略；
- spec-driven 的 code agent；上下文压缩机制，压缩比例为何选 70% 而不是直接砍掉早期对话；
- 无 coding。

#### PDD-26-03｜大模型一、二面｜2026｜`B-`

来源：[整理属性明显的复盘，页面 2026-03-14](https://www.nowcoder.com/feed/main/detail/5cb8a9b3a8804b22be10d8ead831e36e)

- 电商预训练数据的低质过滤与去重；
- 训练不稳定排查：loss NaN、OOM、吞吐下降；
- 长上下文处理；离线评测集构建；多模态质量评估；prompt 模板管理与版本化；
- 手写：从 logits 实现 top-k 采样（重归一化与边界处理）。

### 2.9 京东

#### JD-25-01｜大模型算法一面｜2025｜`B`

来源：[公开复盘，页面 2025](https://www.nowcoder.com/feed/main/detail/3f02a8e652fa414c819de810452a2b2a)

- LoRA 与 Prefix Tuning 如何选，电商微调数据与标签怎样设计；
- GRPO/PPO 的目标和适用边界；
- 长尾商品怎样影响向量召回，知识库更新怎样与库存状态保持一致；
- Reflection 怎样区分知识缺失、检索失败和工具调用失败；
- Toolformer 的自监督工具数据与 RLHF 有什么差异；
- 多义词消歧；LRU。

#### JD-25-02｜大模型算法校招二面｜2025｜`B`

来源：[公开复盘，二面约 1 小时](https://www.nowcoder.com/feed/main/detail/b06ae65ed444418b8f4bc1af822f69b2)

- 对照公式解释 DAPO loss 与 clip；
- 为什么 GRPO 训练 MoE 可能效果不好；
- 现场阅读一篇论文的 introduction 并解释；
- 项目数据构建、训练、评测和失败实验。

> `clip-higher`、dynamic sampling、token-level loss，以及路由/ratio/reward 的诊断框架属于 N5 和主指南中的准备展开，并非该原帖明确记录的逐项追问。

> 这两条属于模型算法/后训练/Agent/RAG，不是此前已删除的京东推理系统整理题单。

#### JD-26-01｜大模型算法一面｜2026｜`B`

来源：[公开复盘，页面 2026-02-04](https://www.nowcoder.com/feed/main/detail/dec319ee54ab4935b59ef5d9728d77e8)

- 今年关注的生成式推荐论文；OneRec 的多模态 tokenizer 与语义 ID；
- InfoNCE 温度系数；FAISS ANN 索引；正负样本与特征工程；
- RoPE 与 ALiBi 对比；SwiGLU 原理及相比 ReLU 的优势；
- attention 除以 $\sqrt{d_k}$、时间复杂度、多头；LoRA；模型蒸馏；扩散模型公式推导；
- 手写最大子数组和，并追加输出该子数组元素。

> 生成式推荐与 LLM 混合的相邻岗记录，LLM 基础题占比高故收录。

#### JD-26-02｜大模型算法实习一面｜页面日期两源冲突（列表 04-15）｜`B-`

来源：[公开复盘](https://www.nowcoder.com/feed/main/detail/b66d36dd7be3430c852d6051da75d4fa)

- LoRA 加在哪些层、epoch 与学习率；RAG chunk 实现与优化；
- 微调后文本重复问题；LoRA 注入领域知识；幻觉缓解；
- loss 里做除法与学习率做除法是否等价；
- QKV 线性变换的作用、为何需要 softmax；
- 手写：s1 每次可把任意字母移到末尾，求变成 s2 的最少操作数（不可能返回 -1）。

### 2.10 滴滴

#### DD-25-01｜校招大模型算法｜2025｜`B`

来源：[公开复盘](https://www.nowcoder.com/feed/main/detail/64774b2ffd0c4f538a069efcb981fe4c)

- 数据来源、构造、切分、RAG 检索和评测怎样形成闭环；
- 多轮 message 中哪些 token 参与 SFT loss，mask 如何验证；
- FFN 为什么通常先升维再降维；MHA/MQA/GQA/MLA；
- PPO/DPO/GRPO 与 SFT loss；手写 MHA。

#### DD-25-02｜26 届校招大模型算法二面｜2025｜`B`

来源：[公开复盘](https://www.nowcoder.com/feed/main/detail/e44dbe27b79d493e98810076b9343f73)

- GRPO 与 DPO 的 loss、数据来源和稳定性差异；
- 为什么偏好数据不能只做 KMeans，怎样兼顾语义覆盖、难度与多样性；
- 同一 prompt 的多 response 怎样防止模式坍缩；
- reward 与 token log-prob 的“语义一致性”不能直接画等号，应该怎样设计可证伪指标；
- KL 失控时先检查哪些实现、数据和超参数；复读如何缓解；
- 滑动窗口最大值。

#### DD-26-01｜大模型算法实习一面｜2026｜`B-`

来源：[公开复盘，页面 2026-03-24，行文过于工整疑经加工](https://www.nowcoder.com/feed/main/detail/e7b10249258f44309cbd22e66f4f804c)

- 多 Agent 中心化调度下，子 Agent 接口设计与结果回流怎样保证稳定；
- 纯 Prompt 范式的自动化评测体系设计；外部知识检索为何易"复述"而非独立推理，算法层怎么解；
- 小样本量化指标场景为何选 LoRA 而非全参或 Prompt 工程；LoRA 高质量监督数据构造；效果、推理成本、训练开销怎样平衡；
- Encoder 完整计算流、残差与归一化位置；MHA 公式与维度；
- 除以 $\sqrt{d_k}$ 的必要性（分布与梯度两个视角）；固定与可学习缩放系数的稳定性；LN 优于 BN 的三个角度。

### 2.11 网易 / 网易有道

#### WY-25-01｜有道大模型算法实习一面｜2025｜`B`

来源：[公开复盘；标题自述面试 2025-01-23，页面 2025-01-24](https://www.nowcoder.com/feed/main/detail/8a1cd625d469476a953588db061350f6)

- 指令集构建、RAG 召回、LoRA 层选择与初始化；
- top-k、top-p、temperature、beam search；
- 对比学习 temperature 与解码 temperature 是否是同一概念；
- CLIP/BLIP、PPO/DPO、Reward Model ranking loss；
- 钥匙和房间。

#### WY-25-02｜有道大模型算法实习｜2025｜`B`

来源：[公开复盘；标题自述面试 2025-03-06，页面 2025-03-12](https://www.nowcoder.com/feed/main/detail/8e19c8b04b20478dad5a8bf13e3e2e02)

- Reward Model 与规则 reward 的边界；
- LLM-as-judge 比较模型胜率时为什么要交换答案顺序并多轮评估；
- 怎样测位置偏差、长度偏差和自我偏好；
- 预训练与微调；base model 为什么通常不能稳定对话；
- 岛屿数量。

#### WY-25-03｜网易大模型算法实习一面｜2025｜`B`

来源：[公开复盘](https://www.nowcoder.com/feed/main/detail/7ec024e532bb493bbe7eeeaa672083fa)

- 数据集怎样构建；分类任务 SFT 后概率更不确定的原因；
- Reward Model 的训练数据、目标与 reward 来源；
- on-policy/off-policy；为什么后训练中 SFT 与 RL 可能交替；
- 零钱兑换。

#### WY-26-01｜大模型应用一、二面｜2026｜`B`

来源：[公开复盘，页面 2026-07-21，属 2027 届提前批窗口](https://www.nowcoder.com/discuss/909223288612610048)

- 自注意力、位置编码、梯度消失/爆炸对策；全参与 LoRA/Adapter/P-Tuning 的选择；
- 推理加速：量化、dynamic batching、FlashAttention；GPTQ/AWQ；
- 长文本生成显存优化：KV cache 复用、PagedAttention、序列并行；
- RLHF 偏好数据构造；灾难性遗忘；过拟合对策；
- 对话质量评估：BLEU/ROUGE、人评、任务完成率；
- 场景题：为音乐产品设计 AI 歌词生成系统（创造性与押韵）；用 LLM 提升新闻推荐效率；游戏 AI 陪伴系统核心模块；
- 垂域数据集构建原则；数据稀缺对策；线上性能瓶颈分层优化。

#### WY-26-02｜大模型算法实习二面｜2026｜`B`

来源：[公开复盘，页面 2026-03-16，约 1 小时](https://www.nowcoder.com/feed/main/detail/9cd8810ebfcd43f3ba1554daef9f8c63)

- 写出注意力机制数学表达式；训练阶段 mask 的必要性与推理阶段的差异；
- Transformer 与传统 seq2seq 对比；缩放因子作用；softmax 公式与数值稳定（上溢/下溢）；
- 提示词优化策略与评估；SFT 损失函数的作用范围；
- DeepSpeed；7B 模型训练显存需求与 ZeRO 各 stage 节省量；
- 多卡训练异常中断的处理经验。

### 2.12 OPPO

#### OPPO-25-01｜大模型二面｜2025｜`B`

来源：[公开复盘](https://www.nowcoder.com/feed/main/detail/7650323c5d32401b9a30968b2490d7e3)

- 多 Agent 如何协调并约束子 Agent 输出；
- Deep Research 如何拆任务、检索、反证、合成并停止；
- 模型不遵循精确字数要求时，训练、解码和外部校验分别能做什么；
- GRPO、DAPO 解决的问题；上下文工程。

#### OPPO-25-02｜AI 算法工程师，大模型与智能体方向二面｜2025｜`B`

来源：[含一面、二面和 HR 时间线的公开复盘](https://www.nowcoder.com/feed/main/detail/ea073eb9871041a885388bef72075b74)

- GSPO 与 GRPO 的 ratio/clip 粒度，为什么论文强调 MoE，Dense 模型能否使用；
- Deep Research 任务拆解、reward hacking；
- 为什么生成阶段跨步缓存 K/V 而通常不缓存历史 Q；
- 字数约束失效如何定位。

> 两个 URL 可能来自相近招聘批次，按两个公开样本保存，但重叠题不据此声称“高频”。

#### OPPO-26-01｜大模型应用一面｜2026｜`B`

来源：[公开复盘，页面 2026-03-26](https://www.nowcoder.com/feed/main/detail/06aa48522cef44dfa62cbdda528cde6f)

- Graph-RAG 的优势与 Graph 在项目中的作用；训练数据内容冲突怎样处理；
- 检索指标 Recall/MRR/Acc；LLM-as-a-Judge 之外还有哪些评测方法；
- 专家对同一回复打分方差大怎么解决；
- Agent 与 Memory 管理的常见模式。

### 2.13 智谱

#### ZP-26-01｜Agent 算法一面｜2026｜`B`

来源：[公开复盘，页面 2026-02](https://www.nowcoder.com/feed/main/detail/24952c828c59435abd3c302c97fa358d)

- DPO 损失的直觉解释；GRPO 选型理由；tool response 的 loss mask 怎样处理；
- KV cache 大小计算；参数量估算；讲 AutoGLM 论文；
- 手撕不是纯 attention，而是“流式输入输出处理 + MCP 调用输出规范”。

> Agent 工程化手撕替代传统模型手写的直接证据。

#### ZP-24-01｜大模型算法 25 届秋招全流程｜2024｜`B`

来源：[个人博客全流程复盘，面试 2024-08，获 offer](https://blog.csdn.net/Cyril_KI/article/details/143807473)

- 数据集处理、评测方法与方案设计；训练用显卡资源与国产卡生态（910B + Mindformers）；
- 是否改过框架底层代码；GitHub 代码审查（共享屏幕看候选人历史代码）；
- encoder-decoder 分离的优势；
- 手写括号匹配、合并两个升序链表、最长公共子串。

> 早于本题库主窗口，但是智谱目前唯一可核验的全流程强样本，保留作流程画像。

#### ZP-25-02｜大模型算法日常实习二面｜页面 03-16（年份未显示）｜`B-`

来源：[公开复盘](https://www.nowcoder.com/feed/main/detail/85b1e8c038df49c2b0030b12182f14f1)

- 数据集构造；长文本外推技术细节；
- 大规模图上 GNN 应用；GNN 与 LLM 怎样结合；
- 场景题：设计偏好对话模型。

#### ZP-25-01｜大模型一面｜2025｜`B-`

来源：[整理属性明显且带求职辅导导流的题单](https://www.nowcoder.com/feed/main/detail/e546ae199c7c417d88c9b468e42a6d50)

- 手写 tokenizer/RAG 伪代码；NL2SQL 多表策略；
- PPO/DPO/GRPO、KL estimator；LoRA 与 P-tuning v2；
- DeepSeek-R1 与 MLA；梯度问题；PyTorch parameter/buffer/no-grad。

`B-` 记录只用于发现候选题，不用于推断智谱面试频率。另有一条智谱 Infra 一面（页面 2025-09-18，TP/DP 协同、推理调度、KVCache 管理、C++ 手撕 MoE Dispatch）按推理引擎岗位边界不收。

### 2.14 B站

#### BILI-25-01｜大模型二面｜2025｜`B`

来源：[公开复盘，页面 2025-09-15](https://www.nowcoder.com/feed/main/detail/f2a8e9c26b7b4915b96400287beb1255)

- 从理论角度分析为什么采用 DPO；$\beta$ 的含义；DPO 训练不符合预期怎么办；
- PPO 奖励稀疏怎样处理；DPO 实现难点（数据与模型两个维度）；
- on-policy 与 off-policy 区别；DPO 损失函数。

> 单轮 DPO 理论专场；同账号[一面帖](https://www.nowcoder.com/feed/main/detail/62b0a79e518b43e9b2c7dec964914383)未逐题核验，暂不计样本。

#### BILI-26-01｜LLM 实习 Agent 方向复盘｜2026｜`B-`

来源：[二手转述（作者访谈候选人），页面 2026-05-03](https://www.nowcoder.com/discuss/880512077826187264)

- 多 Agent 协同的完整工作流设计；文献检索与 DeepResearch 的区别、query 扩展、PDF 解析与去重的代码级细节；
- 主/子 Agent 是否共享 context、何时共享；LLM 工具调用完整实现链路；
- 多步 Agent 回复怎样做渐进式披露避免信息过载；编排框架的坑与解法。

### 2.15 荣耀

#### HON-25-01｜大模型算法一面｜自述面试 2025-11-11｜`B`

来源：[公开复盘](https://www.nowcoder.com/feed/main/detail/ad3519a29f044ffdaf19a3fbfa25b500)

- 传统 RL 与 LLM 的结合：SAC 策略与 top-k 解码的对比；DQN 用于大模型工具选择；
- 训练输出全 0/全 1 怎样解决与改进；
- LoRA 微调的缺点；PPO 算法的缺点。

> 候选人反问得知该大模型平台部门主做 Agent。

#### HON-26-01｜大模型算法实习一面｜2026｜`B`

来源：[公开复盘，页面 2026-04-28](https://www.nowcoder.com/feed/main/detail/b26abb2ad0b5495f84ac690cf4a99342)

- 数据构造策略、评估指标与验证方法；训练框架与显存优化手段；DP/DDP/TP 区别；
- RL 奖励函数设计方法；GRPO 与 PPO 区别；明确无手撕。

### 2.16 vivo

#### VIVO-26-01｜大模型多模态算法｜2026｜`B-`

来源：[公开复盘，页面 2026-04-20，题量过全疑经整理](https://www.nowcoder.com/feed/main/detail/dc108b298ab8483e8de08a5afacd2fce)

- Agent 框架、整体工作流与执行范式；多路召回后粗排与二阶段 rerank；图文多模态特征融合；
- VQA 数据的 Query/Answer 怎样生成；工具调用监督数据（GT）怎样获取；数据生成后怎样校验过滤；
- 微调还是 RL 的选型原因；Reward 设计；RL 目标是端到端还是单步决策；Reward Hacking 及解决；
- GRPO 重要性采样的数学意义；KL 系数等超参调优；多轮任务端到端训练设计；
- 复杂/多意图 query 的准确率评估；首 Token 延迟与系统性能因素；attention 公式与 $\sqrt{d_k}$。

### 2.17 车企（理想 / 蔚来 / 小鹏）

#### LI-26-01｜理想视觉基座大模型日常实习一面｜2026｜`B`

来源：[公开复盘，页面 2026-06-25](https://www.nowcoder.com/feed/main/detail/09573891429944798ced405a56796bb1)

- 微调大模型、BERT、prompt 工程三者差异与各自适用场景；
- LoRA rank 怎样设置；样本数据集构建；模型瓶颈定位；论文拷打；
- 手写：用 PyTorch 手写 Transformer。

#### NIO-25-01｜蔚来大模型算法日常实习｜2025｜`B`

来源：[公开复盘，页面 2025-11-14](https://www.nowcoder.com/feed/main/detail/fa22064e751a4cffaa643677d84ceb90)

- RAG 分块方法与写入机制；Embedding 维度选择合理性；索引配置；为何上 RLHF；RAG 评价指标体系；
- DPO/PPO/GRPO 对比；价值模型与奖励模型区别；奖励模型是否要求可微；PPO 中 action 的定义；
- 手写 Tokenizer（原题，候选人未完成后换反转链表）。

#### XP-25-01｜小鹏 NLP 大模型二面｜2025｜`B`

来源：[公开复盘，页面 2025-08-25，自述零八股](https://www.nowcoder.com/feed/main/detail/befdf5680b9e4e2a9afb805faa5c1c3a)

- 实习拷打：数据构造、微调细节、RL 具体实现；
- 场景题：用户诉求模糊时的处理策略、怎样尽量避免反问；
- 手写：有序数组（后项大于前项两倍）中判断两数之和是否存在。

#### XP-25-02｜小鹏大模型算法一面｜自述面试 2025-08-27｜`B`

来源：[公开复盘](https://www.nowcoder.com/discuss/790266269374091264)

- RoPE 原理；位置编码为何能直接加到 embedding 上；BN 与 LN 区别；PagedAttention；
- 压测下怎样评估推理系统吞吐与 QPS；
- 手写 O(1) 额外空间的洗牌函数。

#### XP-26-01｜小鹏多模态大模型｜2026｜`B`

来源：[公开复盘，页面 2026-03-03](https://www.nowcoder.com/feed/main/detail/96f931642588471e8939e29028604499)

- PPO/GRPO/GSPO/DAPO 的区别与各自优化点；
- 投机采样与 rejection sampling 公式；vLLM 与 PagedAttention（问得较浅）；
- InternVL、QwenVL、Qwen-Omni 等多模态模型；国产卡优化讨论；
- 手写最长回文子串。

### 2.18 米哈游

#### MHY-26-01｜大模型算法日常实习一面｜2026｜`B`

来源：[公开复盘，页面 2026-03-18](https://www.nowcoder.com/feed/main/detail/b5ae1de0e2ac4ebb969d37754264e6c1)

- 讲解 MLA 与 GQA；RoPE 是什么、为何能体现相对位置、缺点、怎样外推；
- 手写 GQA（允许联网查函数）。

#### MHY-26-02｜大模型算法实习二面｜2026｜`B-`

来源：[公开复盘，页面 2026-03-21，前半部分问题泛化疑经扩写](https://www.nowcoder.com/feed/main/detail/2afcd7df90c247e2ad65118478ce72d7)

- RewardBench 中奖励模型的分类；奖励模型训练方法/目标与 DPO 的改进关系；
- DPO 损失函数与训练目标；大模型安全理解。

### 2.19 携程与 Shopee

#### XC-26-01｜携程大模型算法开发一面｜2026｜`B`

来源：[公开复盘，页面 2026-03-30，后段付费](https://www.nowcoder.com/discuss/868214571696152576)

- LoRA 原理、初始化方法与关键参数；QLoRA 与 LoRA 区别；
- DeepSpeed ZeRO 三个阶段各做什么；FSDP 与 ZeRO-3 的差别；
- RL 在大模型对齐里的一般框架；PPO/DPO/GRPO 区别；
- PPO 中 critic model 的作用；PPO 训练 KL 发散了怎么处理。

#### SP-26-01｜Shopee 大模型应用算法｜2026｜`B-`

来源：[公开复盘，页面 2026-03-30](https://www.nowcoder.com/feed/main/detail/ab0c95aee0d247a7ae0748d302c53dc4)

- RRF 与 BM25 的权重配置；RAG 端到端满意度评估方案，为何不对检索/生成分别评估；
- 意图理解、query 改写与路由机制；DPO 数据配比；对 GRPO 的理解、为何不用 GRPO；
- 排序阶段为何不用更强 reranker（推理性能与资源约束，计划蒸馏迁移）；数据飞轮怎样落地；skills 的优势；
- 手写一道简单 DP。

### 2.20 大模型独角兽与其他 AI 公司（2024—2025 样本）

以下样本早于本题库 2025—2026 主窗口或信息不全，用于公司流程画像与候选题池，不与主窗口样本混计。2025—2026 窗口内这些公司的新增题目级亲历帖仍然稀少。

#### XM-24-01｜小米 NLP 算法 25 届秋招（大模型方向）一、二面｜2024｜`B`

来源：[公开复盘，一面 2024-10-12、二面 2024-10-18](https://www.nowcoder.com/discuss/677125195668156416)

- YaRN、位置内插、NTK 等长文本扩展技术；FlashAttention 原理与解决的问题；RoPE；
- BPE/WordPiece/Unigram LM 分词对比；长文本效果评测方法；SFT 阶段的困难；
- 手写跳跃游戏、字符串解码。

#### XM-24-02｜小米（武汉）大模型算法实习二面｜2024｜`B`

来源：[公开复盘，页面 2024-04-18，约 50 分钟，后获 offer](https://www.nowcoder.com/feed/main/detail/6e4fa662d94d4023b8ca88bd30e4e4a7)

- RAG 项目拷打：embedding 模型结构与输出维度、文本切分、LoRA 微调参数、幻觉缓解；
- Transformer 结构、输入向量维度、除以 $\sqrt{d_k}$ 的作用、LayerNorm 归一化维度；
- 手写反转链表（先允许用列表，再要求不用列表）。

#### MM-24-01｜MiniMax 大语言模型算法 25 届秋招一、二面｜2024｜`B`

来源：[公开复盘，一面 2024-07-24、二面 2024-07-31](https://www.nowcoder.com/discuss/658766866105528320)

- 手写单层 MLP 做回归与二分类；手写 Beam Search；
- 实习方法细节；数据集构建细节；
- 开放题：长文本翻译模型的数据集怎样构建。

#### MM-24-02｜MiniMax 大模型实习一面｜2024｜`B`

来源：[公开复盘，页面 2024-03-11](https://www.nowcoder.com/feed/main/detail/6d4a32613ae1468eaab475bfb3764c7b)

- 数据增大效果会更好吗，有什么改进和想法；手写线性回归。

> 另一条"MiniMax 大模型搜索架构一二面"经核验实为后端岗（线程池/协程/限流器），不收；一条[星球整理属性的一二面题单](https://blog.csdn.net/2401_84495872/article/details/143288502)（GLM 与 GPT 区别、P-tuning/LoRA、DPO 与 PPO 数据选择差异、TopK 排序等）计 `B-` 候选池。

#### ST-24-01｜商汤多模态算法实习二面｜2024｜`B`

来源：[公开复盘，页面 2024-04-08，约 55 分钟](https://www.nowcoder.com/feed/main/detail/51abad389ed64c04b98c5e1196195f5c)

- Diffusion 应用细节；为何选 StyleGAN；UNet、ResNet、CLIP；
- LoRA 具体实现与训练参数；P-tuning v1/v2 细节；LLaMA 损失函数；
- DDP 与 DeepSpeed 区别；多分类单标签分布问题排查（含 PyTorch 代码改进）；
- CLIP 位置编码外推能力；是否自己实现过 Dataloader。

> 注意：网上存在逐条复制本帖并卖课导流的整理号文章，不重复计数。

#### XF-25-01｜科大讯飞 NLP 实习一面｜自述面试 2025-02-28｜`B`

来源：[公开复盘，约 30 分钟，后获 offer](https://www.nowcoder.com/feed/main/detail/82fed6214a2d42849a9c9cb3036cee6f)

- 指令集构建方法与来源；CoT 指令集构建方式；
- RAG 中 embedding+rerank 的必要性；是否训练过自定义 embedding 模型；
- 为何选 DPO、与其他 RL 算法对比；GRPO 了解程度；LoRA 原理。

#### KL-24-01｜昆仑万维 NLP/CV 算法实习一面｜2024｜`B`

来源：[公开复盘，页面 2024-04-03，约 35 分钟](https://www.nowcoder.com/feed/main/detail/5e6ba3fec9694bb288d0d81280b0a15c)

- 实习中大模型相关工作；微调用什么框架；是否做过全量微调；拆分单词算法题。

#### BC-24-01｜百川行业大模型算法一、二面｜2024｜`B`

来源：[公开复盘，页面 2024-03-26](https://www.nowcoder.com/feed/main/detail/3b677cd71c444d82a48d1aff11d39331)

- 一面 20 分钟只介绍简历加反问；二面 17 分钟纯聊天无技术问题。

> 只证明当时流程松散，对题库无贡献；不外推到当前流程。

面壁智能仅有一条[届别不明、导流明显的三轮题单](https://blog.csdn.net/qq_36816848/article/details/138006691)（Adam 自适应学习率、LN 与 BN、分布式训练、最小缺失正整数），计 `B-` 候选池。

### 2.21 华为、DeepSeek、月之暗面证据现状（2026-07-26 更新）

**华为**：2025—2026 窗口内仍无同时满足"盘古/大模型算法岗 + 日期/届别 + 候选人逐题复盘"的强样本，不伪造公司题库。新增两条旁证：

- [云 BU AI 大模型应用岗三连面，自述面试 2023-12-04](https://www.nowcoder.com/feed/main/detail/acf6b01499024890a0319453d49b65f6)：项目全流程拷打、Transformer 架构、手撕 K-means/KNN/排序/树题，`B`（早于窗口，只作流程画像）；
- 笔试侧 AI 岗机考题型已两次改版（2025-08 公告改为"10 客观 + 2 编程"，2026 年已是"20 选择 + 2 编程"且编程题 LLM 化），场次与题目骨架见[作战手册](/blog/algo-written-exam-playbook/)。

原有两条相邻岗位线索保留：[AI 工程师实习，页面 2025-06-28](https://www.nowcoder.com/feed/main/detail/3bd15a280c334ccfa51c2d181c4b587c)（`B-`）；[线下面试算法岗，页面 2025](https://www.nowcoder.com/discuss/812359680532951040)（机试、最长和为目标值的连续子数组、模型不达预期定位，`B-`）。

**DeepSeek**：仍无候选人帖子形式的完整题目级面经。三条新增线索：

- [算法岗笔试考点帖，页面 2025-03-23，非亲历](https://www.nowcoder.com/feed/main/detail/2ac60ffa044d4d7f835ef0770b767149)：手写完整 MHA、DPO 全流程推导、MoE 通信开销与负载不均分析（另有推理引擎内容超出边界），`B-`；
- [2026-06 社招 AI 工程师流程的媒体报道](https://www.163.com/dy/article/L1CUEGJ40530KP1K.html)（候选人对媒体一手自述）：笔试为编程题加单选多选；两轮远程 coding，面试官当场逐行审代码、远程监考严格，`B-`；
- 2026-07-12 Agent 开发岗 3 小时机考已出现（题目骨架见作战手册），说明其校招/社招流程正在体系化。

**月之暗面/Kimi**：一条社招大模型一面线索（约 40 分钟狂问项目、prefill/decode 两阶段）因登录墙仅摘要级；一条 2024-09 校招复盘仅有轮次无题目。仍无强样本，用[官方技术报告](https://moonshotai.github.io/Kimi-K2/thinking.html)反推准备。

**阶跃星辰、零一万物**：无可核验的算法岗亲历面经；阶跃只有官方校招帖（`A-JD`）。

本题库继续不纳入昇腾适配、算子、推理引擎和硬件部署类岗位；找到符合证据规则的一手复盘再按相同规则补录。

## 3. 算法笔试与现场 coding 去重清单

### 3.1 传统算法/数据结构

| 题型 | 最低实现要求 | 公开样本 |
|---|---|---|
| 二分左右边界/出现次数 | 明确 `[lo, hi)` 不变量，处理不存在和全重复 | BY-25-01 |
| 唯一重复数 | 能比较哈希、排序、Floyd/值域二分的前提 | BY-25-02 |
| 编辑距离 | 二维 DP，能解释初始化与滚动数组 | BY-25-03、KS-25-02 |
| LCS | 二维 DP 与恢复路径 | TX-25-01 |
| 零钱兑换并输出组合 | 不只返回最优值，还能记录 predecessor | BD-25-01 |
| 层序遍历 | 队列、逐层长度、空树 | KS-25-01 |
| 两数/三数之和 | 哈希；排序双指针与去重 | KS-26-01、XHS-25-01 |
| 01 矩阵四角矩形 | 行对/列对哈希计数，讲清复杂度 | PDD-25-01 |
| 无重复最长子串 | 滑窗左边界只前进 | PDD-25-02 |
| 目标和最长连续子数组 | 前缀和最早下标，兼容负数 | 华为相邻样本 |
| 最大连续登录天数 SQL | 去重日期，`date-row_number` 分组 | PDD-25-02 |
| LRU Cache | 哈希表 + 双向链表，`get/put` 均摊 $O(1)$，处理容量 0/1 | JD-25-01 |
| 滑动窗口最大值 | 单调队列存下标，过期与重复值处理正确 | DD-25-02 |
| 钥匙和房间 | DFS/BFS 可达性，空图与重复钥匙 | WY-25-01 |
| 岛屿数量 | 四方向 DFS/BFS 或并查集，避免重复访问 | WY-25-02 |
| 零钱兑换最少数量 | 完全背包初始化与不可达状态 | WY-25-03、TX-26-02 |
| 快速排序 | 基准选择、递归深度、稳定性与最坏情形 | ALI-26-04、BD-26-01 |
| 最长回文子串 | 中心扩展 $O(n^2)$，能说清 Manacher 的优化方向 | XP-26-01、快手候选池 |
| 最小回文串（构造/判定类） | 先明确题意再写；回文性质与贪心 | KS-26-02 |
| 合并两个有序链表 | 哨兵节点与尾指针 | KS-26-04、ZP-24-01 |
| 反转链表 | 迭代三指针；禁用辅助数组的版本 | XM-24-02、NIO-25-01 |
| 最大子数组和并输出方案 | Kadane 同时记录起止下标 | JD-26-01 |
| 最小生成树 | Kruskal + 并查集或 Prim，能讲复杂度 | ANT-26-02 |
| 卡特兰数递推 + DP | 从组合含义推导递推，再写 DP | XHS-26-01 |
| 洗牌算法 | Fisher–Yates，$O(1)$ 额外空间与均匀性论证 | XP-25-02 |
| rand7 生成 rand10 | 拒绝采样与期望调用次数 | ALI-26-03 |
| 高精度开 n 次根号 | 二分 + 大数幂或牛顿法，精度边界 | BY-26-02 |
| 字母移到末尾的最少操作 | 多重集判定 + 保持相对顺序的最长匹配 | JD-26-02 |
| 跳跃游戏 / 字符串解码 | 贪心可达边界；栈解析嵌套 | XM-24-01 |
| 括号匹配 / 最长公共子串 | 栈；二维 DP 与滚动数组 | ZP-24-01 |

### 3.2 大模型专用 coding

1. response-only SFT loss：shift、`-100` mask、EOS、变长 token-level accumulation；
2. MHA/GQA：shape、mask、scale、RoPE 插入位置、KV heads 扩展；
3. temperature + top-k/top-p sampling：数值稳定、非法温度、随机种子；
4. DPO loss：chosen/rejected 的 response-only log-prob sum/mean 口径；
5. GRPO clipped surrogate：group mask、零方差 group、token/sequence reduction；
6. InfoNCE/CLIP loss：双向 CE、归一化、temperature；
7. 简化向量检索：cosine、top-k、batch query、重复文档；
8. RAG evaluator：Hit@k、Recall@k、MRR、evidence-set coverage 不混名；
9. LoRA 线性层：$W_0x + sBAx$、初始化和 merge；
10. RMSNorm/RoPE：避免 in-place 和 dtype 精度坑；
11. DAPO/GSPO loss skeleton：clip 区间、token/sequence aggregation、mask 和 overlong 样本；
12. 最小 BPE tokenizer：pair 统计、merge 顺序、encode/decode round-trip；
13. 一个带超时、重试、幂等键和结构化错误的 tool wrapper；
14. MoE 前向：router softmax、top-k 专家选择、加权求和与每专家 token 统计（MT-26-01 现场手写）；
15. GQA/完整 Transformer block：KV head 复用与广播、RoPE 插入、residual+norm 顺序（MHY-26-01 手写 GQA；LI-26-01 手写整个 Transformer）；
16. 单层 MLP 回归/二分类与 Beam Search（MM-24-01；独角兽公司偏好从零写基础件）；
17. 流式输入输出处理 + 结构化工具调用（MCP 风格）输出规范（ZP-26-01）：增量解析、部分 JSON 缓冲、schema 校验与错误恢复——Agent 工程化手撕已开始替代纯模型公式手撕。

验收不能只看“能跑”：每题至少准备正常、空输入、边界、随机对拍和复杂度说明。

## 4. 新增知识缺口：答案卡

这些答案卡补主指南目前相对薄弱的主题。N1—N9 主要由公开面试复盘触发；N10—N16 是 2025—2026 论文/官方技术报告驱动的前沿候选题，不视为已在某家公司真实问过。N17—N22 于 2026-07-26 新增：N19—N21 由 2026 年公开复盘直接触发，N17、N18、N22 由 2025 末—2026 年技术报告驱动。

### N1｜MoE 负载均衡与 expert collapse

**90 秒主回答**：router 为每个 token 产生 expert logits，经 softmax 后选 top-k experts；容量有限会引入 token drop 或重路由。若少数专家长期获得多数 token，会出现负载不均、通信热点和专家训练不足。辅助 load-balancing loss 通常同时关心“被选中的 token 比例”和“router probability 质量”，但它会干扰主任务，因此要报告主 loss、每专家 token 数、router entropy、drop rate、all-to-all 时间和专家利用率。Switch Transformer 的辅助项是经典起点；现代模型还可能使用无辅助损失的 bias 调节，回答时必须绑定具体实现。

**追问**：为什么均匀负载不等于语义上更好？因为均衡是系统/容量约束，强行均匀可能破坏 specialization；应比较质量—吞吐 Pareto，而不是只把 auxiliary loss 降低。

**权威核验**：[Switch Transformers, JMLR 2022](https://www.jmlr.org/papers/v23/21-0998.html)；[DeepSeek-V3 Technical Report](https://arxiv.org/abs/2412.19437)。

### N2｜推理时计算与 verifier-guided search

**方法谱系**：greedy/temperature baseline → self-consistency → best-of-N + outcome verifier → process verifier/step search → tree/beam/MCTS 类搜索。增加 sample 数通常提升 pass@k，但最终选择质量取决于 verifier；搜索还会增加 token、KV、调度和延迟成本。

**正确实验**：固定总 token 或总 FLOPs 比较；同时报告 pass@1、pass@k、最终 selected accuracy、oracle gap、平均/尾延迟和 cost per solved problem。若只比较“采 64 条”与“greedy 1 条”，不能把提升全部归因于算法。

**权威核验**：[Self-Consistency, ICLR 2023](https://openreview.net/forum?id=1PL1NIMMrw)；[Let's Verify Step by Step, ICLR 2024](https://openreview.net/forum?id=v8L0pN6EOi)；[Scaling LLM Test-Time Compute](https://arxiv.org/abs/2408.03314)。

### N3｜VLM 数据、视觉 token 与模态失衡

**训练链路**：视觉 encoder → projector/resampler → LLM；常见阶段是对齐预训练、指令微调，再按任务做偏好优化/RL，但具体模型不一定完全相同。任意分辨率通常通过切块/多尺度增加视觉 token；token 压缩能省上下文和算力，却可能伤 OCR、small object 和 grounding。

**模态失衡诊断**：做 text-only、image-only、image-shuffled、counterfactual image、遮挡/裁剪和冲突图文测试；若换图答案不变，模型可能在吃语言先验。评测需拆 OCR、grounding、图表、多图、视频时序和幻觉，不能只看一个总分。

**权威核验**：[LLaVA](https://arxiv.org/abs/2304.08485)；[BLIP-2](https://proceedings.mlr.press/v202/li23q.html)；[LLaVA-NeXT / AnyRes 官方说明](https://llava-vl.github.io/blog/2024-01-30-llava-next/)。

### N4｜Agentic RL 的 credit assignment

终态 reward 复制到所有 token 是最简单的 Monte Carlo 信号，但方差高，且无法区分有用步骤与偶然成功。可选方案包括：训练 value/critic 做 GAE；学习 process reward model；让 verifier 检查中间状态；对工具返回和环境状态设计 potential-based shaping；使用 leave-one-out/group baseline 降方差。

面试必须同时指出风险：过程标签可能错，dense reward 容易被 hacking，token-level reward 不等于 token-level causality。评测要看终态成功、步骤合法率、工具错误恢复、轨迹长度/成本，并对 outcome-only、process reward、不同 credit assignment 做消融。

**权威核验**：[PPO](https://arxiv.org/abs/1707.06347)；[Let's Verify Step by Step](https://openreview.net/forum?id=v8L0pN6EOi)；[DeepSeekMath/GRPO](https://arxiv.org/abs/2402.03300)。

### N5｜DAPO、GSPO 与标准 GRPO 的回答边界

- DAPO 不是简单“新名字的 GRPO”：论文强调 clip-higher、dynamic sampling、token-level policy-gradient loss 和 overlong reward shaping；
- GSPO 把 importance ratio/clip 提升到 sequence level，论文动机之一是大规模 MoE RL 的训练稳定性；
- 不同框架对 KL、advantage normalization、loss aggregation、rollout engine 和 stale policy 的实现不同，面试时先声明版本；
- 不能说任何方法“彻底解决 off-policy”。必须记录真实 behavior log-prob、policy version，并监控 ratio、KL、clip fraction 与 trajectory age。

**权威核验**：[DAPO](https://arxiv.org/abs/2503.14476)；[GSPO](https://arxiv.org/abs/2507.18071)；[DeepSeekMath](https://arxiv.org/abs/2402.03300)。

### N6｜GRPO normalization 不是无害细节

组内减均值提供 baseline；再除标准差会改变不同 prompt/reward-scale 的相对权重，不只是“纯粹降方差”。低方差组可能被放大；group 全对或全错则几乎无有效相对信号。对随机 outcome 或概率校准任务，需把标准 GRPO 与 no-std、RLOO/PPO 做对照，不能因 reward 可自动验证就默认适用。

**权威核验**：[Understanding R1-Zero-like Training](https://arxiv.org/abs/2502.18548)；[Dr. GRPO](https://arxiv.org/abs/2503.20783)。

### N7｜训练与 RL 显存定量题

这是算法岗必须掌握的实验可行性估算，不扩展到 Serving 引擎设计。回答顺序：

1. 权重、梯度、optimizer state：先声明 BF16/FP32 master/Adam 等假设，再说明 DP/ZeRO/FSDP/TP/PP/EP 分片；
2. activation：与 micro-batch、序列长度、层数相关，说明 checkpointing 和 attention 实现；
3. RL 额外角色：actor、critic（若有）、reference、reward/verifier、rollout engine 是否共享或卸载；
4. rollout 的标准 raw KV：$2L(\sum_i S_i)n_{kv}d_hb$；MLA 按 latent cache；
5. 临时 buffer、通信峰值、碎片和长尾 response，说明“稳态能放下”不等于训练峰值不 OOM。

**权威核验**：[ZeRO](https://arxiv.org/abs/1910.02054)；[PyTorch FSDP](https://docs.pytorch.org/docs/stable/fsdp.html)；[DeepSeek-V2 / MLA](https://arxiv.org/abs/2405.04434)。

### N8｜RAG 责任归因

最小实验矩阵：

| 检索上下文 | 生成模型 | 能回答什么 |
|---|---|---|
| 实际 top-k | 固定 | 端到端现状 |
| gold evidence | 固定 | 检索上限与生成失败 |
| 空/打乱 evidence | 固定 | 参数记忆、泄漏和上下文依赖 |
| 固定 evidence | 不同生成模型 | 生成器贡献 |
| 固定候选集 | 不同 reranker | 排序贡献 |

指标必须区分 Hit/Success@k 与 Recall@k；多证据问题还要看 evidence-set coverage。线上要按 query 类型、知识新旧、权限和拒答切片。

**权威核验**：[BEIR](https://openreview.net/forum?id=wCu6T5xFjeJ)；[RAGAS](https://aclanthology.org/2024.eacl-demo.16/)。

### N9｜传统 ML/数学不能只背名词

至少能现场推导或解释：

- 交叉熵、KL 两个方向、MLE 与 label smoothing；
- bias-variance、正则化、数据泄漏与 covariate/concept shift；
- precision/recall/F1、ROC-AUC 与 PR-AUC 的适用条件；
- calibration、ECE/Brier score，以及阈值怎样按业务成本选；
- SGD/AdamW、warmup、cosine schedule、梯度裁剪；
- softmax/Jacobian、矩阵乘法 shape、期望/方差、条件概率；
- 搜广推相邻岗再补 AUC、NDCG、IPS、IV/PSI 和负采样偏差。

回答任何指标题都要先说数据分布、类别不平衡、决策阈值和业务代价。

**权威核验**：[On Calibration of Modern Neural Networks, ICML 2017](https://proceedings.mlr.press/v70/guo17a.html)；[AdamW, ICLR 2019](https://openreview.net/forum?id=Bkg6RiCqY7)。

### N10｜MTP 是辅助训练目标，不等于一次无损生成多个 token

**90 秒主回答**：Multi-Token Prediction 在标准 next-token loss 外，用额外预测模块从共享 hidden state 预测更远的未来 token，并对多个未来位置的 loss 加权。它首先是预训练辅助目标，目的是让表示携带更长的未来信息；推理时可以丢弃辅助头，因此能力收益不依赖改变自回归解码。若保留预测头，可为 speculative decoding 提供候选，但这不代表部署时能够无条件、无损地并行输出多个 token。

**最小实验**：等参数、等训练 token、等 FLOPs 比较 NTP 与不同预测深度/权重的 MTP；同时测 validation loss、下游能力和稳定性。若再测 speculative decoding，需单独报告接受率和额外头成本，不能用吞吐提升证明模型能力提升。

**常见错误**：把 MTP 直接等同 speculative decoding；忽略额外预测模块；只比较相同步数而不控制训练 FLOPs。

**权威核验**：[DeepSeek-V3 Technical Report](https://arxiv.org/abs/2412.19437)；[Better & Faster Large Language Models via Multi-token Prediction, ICML 2024](https://proceedings.mlr.press/v235/gloeckle24a.html)。

### N11｜Muon/MuonClip 与 AdamW 的公平比较

**90 秒主回答**：Muon 对二维矩阵参数的梯度动量做近似正交化，常用 Newton–Schulz 迭代，使不同奇异方向的更新更均衡；embedding、norm、bias 等非矩阵参数通常仍使用 AdamW。扩展到大模型时不能只说“做正交化”，还要处理 weight decay 和按参数形状校准 update scale。MuonClip 进一步针对 Q/K 权重导致的 attention logit 爆长加入 QK-clip，监控对象包括 QK norm、attention logits、loss spike 和 update-to-weight ratio。

**最小实验**：调优后的 AdamW 与 Muon 做等 token、等 FLOPs、等模型/数据对照，报告训练 loss、下游能力、稳定性与总计算量。论文中的效率倍数是特定 scaling-law 实验结论，不是任意任务保证。

**常见错误**：所有参数都用 Muon；把“更新近似正交化”说成“权重必须正交”；直接复述效率倍数而不声明实验条件。

**权威核验**：[Muon is Scalable for LLM Training](https://arxiv.org/abs/2502.16982)；[Kimi K2 Technical Report / MuonClip](https://arxiv.org/abs/2507.20534)。

### N12｜长训练周期下，数据过滤不是越严格越好

**90 秒主回答**：激进过滤可能提高单位 token 的平均质量，却缩小 unique-token pool；当训练 horizon 很长时，少量保留数据会被重复更多次，增加记忆、模板偏置与覆盖缺失。因此最优目标是质量、唯一性、领域覆盖、污染和重复次数的 Pareto，而不是最大化某个 quality classifier 分数。合成改写可以改善表达质量，但不会自动创造新事实。

**最小实验**：在等总 token/等 FLOPs 下比较多档过滤阈值，记录 unique token、每来源重复次数、近重复率、污染率、领域切片和短/长 horizon validation 曲线。短程最优阈值不能直接外推到 10T+ token。

**常见错误**：只报最终 benchmark；不控制训练 token 和重复次数；把 synthetic rewrite 当成增加事实覆盖。

**权威核验**：[Nemotron-CC](https://arxiv.org/abs/2412.02595)。

### N13｜RLVR 分数上涨不等于 reward 教会了新推理

**90 秒主回答**：reward 可执行只说明能自动打分，不保证其语义信息是能力提升的原因。部分基座上，随机、格式甚至错误标签 reward 也可能提高数学分数，可能是在放大预训练已有模式、改变长度、熵或采样分布。因果验证至少要比较正确、随机、格式和反向 reward，覆盖多个 base family，并在等 rollout/FLOPs 下同时看 pass@1、pass@k、长度、熵、多样性和域外任务。

只有正确 reward 相对强控制组产生稳定、跨模型、域外且 verifier-invariant 的增益，才更有资格归因于 reward 语义。

**常见错误**：训练 reward 和 benchmark 同涨就声称涌现新推理；只在一个 Qwen 数学基座上实验；不看 high-k support 与解法多样性。

**权威核验**：[Spurious Rewards: Rethinking Training Signals in RLVR](https://arxiv.org/abs/2506.10947)。

### N14｜Scalar RM、Generative RM 与 verifier 怎样选

**90 秒主回答**：确定性任务优先外部 verifier；开放域偏好常用 RM。Bradley–Terry scalar RM 便宜，但单分值难解释，容易利用长度、风格、位置和模型身份 shortcut。Generative RM 可生成文本化判断、理由或 critique，从而允许增加 reward-side inference compute；DeepSeek-GRM 的具体做法是使用 Self-Principled Critique Tuning 生成自适应原则、critique 与判断，并通过并行采样和 meta-RM 聚合多个 judge 输出。

**正确评测**：固定 judge token/FLOPs，测 pairwise accuracy、位置交换、长度控制、跨域、校准、对抗样本，以及 policy 优化后对 reward 的 exploitability。更多 judge compute 不保证单调提升；相关错误会让投票失效，meta-RM 本身也是攻击面。

**常见错误**：有解释就等于判断正确；critique 越长越可靠；只测静态 RewardBench，不测被 policy 优化后的 RM。

**权威核验**：[Inference-Time Scaling for Generalist Reward Modeling](https://arxiv.org/abs/2504.02495)。

### N15｜Search-R1：把检索当作 RL action

**90 秒主回答**：静态 RAG 通常只检索一次；Search-R1 把 search query 视为 policy action、搜索结果视为 environment observation，使轨迹成为 reasoning—search—observation 的多轮交替。检索结果不是模型动作，通常要从 policy loss 中 mask 掉，避免训练模型去“生成搜索引擎返回内容”；最终 outcome reward 可以训练何时搜、搜什么和何时停止，但仍存在长程 credit assignment。

**最小实验**：与静态 RAG、prompt-only search Agent、同调用预算 SFT 比较；报告 query quality、evidence recall/coverage、搜索次数、答案正确、引用支持、成本和时间外泛化，并固定搜索索引版本。

**常见错误**：对 observation token 计算 policy loss；最终答对就认为搜索步骤正确；只看 QA accuracy 不看证据和调用成本。

**权威核验**：[Search-R1](https://arxiv.org/abs/2503.09516)；[COLM 2025 版本](https://openreview.net/forum?id=Rwhi91ideu)。

### N16｜Visual-RFT：多模态 RLVR 必须证明模型真的看图

**90 秒主回答**：检测、grounding、计数等任务可以使用 IoU、点/框命中、类别 exact match 等视觉可验证 reward，再用 GRPO 类算法从同一图像采样多条 reasoning/answer。reward 必须绑定图像坐标或视觉标注；只判断最终文本答案可能让模型利用语言先验。格式 reward、答案 reward 和 perception reward 应分开记录。

**因果验证**：image shuffle、遮挡目标、counterfactual image、同题换图、图文冲突和域外类别；与 SFT、text-only RLVR、answer-only reward 比较，同时看 mAP/IoU、答案准确、grounding consistency、幻觉和视觉 token 成本。

**常见错误**：文本答案可核验就称 visual verifier；CoT 变长就称视觉推理增强；只测与训练完全同格式的数据。

**权威核验**：[Visual-RFT, ICCV 2025](https://openaccess.thecvf.com/content/ICCV2025/html/Liu_Visual-RFT_Visual_Reinforcement_Fine-Tuning_ICCV_2025_paper.html)；[官方实现](https://github.com/Liuziyu77/Visual-RFT)。

### N17｜DSA 稀疏注意力与"压缩 + 稀疏"两级注意力

**90 秒主回答**：DeepSeek Sparse Attention（DSA）用一个轻量 indexer 为每个 query 对历史 token 打分，只对被选中的细粒度子集做完整 attention，把长上下文的主注意力成本从 $O(L^2)$ 降到接近 $O(Lk)$；因为选择是 per-query、可学习的，而不是固定窗口/块模式，长上下文质量损失显著小于静态稀疏。DeepSeek-V3.2 首次全线落地；2026 年 GLM-5 也改用 DSA，DeepSeek-V4 在其上叠加 token-wise compression：先把 KV 按块压缩成粗粒度表示，再在压缩表示上做 top-k 稀疏选择，KV 显存与 FLOPs 双降，使 1M 上下文成为默认配置。回答时必须区分三层：KV cache 压缩（省显存）、稀疏选择（省计算）、两者组合的误差来源。

**追问**：与 MLA 什么关系？MLA 压缩的是每个 token 的 KV 表示维度（latent 维度），DSA 减少的是参与 attention 的 token 数量，两者正交可叠加。怎样证明"近无损"？固定模型与数据，对比全量 attention 与稀疏版在长上下文检索（NIAH 类）、多跳推理和困惑度上的差距，并报告不同序列长度下的加速比。

**常见错误**：把 DSA 说成滑动窗口或块稀疏；忽略 indexer 本身的训练与开销；用短序列 benchmark 证明长上下文无损。

**权威核验**：[DeepSeek-V3.2](https://arxiv.org/abs/2512.02556)；[DeepSeek-V4 官方发布](https://api-docs.deepseek.com/news/news260424)；[GLM-5](https://arxiv.org/abs/2602.15763)。MiniMax M3 的 MSA 为同类块级 indexer 路线（发布信息以官方报告为准）。

### N18｜线性注意力混合架构进入旗舰模型

**90 秒主回答**：线性/次二次注意力（gated delta network、Kimi Linear 的 KDA 等）把每层的历史信息压缩进固定大小的状态，decode 时无需随长度增长的 KV cache；代价是精确的长程随机访问能力弱于 softmax attention。2025 末—2026 年的旗舰做法是混合：大部分层用线性注意力，少数层保留全量（或稀疏）softmax attention 兜底长程检索，Qwen3.5 即采用"线性注意力 + 稀疏 MoE"组合。面试要能说清三点：线性注意力为什么快（recurrent 形式、状态大小固定）；为什么不能全换（检索/复制类任务退化）；混合比例与层位怎样选（保留层通常放在深层或按间隔分布，需消融支撑）。

**最小实验**：等参数等数据下比较纯 softmax、纯线性、不同混合比例，报告困惑度、长上下文检索、复制任务、吞吐与显存曲线；序列越长，混合架构收益越明显，但必须同时报告能力退化边界。

**常见错误**：把线性注意力说成"无损加速"；混淆 KV cache 减少与计算量减少；不知道混合层的存在直接说"Qwen 全用了线性注意力"。

**权威核验**：[Qwen3.5 发布公告](https://www.alibabagroup.com/en-US/document-1960233590314762240)；gated delta network 与 KDA 细节以对应论文/官方报告为准。

### N19｜Agent 工程化生态题：skill、harness、上下文工程

**90 秒主回答**：2026 年面试已直接问工具生态名词，但考察点是背后的工程原理。skill 是把程序性知识（怎么做某类任务的说明与脚本）打包成按需加载的单元，好处是不常驻上下文、可版本化、可复用；harness 指模型外围的执行框架能力（工具调度、权限、重试、状态管理、环境隔离），同一个模型换 harness 表现可以差很多。上下文工程的核心矛盾是：工具定义、历史消息、检索结果都在抢有限上下文预算——对策包括按需加载（skill/渐进式披露）、压缩与摘要（保留任务状态而非原文）、用代码执行间接调用大量工具而不是把所有工具 schema 塞进上下文。回答时把名词映射回：上下文预算、状态管理、失败恢复、可评测性四个坐标。

**已验证的真实考题**：蚂蚁问"harness 能力体现在哪、不同 Coding Agent 创建 skill 的差异、Coding Agent 响应为何随会话变长而变慢"（ANT-26-01）；百度问"Skill 的定义"（BD-26-01）；智谱手撕"流式输出 + MCP 调用输出规范"（ZP-26-01）；拼多多问"上下文压缩为何选 70% 而非砍早期对话"（PDD-26-02）。

**追问**：会话变长变慢怎么解释？上下文线性增长使 prefill 成本与 KV 显存上升、缓存命中率下降，且长上下文中模型对中段信息利用变差；对策是压缩、检查点化状态、把长历史外置到文件/记忆再按需取回。

**常见错误**：把这些当营销名词背定义而不落到预算与失败模式；声称某家产品实现细节而无来源。

**权威核验**：[Anthropic：Code execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp)；Anthropic 工程博客的 context engineering 与 Agent Skills 系列。

### N20｜LLM-as-a-Judge 评测设计与一致性

**90 秒主回答**：把 LLM 当评委必须先设计 rubric：硬门槛（事实错误、格式违规、安全问题直接不及格）与加分项（深度、风格、完整性）分开，避免单一分数把致命错误平均掉。可靠性检查至少四项：swap consistency（交换两个候选答案的位置，结论应翻转一致，防位置偏差）；长度控制（防"越长越好"偏好）；自我偏好（judge 偏爱同源模型输出）；与人工标注的一致率及打分方差。专家打分方差大时，先细化 rubric 并做标注员校准，再用多评委聚合，而不是直接平均。评测体系要能做消融归因：分别关掉 RAG/SFT/DPO/Judge 环节，证明每个环节的贡献。

**已验证的真实考题**：百度问 rubric 硬门槛与加分项划分、swap consistency 防什么、消融怎样归因（BD-26-02）；OPPO 问 LLM-as-a-Judge 之外的评测方法、专家打分方差大怎么办（OPPO-26-01）；快手评测岗问视频生成评测维度与 benchmark 选择（KS-26-04）；此前网易有道已问过交换答案顺序与多轮评估（WY-25-02）。

**常见错误**：只报 judge 分数不报与人工的一致率；用同一个模型既生成又评审不做去偏；rubric 一把抓导致高分答案仍含硬伤。

**权威核验**：与 N14（Generative RM）互补——N14 讲 reward 侧，本卡讲评测协议侧；[RAGAS](https://aclanthology.org/2024.eacl-demo.16/) 等评测框架可作工程参照。

### N21｜预训练/SFT 数据工程专场

**90 秒主回答**：2026 年出现整场只考数据工程的一面（BY-26-02）。回答框架按管线走：来源与合成（人写、改写、蒸馏合成，成本与授权差异；小语种可用翻译+回译+术语表约束低成本合成，但要防翻译腔与事实漂移）→ 清洗（规则过滤、质量分类器、困惑度筛选，各自的偏置）→ 去重与多样性（exact/near-dup/MinHash；聚类去重按语义簇采样，去重过度会缩小 unique-token 池，见 N12）→ 配比（领域/语言/难度分桶，下采样时按簇保多样性而不是均匀随机丢）→ 验证（配比消融、污染检测、下游切片评测）。每一步都要能说出可观测指标和一个失败案例。

**已验证的真实考题**：字节 TikTok 整场数据工程（合成、标注、混合、聚类去重、下采样保多样性、小语种降本，BY-26-02）；快手电商预训练数据构造（KS-26-02）；拼多多低质过滤与去重、SFT 数据防模板化与 train/test 去重（PDD-26-02、PDD-26-03）；美团标注质量量化与多源配比（MT-25-01）。

**常见错误**：只会说"清洗去重"四个字给不出判据；把质量分类器分数当唯一目标（N12 的 Pareto 问题）；SFT 数据模板化导致模型输出千篇一律还测不出来。

**权威核验**：[Nemotron-CC](https://arxiv.org/abs/2412.02595)；各家基座技术报告的数据章节。

### N22｜奖励密度谱系：从 GRPO 稀疏结果奖励到 OPD 稠密过程信号

**90 秒主回答**：把后训练信号放在一条"密度谱"上看：outcome reward（GRPO/RLVR，一条轨迹一个分数，信号稀疏但目标干净）→ process reward（PRM/verifier 给步骤分，稠密但标签可能错、易被 hack）→ on-policy distillation（学生自己采样、教师给每个 token 打 log-prob 级反馈，最稠密，但上限受教师能力约束）。2026 年的实践倾向按阶段切换：能力探索期用稀疏结果奖励拉 pass@k，收敛期或蒸馏小模型时用 OPD 的稠密信号提高样本效率；公开材料称 OPD 类配方已进入多家国产旗舰的训练管线（以各家技术报告为准）。面试要能比较三者的方差、偏置、可 hack 性和计算成本，并说明"稠密不等于更正确"。

**追问**：OPD 与 SFT 蒸馏的本质区别？SFT 在教师分布上学（off-policy，暴露偏差），OPD 在学生自己的采样分布上被教师纠正（on-policy），错误状态也能得到反馈；与 R10/N5 的 forward/reverse KL 讨论衔接。

**常见错误**：把 OPD 说成"就是蒸馏"；认为 process reward 总优于 outcome reward；引用"效率提升数倍"却不声明任务与教师规模。

**权威核验**：[Thinking Machines：On-Policy Distillation](https://thinkingmachines.ai/blog/on-policy-distillation/)；[稀疏与稠密奖励阶段切换的实证](https://arxiv.org/abs/2605.12483)；[SFT/RL/OPD 的状态分布统一视角](https://arxiv.org/abs/2605.22731)。

## 5. 2027 高概率题型（全部为预测 `P`）

| 预测主题 | 为什么值得准备 | 可演练的问题 |
|---|---|---|
| Agentic RL credit assignment | 2026 公开复盘已出现过程奖励和 token 分配 | 只有稀疏终态 reward，怎样比较 MC return、GAE、PRM 和 reward shaping？ |
| DAPO/GSPO/OPD 与训推一致性 | 2026 已从 GRPO 定义推进到 KL 方向、MoE 路由和系统细节 | rollout engine 量化且 trainer 为 BF16 时，ratio 偏差怎样测？ |
| 长程 Agent 可靠性 | 2025 蚂蚁/阿里记录已追问并发、DAG、容错 | 设计有状态、多租户、可回放的工具 Agent；何时停止和人工升级？ |
| 后训练数据闭环 | 多家公司持续追问数据配比、切 RL 条件、hacking | 设计生成—过滤—难度分桶—SFT—RL—评测—回流；怎样防 judge 偏差？ |
| MoE × RL 稳定性 | 2025 已考 router loss，2026 已考路由不一致 | expert collapse、rollout/train 路由和策略陈旧怎样联合监控？ |
| 定量训练与 rollout 成本 | 多个 2025 样本直接要求训练/GRPO 显存估算 | 给模型规模、序列、batch、精度和并行策略，估算训练状态、activation 与 rollout cache |
| 多模态 reasoning | 2025 百度/阿里/小红书相邻题已覆盖 VLM | 文本与图片冲突时模型偏信文本，怎样构造数据、reward 和反事实评测？ |
| Agentic RAG | RAG 已从组件名词转向归因和更新 | 怎样定位 query rewrite、召回、rerank、context selection、generation 哪层出错？ |
| RLVR 因果对照 | 2025 研究显示错误/随机 reward 在部分基座上也可能涨分 | 怎样用随机、格式、反向 reward 与跨 base family 证明 reward 的语义贡献？ |
| Generative RM | 开放域 reward 正从 scalar score 扩展到原则、critique 和 judge aggregation | 固定 judge FLOPs 后，怎样比较 scalar RM、GRM 与 verifier？ |
| Search-R1 / 检索型 RL | 搜索 query 开始作为 policy action 进入 rollout | observation token 为什么要 mask，怎样同时评估答案、证据与搜索成本？ |
| MTP / Muon / 新预训练 recipe | 国内基座技术报告已公开这些训练方法 | MTP 与 speculative decoding 如何区分；Muon 与 AdamW 怎样做公平对照？ |
| 多模态 RLVR | 视觉可验证 reward 已进入 2025 论文 | 怎样证明收益来自视觉证据，而不是语言先验或格式 reward？ |
| 双轨 coding | 传统 DP/滑窗仍在，同时多次出现 MHA/loss | 同一轮完成一道 Medium 和一个 mask 正确的 GRPO/DPO/SFT 实现 |
| 项目反事实压力测试 | 项目真实性是跨公司的稳定共性 | 数据减半、禁人工标注、延迟减 50%、换基座时，最小验证实验是什么？ |
| 稀疏/线性注意力新一代 | DSA 已进 DeepSeek V3.2/V4 与 GLM-5，Qwen3.5 采用线性混合架构 | 推导"压缩+稀疏"两级注意力的 KV 显存与 FLOPs 收益；DSA 与 MLA/GQA 的正交关系 |
| Agent 工程化手撕 | 智谱 2026-02 已用"流式输出+MCP 调用规范"替代纯 attention 手撕 | 写一个带流式解析、结构化调用与错误恢复的最小 Agent 循环 |
| LLM-as-a-Judge 协议 | 百度/OPPO/快手 2026 样本已问 rubric、swap consistency、打分方差 | 设计带位置交换、长度控制与人工一致率检查的评测协议 |
| 数据工程专场 | 字节 2026 已出现整场只考数据工程的一面 | 给出从合成、清洗、去重到配比消融的完整管线，每步说指标与失败案例 |

预测的使用方法：每月更新一次，只根据新增的一手复盘和目标团队官方技术方向升降优先级；不要因为某个新缩写出现就删除 Transformer、ML、coding 和项目深挖。

## 6. 两周执行优先级

### P0：必须能写、能算、能排障

- response-only SFT、MHA/GQA、DPO/GRPO loss、temperature/top-p；
- MoE 前向与 GQA 手写（2026 已现场考：MT-26-01、MHY-26-01）；
- 参数、训练状态、activation 与 RL rollout/KV 显存；
- PPO/DPO/GRPO/DAPO/GSPO 的角色、数据流、目标、失败；
- RAG 归因实验；Agent 工具失败、并发隔离、终态评测；
- 选 12 道传统 coding，全部写边界测试。

### P1：按岗位方向选择

- 后训练：reward、hacking、entropy、stale rollout、credit assignment；OPD 与奖励密度谱系（N22）；
- Agent：trajectory 数据、memory、权限、安全、回放与评测；工具生态差异与上下文预算（skill/harness，N19）；
- 评测：LLM-as-a-Judge rubric、swap consistency、消融归因（N20）；
- 数据：合成、清洗、去重与多样性、配比消融（N21）；
- 多模态：VLM 数据阶段、视觉 token、OCR/grounding、模态失衡；
- 算法交付最低训推边界：只掌握 prefill/decode、TTFT/TPOT 和效果—成本验收，不扩展到 Serving 调度或 kernel；
- 搜广推相邻岗：传统 ML、指标、SQL 与因果/偏差基础。

### 每道题的合格答案模板

1. 一句话定义边界；
2. 画数据流或写核心公式；
3. 给 shape、复杂度、显存或成本；
4. 说一个失败模式和可观测指标；
5. 设计一个能证伪自己解释的最小实验；
6. 落到自己的项目数字和个人贡献。

## 7. 维护记录

- 2026-07-23：建立年份化题库；纳入 2025—2026 的模型算法公开复盘，单列华为证据缺口；新增 MoE、推理时计算、VLM、Agentic RL、GRPO normalization、训练/RL 显存、RAG 归因和 ML/数学答案卡；将 2027 明确标成预测；按个人方向删除纯推理 Infra、kernel/C++ 底层和硬件适配岗位样本。
- 2026-07-24：第三轮检索新增京东、滴滴、网易/有道、OPPO 共 9 组 `B` 记录及智谱 1 组 `B-` 候选；华为盘古、DeepSeek、Kimi、MiniMax、小米仍维持“强证据不足”。新增 MTP、Muon、长周期数据过滤、RLVR 因果对照、Generative RM、Search-R1、Visual-RFT 七张前沿答案卡；这些论文驱动题全部与历史面经分开标注。
- 2026-07-26：第四轮五路并行检索。(1) 主窗口新增 2026 年 `B`/`B-` 样本约 30 组，覆盖 27 届暑期实习与 2027 届提前批（BY-26-02～05、ALI-26-01～04、ANT-26-01～03、TX-26-01/02、BD-26-01/02、MT-26-01、KS-26-02～04、XHS-26-01、PDD-26-02/03、JD-26-01/02、DD-26-01、WY-26-01/02、OPPO-26-01、ZP-26-01）。(2) 新增 B站、荣耀、vivo、车企（理想/蔚来/小鹏）、米哈游、携程、Shopee 七个公司章节，及独角兽/其他 AI 公司的 2024—2025 画像样本（小米、MiniMax、商汤、讯飞、昆仑万维、百川、面壁）。(3) 智谱升级为强样本公司（ZP-26-01 Agent 工程化手撕、ZP-24-01 全流程）。(4) 华为/DeepSeek/月之暗面证据现状更新：华为 AI 岗机考两次改版、DeepSeek 社招流程一手叙述与 Agent 岗机考、Kimi 仍无强样本。(5) 新增 N17—N22 答案卡（DSA/两级注意力、线性混合架构、Agent 工程化生态、LLM-as-a-Judge、数据工程专场、奖励密度谱系）。(6) 已识别整理号风险：跨公司模板化账号与 2025 帖拆分重发（TX-26-02），相关样本均已降级或标注。
