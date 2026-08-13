---
title: "Agentic RL 与多轮工具调用"
description: "从多轮 MDP、轨迹 schema、loss mask、奖励归因到异步 rollout、policy lag、环境设计和安全。"
date: 2026-08-13
tags:
  - reinforcement-learning
  - llm
  - interview
lang: zh-CN
draft: false
series: llm-reinforcement-learning-interview
seriesOrder: 8
---
> 目标：把“让模型生成一段答案”升级为“让模型在环境里连续观察、思考、调用工具并完成任务”。这是 2026 年 Agent 算法岗最明显的新增主线。

## 1. 为什么单轮 RL 不够

普通 RLVR 常把一次回答看成一条轨迹：

\[
x \rightarrow y_{1:T} \rightarrow r
\]

数学题可以在答案末尾用规则判分，代码题可以运行测试。Agent 任务则是：

\[
s_0 \xrightarrow{a_0} o_1 \xrightarrow{a_1} o_2 \cdots
\xrightarrow{a_{H-1}} o_H \rightarrow r
\]

- \(s_t\)：到第 \(t\) 轮为止的对话、记忆和环境状态；
- \(a_t\)：自然语言、工具调用、参数或终止动作；
- \(o_{t+1}\)：搜索结果、代码执行结果、网页状态或报错；
- \(H\)：不固定的轨迹长度；
- \(r\)：任务成功、过程质量、成本和安全约束的组合。

这里新增了四个难点：环境会变化、奖励更稀疏、轨迹更长、生成速度差异更大。

## 2. 两层 MDP：轮次级与 token 级

面试时先说清建模粒度。

### 2.1 轮次级 MDP

把一次完整工具调用当作动作：

\[
a_t=(\text{tool name},\text{arguments})
\]

优点是容易描述规划和信用分配；缺点是实际策略仍按 token 生成，不能直接训练离散的“大动作”。

### 2.2 token 级 MDP

每个 token 是动作，状态是此前所有 token 与环境观察。它与语言模型训练完全一致，但一条轨迹可能包含几千到几十万步。

工程上通常采用“两层视角”：

- 采样器按轮次与环境交互；
- 优化器在 assistant 生成 token 上计算策略损失；
- turn-level 或 trajectory-level 奖励再映射到 token。

## 3. 一条训练轨迹应该保存什么

建议统一成下面的逻辑结构：

```text
trajectory_id
prompt / initial_state
policy_version
turns[]:
  - assistant_text
  - tool_name
  - tool_arguments
  - environment_observation
  - token_ids
  - old_log_probs
  - response_mask
  - turn_reward / verifier_result
terminal_reward
costs: tokens, latency, tool_calls
termination_reason
```

三个 mask 必须分清：

1. `attention_mask`：哪些位置参与 Transformer 计算；
2. `response_mask`：哪些 token 是策略生成的，应参与 policy loss；
3. `loss_mask`：综合异常轨迹、工具返回、padding 等规则后的最终训练位置。

工具返回通常是环境观察，不是策略动作，因此默认不算 policy loss；但它仍要进入后续上下文。若工具输出由另一个可训练策略生成，则要另行建模，不能机械套用这一结论。

## 4. 多轮 rollout 的最小闭环

```python
state = env.reset(task)
trajectory = []

for turn in range(max_turns):
    action, token_data = policy.generate(state)

    if action.is_final_answer:
        trajectory.append((state, action, None, token_data))
        break

    observation = env.step(action.tool_name, action.arguments)
    trajectory.append((state, action, observation, token_data))
    state = append(state, action, observation)

reward = verifier(task, trajectory, env.snapshot())
buffer.add(trajectory, reward)
trainer.update(buffer)
```

真实系统还需要超时、重试、并发隔离、环境快照、policy version、异常归因和可重放日志。

## 5. 奖励设计：结果只是第一层

一个实用的 Agent 奖励可以写成：

\[
R = w_sR_{success}+w_pR_{process}-w_cC-w_vP_{violation}
\]

