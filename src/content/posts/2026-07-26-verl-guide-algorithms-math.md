---
title: "verl 算法与数学实现：PPO、GRPO、RLOO 与 DAPO"
description: "对照源码解释 advantage estimator、policy loss、KL、长度偏置及常见算法组合。"
date: 2026-07-26
tags:
  - verl
  - llm-rl
  - ppo
  - grpo
lang: zh-CN
featured: false
draft: false
series: verl-interview-guide
seriesOrder: 5
---

## 先理解“配置组合”，再记算法名

verl 把算法拆成四个正交维度：

1. `adv_estimator`：怎样从 reward 得到 advantage/return。
2. `policy_loss.loss_mode`：怎样用 advantage、old/current log-prob 更新 actor。
3. KL：放在 reward 还是 loss，系数固定还是自适应。
4. 采样与过滤：每个 prompt 生成几条、是否过滤无信息组、怎样聚合 token loss。

因此很多算法没有单独的 Trainer 类。[`core_algos.py`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/trainer/ppo/core_algos.py) 用 registry 注册 advantage estimator 和 policy loss，Trainer 只选择并调用它们。

## PPO + GAE

典型组成：GAE advantage、critic、clipped policy loss、clipped value loss、可选 entropy/KL。优点是通用且能做 token-level credit assignment；缺点是多一个价值模型及优化器，训练资源和稳定性调参更复杂。

GAE 先用未白化的递推量得到 `returns = raw_advantages + values`，随后只对 actor 使用的 advantage 做 masked whitening；critic target 不使用白化 advantage。内部 observation token 的 mask 为 0 时会跳过该位置的 TD 更新，但递推状态跨过它继续传递。critic loss 通常也裁剪 value 更新，防止价值估计突变。

