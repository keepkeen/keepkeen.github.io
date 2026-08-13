---
title: "大模型强化学习资料与面经来源索引"
description: "汇总经典论文、2025—2026 新方法、官方框架、岗位页面和候选人面经，并说明证据等级与使用边界。"
date: 2026-08-13
tags:
  - reinforcement-learning
  - llm
  - interview
lang: zh-CN
draft: false
series: llm-reinforcement-learning-interview
seriesOrder: 13
---
> 检索截止：2026-08-13。技术结论优先使用论文、官方博客和官方文档；面经只用于判断“考什么”，不作为算法事实的唯一依据。

## 1. 检索方法

本专题按九条工作流检索：经典 RL、RLHF/PPO、偏好学习/DPO、GRPO/RLVR、新方法、Agentic RL、训练框架、官方岗位、候选人面经。深度检索共返回约 **427 条候选结果**（不同查询有重合），再按以下规则去重和筛选：

1. 同一论文优先论文主页/官方仓库；
2. 技术实现优先框架官方文档；
3. 招聘要求优先公司官方招聘页；
4. 面经优先候选人第一人称、题目具体且时间可定位的帖子；
5. 搬运、卖课、仅搜索摘要或日期冲突的材料降级；
6. 未找到公开材料不等于公司没有招聘或没有问过该题。

面经证据等级：

- **B**：公开候选人亲历，时间/岗位/题目至少两项明确；
- **B-**：疑似亲历但账号偏整理、正文不完整或时间不够明确；
- **线索**：二手汇总、付费墙摘要或媒体转述，只用于扩大检索，不据此断言频率。

## 2. 经典强化学习与策略优化

