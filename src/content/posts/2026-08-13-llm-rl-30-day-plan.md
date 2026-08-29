---
title: "大模型强化学习 30 天学习与项目计划"
description: "每天安排 RL 主线、公式手写、项目、面经口述和两道 LeetCode，月底形成可展示的训练闭环。"
date: 2026-08-13
updatedDate: 2026-08-29
tags:
  - reinforcement-learning
  - llm
  - interview
lang: zh-CN
draft: false
series: llm-reinforcement-learning-interview
seriesOrder: 12
---
> 适用对象：没有强化学习项目经验，但已有 Python、深度学习和 Transformer 基础。默认工作日 3～3.5 小时、周末 5～6 小时。时间不足时保留 P0 项，先删扩展论文。

## 1. 每天固定四个时间块

| 时间 | 内容 | 必须留下的产物 |
|---:|---|---|
| 45～60 分钟 | LeetCode 2 题 | 复杂度、错因、闭卷重写日期 |
| 75～90 分钟 | RL 主线学习 | 一页自己的笔记，不复制原文 |
| 45～60 分钟 | 公式/代码/项目 | 可运行代码或手推过程 |
| 30 分钟 | 面经口述与复盘 | 录音或 3 分制评分 |

当天做不完时按“RL 主线 → 面经口述 → LeetCode 1 题 → 扩展阅读”排序。不要用熬夜补齐表格，第二天先修复最关键欠账。

## 2. 30 天日历

| 天 | RL 主线 | 手写/项目 | LeetCode（2 题） | 当天验收 |
|---:|---|---|---|---|
| 1 | 专题导读、岗位地图、前测 | 建错题表；跑单元测试 | 1 两数之和；49 字母异位词分组 | 能解释为什么 LLM 生成是 MDP |
| 2 | 概率、期望、梯度、log trick | 手推 softmax 与 log-softmax | 128 最长连续序列；283 移动零 | 口述 log-derivative trick |
| 3 | MDP、return、Bellman | 闭卷写 discounted return | 11 盛最多水的容器；15 三数之和 | 做对含 terminal 的 return 数值题 |
| 4 | \(V/Q/A\)、策略评估 | 写 Bellman expectation 小例子 | 3 无重复字符最长子串；438 找到字符串中所有字母异位词 | 区分 V、Q、A |
| 5 | MC、TD、bootstrap | 闭卷写 TD target | 560 和为 K 的子数组；239 滑动窗口最大值 | 说清偏差—方差 |
| 6 | SARSA、Q-learning、探索 | 实现 5×5 GridWorld 骨架 | 76 最小覆盖子串；42 接雨水 | 区分 on/off-policy |
| 7 | 第一周复盘 | 完成 GridWorld 对比曲线 | 53 最大子数组和；56 合并区间 | 经典 RL 题口述 ≥ 12/15 分 |
| 8 | Policy Gradient、REINFORCE | 闭卷推导并写 loss | 189 轮转数组；238 除自身以外数组的乘积 | 从期望推到策略梯度 |
| 9 | baseline、Actor-Critic | 多臂老虎机 + 无 baseline | 73 矩阵置零；54 螺旋矩阵 | 证明 baseline 不改期望 |
| 10 | GAE 与 \(\lambda\) | 闭卷写 GAE；跑边界测试 | 48 旋转图像；160 相交链表 | 8 分钟写对 GAE |
| 11 | RLHF 全流程 | 画 actor/critic/ref/RM 数据流 | 206 反转链表；234 回文链表 | 90 秒讲完整 RLHF |
| 12 | PPO ratio 与 clip | 四种正负 advantage 数值题 | 141 环形链表；142 环形链表 II | 不看答案解释 `min` |
| 13 | PPO KL、entropy、value loss | 写 PPO loss；列指标 | 21 合并两个有序链表；2 两数相加 | 分清两类 KL |
| 14 | PPO 系统与排障 | 画显存和 worker 放置 | 19 删除倒数第 N 个结点；24 两两交换节点 | 第二周闭卷模拟 45 分钟 |
| 15 | 偏好数据与 Reward Model | 写 pairwise RM loss | 25 K 个一组翻转链表；138 随机链表复制 | 解释 Bradley–Terry |
| 16 | DPO 推导 | 闭卷写 DPO loss | 94 二叉树中序遍历；104 最大深度 | 讲清 reference 与 beta |
| 17 | DPO 数据、长度与退化 | 做 chosen/rejected margin 实验 | 226 翻转二叉树；101 对称二叉树 | 回答“两者 logp 都降” |
| 18 | GRPO 数据流与公式 | 写 group advantage + mask | 102 层序遍历；543 二叉树直径 | 分清四种 policy |
| 19 | 同分组、std、长度偏置 | 构造 3 个失败 batch | 98 验证 BST；230 BST 第 K 小元素 | 从指标定位无梯度 |
| 20 | DAPO、GSPO、RLVR | 比较 token/sequence reduction | 199 右视图；236 最近公共祖先 | 每种方法只讲“问题→改法” |
| 21 | 第三周复盘 | 闭卷写 PPO/DPO/GRPO | 200 岛屿数量；994 腐烂的橘子 | 题库 A～E ≥ 75/93 分 |
| 22 | Agent MDP、轨迹与 mask | 设计检索 Agent schema | 207 课程表；208 Trie | 解释 tool response loss mask |
| 23 | Agent reward 与信用分配 | 写 outcome/process/cost verifier | 46 全排列；78 子集 | 比较 4 种归因方法 |
| 24 | 异步 rollout、policy lag | 模拟陈旧样本 ratio | 39 组合总和；22 括号生成 | 讲清吞吐与偏差交换 |
| 25 | TRL/verl/slime/OpenRLHF | 用一个框架做 dry-run 或读数据流 | 79 单词搜索；131 分割回文串 | 能画所选框架 worker 图 |
| 26 | 小模型 RL 项目：数据与基线 | 数据去重、SFT baseline、verifier | 70 爬楼梯；198 打家劫舍 | baseline 与隐藏测试可复现 |
| 27 | 小模型 RL 项目：训练 | rollout、GRPO、关键曲线 | 322 零钱兑换；300 最长递增子序列 | 能重放任一失败轨迹 |
| 28 | 项目消融与失败复盘 | std/长度或 reward 两个消融 | 1143 最长公共子序列；72 编辑距离 | 写 1 页实验结论 |
| 29 | 定向公司面经与项目表达 | 百度/字节/阿里/目标公司模拟 | 215 数组第 K 大；347 前 K 个高频元素 | 3 分钟讲项目 + 追问 |
| 30 | 全真模拟与查漏补缺 | 90 分钟技术面 + 最终 README | 146 LRU；124 二叉树最大路径和 | 题库 ≥202/237；P0 无 0 分 |