- \(R_{success}\)：任务最终是否完成，最好由可验证环境给出；
- \(R_{process}\)：关键步骤是否正确，例如检索到证据、SQL 可执行；
- \(C\)：token、延迟、工具调用次数等成本；
- \(P_{violation}\)：越权、破坏性调用、格式错误或安全违规。

### 5.1 Outcome reward

优点是目标真实、不易把人工偏好误当目标；缺点是过于稀疏。适合单元测试、数据库最终状态、游戏得分等可验证任务。

### 5.2 Process reward

为中间步骤给分，例如搜索 query 是否有效、工具参数是否合法。它能缓解稀疏奖励，但验证器设计不当会诱导模型刷过程分。

### 5.3 成本与约束

“成功但调用 80 次工具”未必是好策略。成本项应单独记录，再决定是并入 reward，还是作为约束优化：

\[
\max_\pi\;\mathbb E[R_{success}],\quad
\text{s.t. }\mathbb E[C]\le c_0
\]

面试中说出“不要一开始把所有指标压成一个数，先保留分项指标”通常比直接拍权重更可靠。

## 6. 从轨迹奖励分给 token：信用分配

### 方法 A：整条轨迹共享一个 advantage

最简单：成功轨迹的所有动作 token 都获得同一个正 advantage。实现容易，但会奖励轨迹中的无效步骤。

### 方法 B：return-to-go / GAE

若每轮都有奖励和价值估计，可从后向前计算 return 或 GAE。它能区分前后动作，但需要 critic，长轨迹上的价值学习也很难。

### 方法 C：过程奖励模型或规则验证器

给关键 turn 或 span 直接打分。关键风险是 reward hacking，以及“验证器会不会比任务本身还难”。

### 方法 D：分支对比

在同一状态采样多个后续分支，以成功率或 verifier 分数比较动作。这比整轨迹标签更细，但采样成本高。

### 方法 E：回溯式归因

任务结束后，让 critic 或规则定位决定成败的步骤，再构造 turn-level advantage。要避免让同一个模型既生成又无约束地自评。

没有一种方法在所有任务上最优。回答时应说明环境是否可验证、能否分支采样、是否有稳定 critic，再选方案。

## 7. Group-relative 方法如何扩展到 Agent

对同一个任务采样 \(G\) 条完整轨迹：

\[
\tau_1,\ldots,\tau_G\sim\pi_{old}(\cdot\mid x)
\]

再按终局 reward 或综合 reward 计算组内 advantage：

\[
\hat A_i=\frac{R(\tau_i)-\mu_R}{\sigma_R+\epsilon}
\]

最后把 \(\hat A_i\) 广播给该轨迹中可训练的动作 token。这个方案不需要 critic，但会遇到：

- 一组轨迹全失败：advantage 接近零，学不到东西；
- 轨迹长度差异巨大：token-level 聚合偏向长轨迹；
- 失败原因不同：格式错、工具崩溃和推理错被同等处理；
- 环境随机：同一策略可能因为外部 API 抖动得不同分。

对应改进包括课程学习、按失败类型分层奖励、sequence-level importance ratio、环境重放与分层采样。

## 8. 异步采样与 policy lag

Agent rollout 很慢，若等待最慢轨迹，GPU 会出现长尾空闲。因此系统常将 rollout 与训练异步化。但样本由旧版本 \(\pi_b\) 生成，训练时已经是 \(\pi_\theta\)：

\[
\rho_t=\frac{\pi_\theta(a_t\mid s_t)}{\pi_b(a_t\mid s_t)}
\]

policy lag 太大时，ratio 方差上升，裁剪样本增多，训练有效率下降。常见措施：

- 给每条轨迹记录 policy version；
- 限制最大可接受版本差；
- 控制 trainer 与 rollout worker 的节拍；
- 监控 ratio、clip fraction 和样本年龄；
- 必要时采用 trajectory/sequence-level 的校正或丢弃陈旧样本。

“异步能提高吞吐”只答了一半；还要说明它带来的 off-policy 偏差。