| 来源 | 类型 | 本专题用途 |
|---|---|---|
| [Sutton & Barto, Reinforcement Learning: An Introduction](https://mitpress.mit.edu/9780262352703/reinforcement-learning/) | 教材/官方出版页 | MDP、value、MC、TD、控制、策略梯度的主教材 |
| [OpenAI Spinning Up: Key Concepts in RL](https://spinningup.openai.com/en/latest/spinningup/rl_intro.html) | 官方教程 | 零基础概念与术语 |
| [Policy Gradient Theorem](https://proceedings.neurips.cc/paper_files/paper/1999/file/464d828b85b0bed98e80ade0a5c43b0f-Paper.pdf) | 原始论文 | 策略梯度理论来源 |
| [Generalized Advantage Estimation](https://arxiv.org/abs/1506.02438) | 原始论文 | GAE、偏差—方差 |
| [Proximal Policy Optimization Algorithms](https://arxiv.org/abs/1707.06347) | 原始论文 | PPO clipped objective |
| [Spinning Up: PPO](https://spinningup.openai.com/en/latest/algorithms/ppo.html) | 官方教程 | PPO 伪代码、超参与直觉 |

## 3. LLM 对齐、偏好学习与 Reasoning RL

| 来源 | 类型 | 本专题用途 |
|---|---|---|
| [InstructGPT](https://arxiv.org/abs/2203.02155) | 原始论文 | SFT→RM→PPO 的经典 RLHF pipeline |
| [Direct Preference Optimization](https://proceedings.neurips.cc/paper_files/paper/2023/file/a85b405ed65c6477a4fe8302b5e06ce7-Paper-Conference.pdf) | 原始论文 | DPO 推导、reference 与隐式 reward |
| [Let’s Verify Step by Step](https://arxiv.org/abs/2305.20050) | 原始论文 | Outcome/Process supervision 与 PRM |
| [DeepSeekMath](https://arxiv.org/abs/2402.03300) | 原始论文 | GRPO 的代表性来源 |
| [DeepSeek-R1 官方仓库](https://github.com/deepseek-ai/DeepSeek-R1) | 官方仓库/报告入口 | reasoning RL、RLVR 与公开模型说明 |
| [DAPO](https://arxiv.org/abs/2503.14476) | 原始论文 | Clip-Higher、动态采样、token loss、overlong shaping |
| [DAPO 官方实现](https://github.com/BytedTsinghua-SIA/DAPO) | 官方仓库 | 配置和实现对照 |
| [GSPO](https://arxiv.org/abs/2507.18071) | 原始论文 | sequence-level policy optimization |
| [Qwen GSPO 官方解读](https://qwenlm.github.io/blog/gspo/) | 官方博客 | GSPO 动机与 MoE 稳定性 |
| [On-Policy Distillation](https://thinkingmachines.ai/blog/on-policy-distillation/) | 研究机构官方博客 | 学生 on-policy 采样 + 教师稠密监督 |

阅读新方法时不背“方法动物园”，统一比较：baseline/advantage、importance ratio 粒度、KL、reduction、采样分布、解决的失败模式和新增代价。

## 4. Agentic RL

| 来源 | 类型 | 本专题用途 |
|---|---|---|
| [Search-R1](https://arxiv.org/abs/2503.09516) | 原始论文 | 搜索工具交互与 reasoning RL |
| [Search-R1 官方仓库](https://github.com/PeterGriffinJin/Search-R1) | 官方仓库 | 环境与训练实现 |
| [RAGEN](https://arxiv.org/abs/2504.20073) | 原始论文 | 多轮 Agent RL 框架与稳定性 |
| [RAGEN 官方仓库](https://github.com/ragen-ai/ragen) | 官方仓库 | rollout/environment 实现 |
| [ARPO](https://arxiv.org/abs/2507.19849) | 原始论文 | 多轮 Agent 的分支探索与优化 |
| [ARPO 官方仓库](https://github.com/RUC-NLPIR/ARPO) | 官方仓库 | 训练代码与配置 |
| [Agent-R1](https://github.com/AgentR1/Agent-R1) | 官方仓库 | 端到端 Agent RL 训练参考 |
| [Agent Lightning 教程](https://microsoft.github.io/agent-lightning/stable/how-to/train-first-agent/) | 官方文档 | 将已有 Agent 轨迹接入 RL |

## 5. 训练框架官方文档

| 来源 | 重点阅读 |
|---|---|
| [TRL DPO Trainer](https://huggingface.co/docs/trl/main/en/dpo_trainer) | DPO 数据格式、loss 变体、监控指标 |
| [TRL PPO Trainer](https://huggingface.co/docs/trl/main/en/ppo_trainer) | PPO API 与模型角色 |
| [TRL GRPO Trainer](https://huggingface.co/docs/trl/main/grpo_trainer) | group sampling、reward functions、loss/reduction 配置 |
| [verl 文档](https://verl.readthedocs.io/) | worker、resource pool、rollout/trainer 编排 |
| [verl PPO](https://verl.readthedocs.io/en/latest/algo/ppo.html) | PPO 配置与实现语义 |
| [verl GRPO](https://verl.readthedocs.io/en/latest/algo/grpo.html) | GRPO 配置与实现语义 |
| [slime 文档](https://thudm.github.io/slime/) | 训练—生成解耦与大规模 RL |
| [slime Agent 指南](https://thudm.github.io/slime/get_started/agent.html) | 自定义 Agent rollout |
| [OpenRLHF 文档](https://openrlhf.readthedocs.io/) | 分布式 RLHF 与 Ray 编排 |

框架会持续更新，实际使用前应以当前官方文档和安装版本为准。

## 6. 2026 岗位需求样本

这些页面用于验证岗位方向，不用于推断招聘名额或截止时间；投递前必须再次打开官方页面确认。

| 公司/来源 | 公开信号 |
|---|---|
| [字节 Seed 2027 Early Career](https://seed.bytedance.com/zh/seedearlycareer) | Code Agent RL、Multi-Agent RL、RL Scaling 等方向 |
| [字节 Seed 2027 校招公告](https://seed.bytedance.com/zh/blog/bytedance-seed-2027-foundation-model-campus-recruitment-is-now-open-internships-included) | 基础模型校招与实习入口 |
| [阿里巴巴 2027 校招职位](https://campus-talent.alibaba.com/campus/position/199907740040) | 大模型算法岗位官方 JD 样本 |
| [阿里大模型多模态后训练实习](https://campus-talent.alibaba.com/campus/position/199903480017) | 后训练/多模态方向 JD 样本 |
| [小红书校园招聘职位](https://job.xiaohongshu.com/campus/position/20888) | 大模型算法相关官方职位样本 |
| [滴滴社会招聘职位](https://talent.didiglobal.com/social/p/60879) | 大模型/Agent 相关职位样本 |

岗位页面可能下线或调整，因此专题正文只提炼能力维度，不硬编码长期有效的 HC、薪资或截止日期。

## 7. 2025–2026 公开面经样本

| 公司/岗位 | 时间 | 证据 | 可核验考点 |
|---|---:|---:|---|
| [百度大模型后训练一面](https://www.nowcoder.com/discuss/863890669662674944) | 2026-03 | B | trust region、PPO clip、on-policy、IS、GAE、GRPO、DAPO/GSPO/GFPO、Agentic RL、分布式显存 |
| [百度大模型后训练二面](https://www.nowcoder.com/discuss/864605093486682112) | 2026-03 | B | GRPO 数据流、KL/softmax 稳定性、四种 policy、policy lag、TRL/verl |
| [字节 Agentic RL 面经](https://www.nowcoder.com/feed/main/detail/28b254940eb940189188d795f4606c52) | 2026 | B | process scoring、trajectory→token、rollout 长尾、DAPO、MoE route mismatch、GSPO |
| [腾讯大模型 RL 面经](https://www.nowcoder.com/feed/main/detail/905343c9a3834f8d9d9bdc3790a59687) | 2026 | B- | PPO/GRPO/DAPO、critic baseline、连续 reward |
| [蔚来大模型 RL 面经](https://www.nowcoder.com/discuss/863132498270695424) | 2026-03 | B | PPO/GRPO 公式与流程、TRL/verl/Ray、Agentic RL 稀疏奖励与工具可靠性 |
| [滴滴大模型 RL 面经](https://www.nowcoder.com/feed/main/detail/3fd2957eb8274e0cb4afcac39ed182d3) | 2026-06 | B- | 全对/全错组、curriculum、reward/KL/clipfrac、trajectory-token gap |
| [快手大模型算法一面](https://www.nowcoder.com/discuss/876503715031572480) | 2026-04 | B | DPO 数据分布、beta、GRPO 公式、old/current policy |
| [B 站大模型二面](https://www.nowcoder.com/feed/main/detail/f2a8e9c26b7b4915b96400287beb1255) | 2025-09 | B | DPO 理论、beta、PPO 稀疏奖励、on/off-policy |
| [vivo 多模态大模型](https://www.nowcoder.com/feed/main/detail/dc108b298ab8483e8de08a5afacd2fce) | 2026-04 | B- | reward 设计、GRPO IS、KL、reward hacking、多轮任务训练 |
| [携程大模型算法](https://www.nowcoder.com/discuss/868214571696152576) | 2026-03 | B | PPO/DPO/GRPO、critic、KL 发散排障 |
| [荣耀大模型算法](https://www.nowcoder.com/feed/main/detail/b26abb2ad0b5495f84ac690cf4a99342) | 2026-04 | B | RL reward、GRPO/PPO、训练显存与并行 |
| [小鹏多模态大模型](https://www.nowcoder.com/feed/main/detail/96f931642588471e8939e29028604499) | 2026-03 | B | PPO/GRPO/GSPO/DAPO、投机/拒绝采样、多模态 |

### 面经使用限制

- 帖子可能遗漏上下文、误写术语或混淆算法。例如“GRPO 的 GAE”应先确认面试官是否问对比，标准 GRPO 通常不训练 critic，也不使用 GAE。
- 牛客页面的显示年份、搜索摘要和正文偶尔冲突；表中仅保留能合理定位到检索窗口的样本，日期不确定者已降级。
- 题目出现一次只能证明“问过”，不能证明“所有公司高频”。专题中的优先级来自多来源交集和岗位 JD，而非简单计数。

## 8. 继续更新时的模板

```markdown
### 公司｜岗位｜轮次
- URL：
- 页面日期：
- 自述面试日期：
- 是否亲历：
- 题目原意：
- 对应知识章节：
- 证据等级：B / B- / 线索
- 备注：登录墙、搬运、日期冲突、岗位边界
```

新增算法资料时必须记录：要解决的失败模式、核心目标、与 GRPO/PPO 的真正差异、官方实现地址，以及是否已有独立复现。这样可以避免专题退化成只追新名词的列表。
---

原始讲义与可运行材料：[GitHub 源文件](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/AI%E7%AE%97%E6%B3%95/%E5%BC%BA%E5%8C%96%E5%AD%A6%E4%B9%A0/sources/%E6%9D%A5%E6%BA%90%E7%B4%A2%E5%BC%95.md)。
