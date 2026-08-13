---
title: "大模型强化学习岗位地图与学习入口"
description: "从 2025—2026 公开岗位和面经出发，区分后训练、Reasoning RL、Agentic RL 与 RL 系统岗位，并给出零基础优先级。"
date: 2026-08-13
tags:
  - reinforcement-learning
  - llm
  - interview
lang: zh-CN
featured: true
draft: false
series: llm-reinforcement-learning-interview
seriesOrder: 1
---
## 1. 你真正要准备的是哪一种 RL 岗

2026 年招聘里，“大模型强化学习”至少分成三类。岗位名称相近，日常工作和面试重心却不同。

| 岗位 | 主要产出 | 高频能力 | 典型追问 |
|---|---|---|---|
| 后训练/效果算法 | 模型能力、对齐、推理与任务成功率 | 数据、reward、PPO/DPO/GRPO、评测、实验 | 为什么选 RL；reward 如何防作弊；全对全错怎么办 |
| Reasoning RL/RLVR | 数学、代码、搜索等可验证推理 | verifier、采样、课程学习、token 效率、稳定性 | GRPO/DAPO/GSPO；长度膨胀；是否学到新能力 |
| Agentic RL | 多轮工具调用和长程任务 | 环境、状态、轨迹、过程奖励、credit、容错 | tool response 是否算 loss；失败轨迹如何归因；何时终止 |
| RL Infra/系统 | 高吞吐、稳定、可扩展训练平台 | rollout、权重同步、FSDP/Megatron、Ray、vLLM/SGLang | policy lag；partial rollout；长尾请求；colocation |

官方岗位也体现了这种分化：字节 Seed 2027 校招公开列出 Code Agent RL、Multi-Agent RL 和 RL Scaling；小红书 Post-training 岗同时覆盖 Reward Model、Reasoning 和 Agentic RL；滴滴岗位把垂域 Agent、reward 与 PPO/GRPO 放在同一条闭环中；阿里国际的 Agentic RL 系统实习则直接要求处理分布式、partial rollout 与训练稳定性。[字节 Seed](https://seed.bytedance.com/zh/seedearlycareer)、[小红书岗位](https://job.xiaohongshu.com/campus/position/20888)、[滴滴岗位](https://talent.didiglobal.com/social/p/60879)、[阿里岗位](https://www.nowcoder.com/jobs/detail/439670)

### 对零经验者的现实建议

第一目标不是同时成为四类专家，而是建立一个 T 型结构：

- 横向能回答经典 RL、PPO/DPO/GRPO、奖励与训练指标；
- 纵向选择“效果算法”或“Agentic RL”之一做可运行项目；
- RL Infra 先达到会画数据流、会解释性能瓶颈，不把自己包装成系统专家。

## 2. 2026 面试已经问到什么深度

以下只表示这些公开复盘声称问过，不代表公司固定题库。

| 样本 | 公开问题信号 | 对应章节 |
|---|---|---|
| [百度 RL 后训练一面，2026-03-18](https://www.nowcoder.com/discuss/863890669662674944) | trust region、on-policy、importance sampling、clip 正负 advantage、GAE、GRPO 聚合、变体、Agentic RL | 03、04、06、07 |
| [百度文心后训练二面，2026-03-20](https://www.nowcoder.com/discuss/864605093486682112) | GRPO 数据流、KL/softmax 数值稳定、policy/old/rollout、batch 大导致 policy lag、TRL/verl、现场 SFT | 06、08、10 |
| [字节 27 届暑期一面](https://www.nowcoder.com/feed/main/detail/28b254940eb940189188d795f4606c52) | Agent 过程奖励、trajectory 到 token、rollout 长尾、DAPO 聚合、MoE 路由与 GSPO | 06、07、08 |
| [腾讯大模型算法二面](https://www.nowcoder.com/feed/main/detail/905343c9a3834f8d9d9bdc3790a59687) | PPO/GRPO/DAPO、critic baseline、rollout 与连续奖励 | 04、06 |
| [蔚来 RL 实习一面，2026-03-16](https://www.nowcoder.com/discuss/863132498270695424) | PPO/GRPO 公式与流程、TRL/verl/Ray、Agentic RL 稀疏奖励和工具稳定性 | 04、06、07、08 |
| [滴滴算法实习，页面 2026-06-21](https://www.nowcoder.com/feed/main/detail/3fd2957eb8274e0cb4afcac39ed182d3) | 全对全错 group、课程学习、reward/KL/clip fraction、trajectory-token gap、业务 reward | 06、07、08 |

这批样本给出五个稳定的准备结论：

1. **公式不是终点**：面试官会把公式中的每个角色映射到实际模型、版本和张量。
2. **传统 RL 基础重新重要**：GAE、importance sampling、on/off-policy、baseline 已重新进入一面。
3. **GRPO 必须讲失败**：零方差 group、长度偏置、reward hacking、policy lag、MoE 训推不一致。
4. **Agent RL 是真正的序列决策**：状态转移、环境反馈和 credit assignment 不能用单轮偏好学习敷衍。
5. **代码仍然存在**：除了 LeetCode，还可能手写 KL、DPO/GRPO 数据流、SFT mask 或训练循环。

## 3. 从经典 RL 到 LLM RL 的映射

| 经典 RL 概念 | 语言模型中的对应物 |
|---|---|
| state $s_t$ | prompt 与已生成 token；Agent 中还包括工具返回和外部状态 |
| action $a_t$ | 下一个 token；也可把一轮工具调用视为高层 action |
| policy $\pi_\theta$ | 自回归语言模型 |
| trajectory $\tau$ | 一段回答，或多轮 reasoning/tool/observation 序列 |
| environment | tokenizer 之后的生成过程；Agent 中是搜索、代码沙箱、数据库或用户模拟器 |
| reward $r_t$ | RM 分数、规则 verifier、单测、最终任务状态、过程评估 |
| value $V(s_t)$ | 从当前前缀继续生成的期望回报 |
| episode end | EOS、任务成功/失败、超时、步数或预算耗尽 |

单轮回答常可近似 contextual bandit：prompt 是 context，一整条回答可视为一个宏观 action，末尾得到奖励。但 token 级优化仍使用整条回答的 log-prob；多轮 Agent 更不能忽略环境转移。

## 4. 你不需要先学什么

面向 LLM 后训练，以下内容不是第一个月的主线：

- 连续控制中 DDPG/TD3/SAC 的全部工程细节；
- 机器人动力学和 model-based control；
- 多智能体博弈论完整理论；
- 每一个 2026 年新缩写的论文细节。

但 Q-learning、replay buffer、target network 仍要理解，因为它们帮助你回答 on/off-policy、数据复用和 DQN，也会出现在 RL Infra 岗位描述中。

## 5. 学习闭环

每章用同一套六步法：

1. 用一句话说明算法解决什么问题；
2. 写出数据从哪里来；
3. 写目标函数并逐符号解释；
4. 用一个两步或三 token 数值例子计算；
5. 说一个失败模式和一个监控指标；
6. 从空文件写核心函数并测试。

如果一章只做到“看懂”，不算完成。面试要求的是从问题到公式、数据流、实现、异常和取舍的完整链路。
---

原始讲义与可运行材料：[GitHub 源文件](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/AI%E7%AE%97%E6%B3%95/%E5%BC%BA%E5%8C%96%E5%AD%A6%E4%B9%A0/00_%E4%B8%93%E9%A2%98%E5%AF%BC%E8%AF%BB%E4%B8%8E%E5%B2%97%E4%BD%8D%E5%9C%B0%E5%9B%BE.md)。