## 9. 环境设计比算法名字更重要

一个可训练环境至少应满足：

- **可重置**：同一任务能回到一致初态；
- **可观测**：必要状态不会藏在不可记录的 UI 中；
- **可判分**：能判断成功、部分成功和违规；
- **可隔离**：不同 rollout 不互相污染；
- **可重放**：日志足以复现失败；
- **有边界**：超时、最大步数、预算和权限明确；
- **尽量确定**：外部服务变化要被缓存、mock 或版本化。

数据库任务可使用每条轨迹独立的事务或快照；浏览器任务要固定页面版本；代码任务要容器隔离并限制资源。

## 10. Reward hacking 与安全

典型漏洞：

- 模型修改测试文件，让代码“通过”；
- 重复调用能拿过程分的工具；
- 在 final answer 中伪造工具结果；
- 利用 verifier 的字符串匹配漏洞；
- 通过外部内容中的 prompt injection 绕过约束；
- 用高成本暴力搜索换取成功率。

防线应覆盖四层：

1. 环境权限与沙箱；
2. 独立且保密的评测器；
3. 行为与状态审计；
4. 对成本、安全和最终结果分别监控。

## 11. 代表性工作该怎么读

- [Search-R1](https://arxiv.org/abs/2503.09516)：让模型在推理中调用搜索，适合观察“检索动作—环境反馈—继续推理”的闭环。
- [RAGEN](https://arxiv.org/abs/2504.20073)：强调多轮 Agent 的强化学习框架与训练稳定性。
- [ARPO](https://arxiv.org/abs/2507.19849)：面向多轮 Agent 的分支探索与策略优化。
- [Agent-R1](https://github.com/AgentR1/Agent-R1)：可结合代码理解 rollout、环境与训练器如何连接。
- [Agent Lightning](https://microsoft.github.io/agent-lightning/stable/how-to/train-first-agent/)：从已有 Agent 轨迹接入训练的工程教程。

读论文时固定回答六个问题：状态/动作是什么、奖励在哪、advantage 怎么来、哪些 token 算 loss、如何处理 policy lag、评测是否真的测到任务能力。

## 12. 面试场景题：设计一个浏览器 Agent 的 RL 系统

推荐按下面顺序作答：

1. **任务与环境**：固定网页快照，动作是点击、输入、滚动和提交；
2. **数据**：先用演示轨迹 SFT，让模型具备合法工具调用能力；
3. **采样**：每题并行生成多条轨迹，记录 policy version 与完整环境事件；
4. **奖励**：最终页面状态为主，过程合法性和成本为辅；
5. **归因**：先用 trajectory-level GRPO 建基线，再引入 turn verifier；
6. **优化**：对 assistant action token 算 loss，工具观察只进上下文；
7. **系统**：异步 rollout，限制样本版本差和工具预算；
8. **评测**：成功率、成本、超时率、无效调用率、安全违规率；
9. **防作弊**：独立隐藏评测、沙箱、状态校验和轨迹审计；
10. **消融**：比较 outcome-only、process reward、成本惩罚和不同归因方法。

## 13. 本章自测

1. 为什么工具返回通常不计入 policy loss？
2. trajectory reward 直接广播给全部 token 有什么偏差？
3. 异步 rollout 为什么会让 PPO/GRPO 变得更 off-policy？
4. 全组失败时 group-relative advantage 为什么失效？
5. 如何判断失败来自策略、环境、工具还是 verifier？
6. 你会如何防止 Agent 修改测试来骗取 reward？

如果能在 3 分钟内用“建模—数据—奖励—优化—系统—评测”讲完整一个 Agentic RL 方案，本章就达标了。
---

原始讲义与可运行材料：[GitHub 源文件](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/AI%E7%AE%97%E6%B3%95/%E5%BC%BA%E5%8C%96%E5%AD%A6%E4%B9%A0/07_AgenticRL%E4%B8%8E%E5%A4%9A%E8%BD%AE%E5%B7%A5%E5%85%B7%E8%B0%83%E7%94%A8.md)。