源码：[`verl/trainer/ppo/core_algos.py:215-263`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/trainer/ppo/core_algos.py#L215-L263)；value loss：[`verl/workers/utils/losses.py`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/workers/utils/losses.py)。

## GRPO 与 Dr.GRPO

每条回答先把 token reward 汇总成序列 reward，再按 `uid` 分组：减均值，默认除标准差，最后广播回 response token。GRPO 的 baseline 来自同 prompt 的其他候选总体，而不是 critic。

配置关注：

- `actor_rollout_ref.rollout.n` 必须提供足够组内样本。
- `algorithm.adv_estimator=grpo`。
- `algorithm.norm_adv_by_std_in_grpo` 控制是否除标准差。
- critic 通常自动关闭。
- sequence/token loss aggregation 会影响长回答权重。

Dr.GRPO 常被概括为取消组内标准差归一，但完整 recipe 可能还有其他选择；面试中不要把一个 flag 等同于整篇算法。

## RLOO

RLOO 对每条回答使用“同组其他回答的均值”作为 baseline：

$$
A_i=R_i-\frac{\sum_{j\ne i}R_j}{n-1}
$$

它和“GRPO 不除标准差”不同：后者减完整组均值，RLOO 明确排除自身。配置必须保证每组至少 2 条；当前实现遇到单样本不会报错，而会静默退化为原始 reward。实现：[`verl/trainer/ppo/core_algos.py:587-636`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/trainer/ppo/core_algos.py#L587-L636)。

## REINFORCE++

不依赖 critic，从序列末端反向计算 reward-to-go，并在有效 response token 上白化。baseline 版本还先做 prompt 组均值基线。它减少 value model 成本，但通常更依赖大 batch、归一化和稳定 reward。

实现：[`verl/trainer/ppo/core_algos.py:533-584,693-729`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/trainer/ppo/core_algos.py#L533-L729)。

## ReMax

对每个 prompt 除采样回答外，额外生成一条 greedy 回答作为 baseline。采样轨迹 reward-to-go 减去 greedy reward 得到 advantage。它的 baseline 既不是 critic，也不是组均值。

代价是额外 greedy rollout；好处是 baseline 与当前 prompt/策略紧密相关。生成逻辑参考 V0 [`verl/trainer/ppo/ray_trainer.py:1465-1510`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/trainer/ppo/ray_trainer.py#L1465-L1510)，advantage 见 [`core_algos.py:732-765`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/trainer/ppo/core_algos.py#L732-L765)。

版本边界：公共 estimator 强制读取 `reward_baselines`，而完整 greedy rollout 和该字段写入目前只在 V0 主循环出现；默认 V1 的 advantage 输入没有它。不能只设置 `algorithm.adv_estimator=remax`，必须确认 recipe 使用 V0，或目标版本已为 V1 增加 baseline 数据链路。

## DAPO

DAPO 更像一组建立在 GRPO/PPO 基础设施上的 recipe，而不是 `adv_estimator=dapo`：

- Clip-Higher：正负方向使用非对称裁剪，给正优势 token 更大上升空间。
- Dynamic Sampling：过滤同题全对或全错等 advantage 无信息的组，再补充生成。
- Token-level policy loss：改变长短序列在 batch 中的权重。
- Overlong reward shaping：接近最大长度时逐渐惩罚，避免硬截断带来的不连续信号。

当前 V1 replay buffer 已包含 group filter 约束和 refill 逻辑，但过滤指标必须在 replay-buffer sampling 前可用：规则/流式 reward 可以；reward model 需启用独立 resource pool，普通 colocated RM 要到 sampling 后才计算，不能驱动 refill。原理参考 [`docs/algo/dapo.md`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/docs/algo/dapo.md)，V1 校验见 [`verl/trainer/ppo/v1/trainer_base.py:190-215`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/trainer/ppo/v1/trainer_base.py#L190-L215)。

## Policy loss 的关键细节

### Clip 与 dual clip

标准 clip 限制 ratio 在 `[1-eps, 1+eps]`。不对称 clip 可分别设置 lower/higher。dual clip 进一步限制负优势样本在极端 ratio 下的损失，降低异常更新。

### Loss aggregation

当前 `agg_loss` 有四种模式：

| 模式 | 分子/分母直觉 | 长度效应 |
|---|---|---|
| `token-mean` | 全局有效 token loss 总和 / 有效 token 数 | 每个 token 等权 |
| `seq-mean-token-sum` | 每序列 token sum 后对序列平均 | 长回答在单序列内贡献更大 |
| `seq-mean-token-mean` | 每序列先按 token 平均，再对序列平均 | 每条非空序列近似等权 |
| `seq-mean-token-sum-norm` | token sum 再除固定 `loss_scale_factor`/horizon，最后序列平均 | 用稳定尺度控制长度贡献 |

面试不要只说“都是取 mean”。对可变长 LLM，分母就是算法选择的一部分。

同一 advantage estimator 还可以与不同 policy loss 组合。除 vanilla PPO 外，当前 registry 还有 DPPO、GSPO、SAPO、GPG、clip/kl-cov、geo-mean、CISPO 和 bypass 等路径；算法名不能只由 `adv_estimator` 推断。

### Entropy

entropy bonus 鼓励探索，但过大可能阻止策略收敛；过小又可能快速坍缩。需要与采样温度区分：温度影响 rollout 数据分布，entropy loss 直接影响训练梯度。

## Reward、KL 与 advantage 的先后

常见顺序是：规则/RM score → 长度或格式 shaping → reward-side KL（若启用）→ estimator → actor loss。reward-side 使用 old/ref log-prob 的逐 token KL 估计量；loss-side 使用 current/ref log-prob，estimator 看不到该 loss 项。当前 `full` 词表 KL 分支未实现。

自适应 KL controller 根据观察到的 KL 相对 target 调整系数；fixed controller 保持常数。KL 过高表示策略离参考过快，过低也可能表示更新几乎没有发生。

## 常见故障的算法解释

| 现象 | 先检查 |
|---|---|
| reward 高但评测下降 | reward hacking、格式投机、训练/评测模板不一致 |
| GRPO advantage 大量为 0 | 同组 reward 无差异、reward 粒度太粗、分组错误 |
| clip fraction 长期很高 | 学习率/epoch 太大、old log-prob 不一致、样本过旧 |
| KL 突然增大 | 权重同步版本错、reference 不对、更新过猛 |
| 长回答越来越多 | loss 聚合、长度 reward、截断处理 |
| critic loss 爆炸 | value target 尺度、reward outlier、mask、warmup/学习率 |

## 选择算法的场景判断

- 有可靠逐步 reward、需要 credit assignment：PPO + GAE 更自然。
- 数学/代码有明确 outcome verifier，rollout 资源充足：GRPO/DAPO 常更简单。
- 不想维护 critic，但希望序列内 reward-to-go：REINFORCE++。
- 希望用当前策略确定性结果作 baseline：ReMax，但当前默认 V1 需先解决 greedy-baseline 数据链路。

不要只比较论文榜单；真正约束是 reward 形态、生成成本、显存、样本效率和可观测性。

## 扩展 estimator 导航

当前 enum 还包括 `GRPO_PASSK`、OPO、GPG、GDPO、向量化 GRPO/RLOO、optimal-token baseline 与 TIR optimal-token baseline 等。它们大致覆盖 pass@k/组基线、多维或长度相关 reward、token baseline 和等价向量化实现。本指南不逐篇复述；面试中应先从配置确认 estimator、policy loss、采样/过滤和 reward shaping 的完整组合，再判断它对应哪篇算法。