## 3. LeetCode 的正确复习方式

60 道题不是为了打卡数量。每题记录：

```text
题号 / 模式 / 首次耗时 / 是否独立 AC
时间与空间复杂度
第一个错误假设
边界用例
第 2、7、14 天重写结果
```

复习优先级：

1. 完全不会或思路错误；
2. 能说但写不完整；
3. 边界/复杂度出错；
4. 已稳定 15 分钟内 AC。

同一道题连续两次稳定写对后降频。困难题 `25 K 个一组翻转链表` 和 `124 最大路径和` 不必追求一次闭卷 AC，但必须能解释递归状态和边界。

## 4. 每周里程碑

### 第 1 周：经典 RL 不再是黑箱

- 能从 MDP 讲到 Q-learning；
- discounted return、TD target 闭卷通过；
- 有一份 GridWorld 对比曲线；
- 完成 14 道 LeetCode。

### 第 2 周：打通 PPO

- 90 秒讲清 RLHF 数据流；
- 能手算 PPO clip 和 GAE；
- 分清 old/reference/rollout/current；
- 完成 28 道累计 LeetCode。

### 第 3 周：覆盖当前面经主线

- 闭卷写 DPO 与 GRPO；
- 能解释全同分、DAPO、GSPO、RLVR；
- 前 31 张面试卡达到 2 分以上；
- 完成 42 道累计 LeetCode。

### 第 4 周：有可展示的闭环

- 小模型项目有 baseline、训练、独立评测和消融；
- 能设计 Agentic RL 系统并讨论 policy lag；
- 79 张卡总分不低于 202，P0 卡（含增量 46、49、51、52、55、57、76、77 及按岗位的 64/68/70/74/75）无 0 分；
- 完成 60 道累计 LeetCode，并复写高频错题。

## 5. 项目最小可交付标准

月底不是“看完论文”，而是仓库里至少有：

```text
rl-project/
├── README.md
├── configs/
├── data/README.md
├── src/
│   ├── rollout.py
│   ├── reward.py
│   ├── loss.py
│   └── evaluate.py
├── tests/
├── results/
│   ├── curves.png
│   └── failure_cases.md
└── report.md
```

README 必须回答：任务如何建模、为什么选算法、reward 是否可被钻空子、哪些 token 算 loss、训练异常怎么查、独立评测提升多少、失败在哪里。

## 6. 每周模拟面试模板

每次 45～60 分钟：

1. 5 分钟自我介绍与项目；
2. 15 分钟基础公式；
3. 10 分钟方法对比与新论文；
4. 10 分钟系统/排障场景；
5. 15 分钟代码；
6. 复盘每题 0～3 分，第二天只补最低分项。

第 30 天全真模拟改为 90 分钟，并强制包含：GAE 数值题、PPO clip、DPO/GRPO 手写、Agent 奖励设计、训练曲线排障和一题中等 LeetCode。

## 7. 时间不足时的压缩版

每天只有 2 小时时：

- LeetCode 改为 1 题，优先链表、树、图、DP、高频手写；
- 经典 RL 保留 MDP、value/advantage、policy gradient、GAE；
- LLM RL 保留 PPO、DPO、GRPO、DAPO/GSPO；
- Agent 保留轨迹、mask、reward、credit、policy lag；
- 项目只做一个可验证任务，但必须有测试和失败分析；
- 扩展论文只读摘要、方法图和实验局限。

不要删除口述与手写环节。被动阅读是最容易制造“好像会了”的部分。
---

原始讲义与可运行材料：[GitHub 源文件](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/AI%E7%AE%97%E6%B3%95/%E5%BC%BA%E5%8C%96%E5%AD%A6%E4%B9%A0/11_30%E5%A4%A9%E5%AD%A6%E4%B9%A0%E4%B8%8E%E9%A1%B9%E7%9B%AE%E8%AE%A1%E5%88%92.md)。
