---
title: "大模型强化学习从零到面试（10）：手写练习与实验"
description: "从空文件写 return、GAE、PPO clip、DPO、group advantage 与 masked GRPO 的练习与自动测试。"
date: 2026-08-13
tags:
  - ai
  - llm
  - rl
  - interview
featured: false
draft: false
lang: zh-CN
series: llm-rl-interview
seriesOrder: 11
---

> 本文是《大模型强化学习：从零到面试》专题第 10 章的发布版，核验日期 2026-08-13。配套零依赖参考实现与自动测试托管在 GitHub 仓库 [llm-algo-job-notes](https://github.com/keepkeen/llm-algo-job-notes)。

> 目标：把“知道公式”变成“能脱离框架写对、测对、解释对”。本专题自带一份纯 Python 核心实现和单元测试，不需要 GPU。

## 1. 运行方式

在仓库根目录执行：

```bash
python3 -m unittest discover -s '笔试/AI算法/强化学习/tests' -v
```

核心实现位于 [`templates/rl_interview_core.py`](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/AI%E7%AE%97%E6%B3%95/%E5%BC%BA%E5%8C%96%E5%AD%A6%E4%B9%A0/templates/rl_interview_core.py)，测试位于 [`tests/test_rl_interview_core.py`](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/AI%E7%AE%97%E6%B3%95/%E5%BC%BA%E5%8C%96%E5%AD%A6%E4%B9%A0/tests/test_rl_interview_core.py)。第一次学习建议按下面流程：

1. 先运行测试确认环境正常；
2. 复制实现到临时文件；
3. 只保留函数签名，闭卷重写；
4. 运行测试定位错误；
5. 解释每个失败为何发生，而不是照抄答案。

## 2. 必须闭卷写出的 8 个函数

### 2.1 Discounted Return

```python
def discounted_returns(rewards, gamma, dones=None, bootstrap_value=0.0):
    ...
```

检查点：反向递推、episode 边界、截断时 bootstrap。

### 2.2 GAE

```python
def generalized_advantage_estimation(
    rewards, values, gamma, lam, dones=None
):
    ...
```

检查点：`values` 比 `rewards` 多一个 bootstrap 值；done 后不能串到下一 episode。

### 2.3 Q-learning 更新

```python
def q_learning_target(reward, next_q_values, gamma, done):
    ...
```

检查点：Q-learning 使用下一状态动作的 `max`，terminal 不 bootstrap。

### 2.4 PPO clipped objective

```python
def ppo_clipped_objectives(
    old_log_probs, new_log_probs, advantages, clip_epsilon
):
    ...
```

检查点：ratio 在 log-space 求；正负 advantage 都用 `min`，不要手工分支改错方向。

### 2.5 Pairwise Reward Model loss

```python
def pairwise_reward_model_loss(chosen_reward, rejected_reward):
    ...
```

检查点：使用稳定的 `softplus(-(r_c-r_r))`。

### 2.6 DPO loss

```python
def dpo_loss(
    policy_chosen_logp, policy_rejected_logp,
    ref_chosen_logp, ref_rejected_logp, beta
):
    ...
```

检查点：先分别算 policy/reference margin，再算二者之差；不要漏掉 reference。

### 2.7 Group-relative advantage

```python
def group_relative_advantages(
    rewards, group_ids, normalize_std=True, eps=1e-8
):
    ...
```

检查点：只能在同 prompt 的 group 内归一化；全同分组返回零，而不是产生巨大数。

### 2.8 带 response mask 的 GRPO loss

```python
def grpo_clipped_loss(
    old_log_probs, new_log_probs, advantages,
    response_masks=None, clip_epsilon=0.2,
    aggregation='token'
):
    ...
```

检查点：工具 observation/padding 不参与 loss；区分 token-level 与 sequence-level reduction。

## 3. 五组数值题

### 题 1：Return

奖励 `[0, 2, 3]`，\(\gamma=0.9\)，无 bootstrap。

答案：

\[
G=[4.23,4.7,3]
\]

### 题 2：GAE

\(r=[1,1]\)，\(V=[0.5,0.6,0]\)，\(\gamma=1\)，\(\lambda=1\)，第二步 terminal。

\[
\delta_0=1+0.6-0.5=1.1,\quad
\delta_1=1-0.6=0.4
\]

\[
A_1=0.4,\quad A_0=1.1+0.4=1.5
\]

### 题 3：PPO clip

\(\epsilon=0.2\)，分别计算：

| ratio | advantage | unclipped | clipped | min |
|---:|---:|---:|---:|---:|
| 1.4 | 2 | 2.8 | 2.4 | 2.4 |
| 0.7 | 2 | 1.4 | 1.6 | 1.4 |
| 0.7 | -2 | -1.4 | -1.6 | -1.6 |
| 1.4 | -2 | -2.8 | -2.4 | -2.8 |

### 题 4：DPO

若 policy 的 chosen/rejected log-prob margin 为 1.2，reference margin 为 0.4，\(\beta=0.5\)：

\[
z=0.5(1.2-0.4)=0.4,\quad L=-\log\sigma(0.4)
\]

只要 policy 相对 reference 的偏好 margin 增大，loss 就下降。

### 题 5：GRPO 同分组

同一 prompt 的 reward 是 `[1, 1, 1, 1]`。减均值后全为 0；即使分母加 epsilon，也没有有效梯度。epsilon 只解决数值除零，不解决学习信号缺失。

## 4. 三个递进实验

### 实验 A：表格型 GridWorld

**目的：** 真正理解状态、动作、Bellman、on/off-policy。

实现：

1. 5×5 网格，固定起点、终点和障碍；
2. 比较 SARSA 与 Q-learning；
3. 画 episode return 与成功率；
4. 改变 epsilon 和随机转移概率；
5. 分析为什么两种算法学出不同风险偏好路径。

交付物：`gridworld.py`、两张曲线、300 字实验结论。

### 实验 B：多臂老虎机上的 REINFORCE

**目的：** 观察策略梯度、baseline 与 entropy。

实现：

1. 5 个 Bernoulli 臂；
2. softmax logits 作为策略；
3. 比较无 baseline、移动平均 baseline；
4. 比较不同 entropy coefficient；
5. 运行 5 个随机种子，报告均值和方差。

交付物：学习曲线、策略概率变化、方差对比。

### 实验 C：小模型可验证 RL

**目的：** 完成一条接近 LLM 后训练的最小闭环。

推荐任务：两位数加减法、括号匹配、短代码单元测试，选一个即可。

阶段：

1. 构造训练/验证 prompt，严格去重；
2. 先做 SFT baseline；
3. 每个 prompt 采样多个回答；
4. 编写确定性 verifier；
5. 用 GRPO 或框架等价实现训练；
6. 记录 reward、验证准确率、KL、entropy、长度、全对/全错组比例；
7. 做至少两个消融：是否标准化 std、是否加入长度惩罚；
8. 收集 reward hacking 或格式错误案例。

硬件不足时可选极小模型或只做 loss/data pipeline dry-run。不要为了“跑大模型”牺牲实验闭环。

## 5. Agentic RL 最小项目

如果目标岗位明确写 Agent/RL，实验 C 可升级为“检索 Agent”：

```text
问题 → 选择 search(query) 或 answer(text)
     → 本地固定文档库返回 observation
     → 最多 3 次检索
     → 答案命中 + 引用正确 + 调用成本奖励
```

需要实现：

- 固定、可重放的本地文档环境；
- JSON 工具调用 parser；
- final answer verifier；
- assistant token 与 tool observation 的 loss mask；
- trajectory log 与失败类型；
- success/citation/tool-cost 三项指标。

最有价值的消融：outcome-only vs 加 process reward；trajectory reward 广播 vs turn-level credit；同步 vs 模拟 policy-lag 数据。

## 6. 手写计时标准

| 内容 | 第一次目标 | 面试目标 |
|---|---:|---:|
| discounted return | 10 分钟 | 3 分钟 |
| GAE | 20 分钟 | 8 分钟 |
| PPO clip loss | 15 分钟 | 5 分钟 |
| DPO loss | 15 分钟 | 5 分钟 |
| group advantage | 15 分钟 | 6 分钟 |
| masked GRPO loss | 30 分钟 | 15 分钟 |
| 口述完整 RLHF pipeline | 5 分钟 | 90 秒 |
| Agentic RL 系统设计 | 15 分钟 | 3 分钟 |

## 7. 常见代码错误清单

- 把 probability 当 log-prob 再 `exp`；
- PPO 对负 advantage 错用 `max`；
- GAE 穿过 terminal 继续累积；
- DPO 忘记 reference margin；
- group normalization 跨 prompt；
- response mask 把 prompt 或工具返回算入 loss；
- mask 求和为零时直接除；
- sequence reduction 实际做成 token-weighted；
- 用样本标准差/总体标准差却未说明；
- verifier 把格式正确误当任务正确。

## 8. 项目 README 模板

```markdown
# 项目名

## 问题与 MDP 建模
状态、动作、转移、奖励、终止条件。

## 数据与基线
数据来源、切分、防泄漏、SFT/无 RL 基线。

## 算法
采样策略、advantage、loss、KL、mask、reduction。

## 系统
模型、硬件、框架、吞吐、显存与版本。

## 评测
主指标、独立指标、成本、安全、方差。

## 消融与失败案例
每次只改变一个因素；展示失败轨迹与排障证据。

## 复现
安装、命令、配置、随机种子、预期输出。
```
