---
title: "verl 算法与数学实现：PPO、GRPO、RLOO 与 DAPO"
description: "对照源码盘点全部 14 种 advantage estimator、12 种 policy loss、KL、长度偏置及常见算法组合。"
date: 2026-07-26
updatedDate: 2026-08-29
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

## 先理解"配置组合"，再记算法名

verl 把算法拆成四个正交维度：

1. `algorithm.adv_estimator`：怎样从 reward 得到 advantage/return。
2. `actor.policy_loss.loss_mode`：怎样用 advantage、old/current log-prob 更新 actor。
3. KL：放在 reward 还是 loss，系数固定还是自适应。
4. 采样与过滤：每个 prompt 生成几条、是否过滤无信息组、怎样聚合 token loss。

因此很多算法没有单独的 Trainer 类。[`verl/trainer/ppo/core_algos.py`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/trainer/ppo/core_algos.py) 用 `register_adv_est` 和 `register_policy_loss` 两个 registry 注册 estimator/loss，Trainer 只选择并调用它们。默认组合是 `adv_estimator=gae` + `loss_mode=vanilla`，最终应在 resolved Hydra config 中确认。

## 当前全部 14 种 advantage estimator

| estimator | 一句话原理 | 特殊输入 |
|---|---|---|
| `gae` | TD 残差反向递推 + λ 加权，advantage 白化 | 需要 `values`（critic） |
| `grpo` | 组内 (r−μ)/(σ+ε)，广播到 token | `uid` 分组 |
| `grpo_vectorized` | 同 GRPO，`as_torch_index`+`group_mean_std` 向量化 | 同上 |
| `rloo` | leave-one-out 均值 baseline | `uid`，组≥2 |
| `rloo_vectorized` | 同 RLOO，bincount 向量化 | 同上 |
| `reinforce_plus_plus` | 反向折扣 reward-to-go + 白化，无组概念 | `gamma` |
| `reinforce_plus_plus_baseline` | 先减组均值再白化 | `uid` |
| `remax` | return-to-go 减 greedy baseline | **`reward_baselines`** |
| `opo` | 组内按长度加权的最优 baseline：b=Σ(len·r)/Σlen | `uid` |
| `grpo_passk` | 组内只有最优样本非零：A=r_max−r_2nd | `uid`，组≥2 |
| `gpg` | 组中心化 × 修正系数 α=bsz/#{r≠0} | `uid` |
| `gdpo` | 多维 reward 各自组内归一再加权求和，最后整体白化 | `uid` + 多 reward 键 |
| `optimal_token_baseline` | token 级最优 baseline：B*_t=E[G_t W_t]/E[W_t]，权重来自累计策略统计 | `old_log_probs`、`sum_pi_squared` |
| `tir_optimal_token_baseline` | 多轮版 OTB，先按 mask 压紧有效 token 再算 | 同上 |

枚举、registry 与实现都在 [`verl/trainer/ppo/core_algos.py`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/trainer/ppo/core_algos.py)，直接搜 estimator 名或 `@register_adv_est` 比背行号更稳定。

面试不必逐个背；记住结构——"critic 系（GAE）/ 组相对系（GRPO 家族、RLOO、OPO）/ 无组白化系（REINFORCE++）/ 特殊 baseline 系（ReMax greedy、OTB token 级）"，再按需展开。

## PPO + GAE

典型组成：GAE advantage、critic、clipped policy loss、clipped value loss、可选 entropy/KL。优点是通用且能做 token-level credit assignment；缺点是多一个价值模型及优化器，训练资源和稳定性调参更复杂。

实现细节（`compute_gae_advantage_return`）：先用未白化的递推量得到 `returns = raw_advantages + values`，随后只对 actor 使用的 advantage 做 masked whitening；critic target 不使用白化 advantage。多轮场景中 observation token（mask=0）跳过该位置的 TD 更新，但 `nextvalues/lastgaelam` 递推状态跨过它继续传递。critic loss 通常也裁剪 value 更新，防止价值估计突变（[`verl/workers/utils/losses.py`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/workers/utils/losses.py)）。

## GRPO 与 Dr.GRPO

每条回答先把 token reward 汇总成序列 reward，再按 `uid` 分组：减均值，默认除标准差（`norm_adv_by_std_in_grpo=True`），最后广播回 response token。GRPO 的 baseline 来自同 prompt 的其他候选总体，而不是 critic。单样本组在循环实现中回退为 mean=0、std=1。

配置关注：

- `actor_rollout_ref.rollout.n` 必须提供足够组内样本。
- `algorithm.adv_estimator=grpo`。
- `algorithm.norm_adv_by_std_in_grpo=False` 即"去 std 版"（注释直接指向 Dr.GRPO 论文 arXiv:2503.20783）——std 归一会放大过易/过难题的信号（难度偏差）。
- critic 不需要（`need_critic` 仅在显式 `critic.enable` 或 GAE 时为真，见 [`verl/trainer/ppo/utils.py`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/trainer/ppo/utils.py)）。
- sequence/token loss aggregation 会影响长回答权重（见下文）。

Dr.GRPO 常被概括为"去 std + 固定分母"，完整 recipe 还涉及 loss 聚合选择；面试中不要把一个 flag 等同于整篇算法。

## RLOO 与向量化实现的语义差异（重要）

RLOO 对每条回答使用"同组其他回答的均值"作为 baseline：

$$
A_i=R_i-\frac{\sum_{j\ne i}R_j}{n-1}
$$

它和"GRPO 不除标准差"不同：后者减完整组均值，RLOO 明确排除自身。

**当前 main 上的已知不一致**（截至 `ea532913`）：循环版 `compute_rloo_outcome_advantage` 对单样本组跳过变换、**保留原始分数**；向量化版 `compute_rloo_vectorized_outcome_advantage` 尾部乘 `(c>1)`、把单样本组 advantage **清零**。两者语义相反——切换"等价"实现会静默改变优化目标。此外 `as_torch_index` 的整数快速路径不做稠密重编号，稀疏/负整数 uid 会导致向量化估计器崩溃或内存过量分配。这两处正是 PR #7150 修复的内容（见[第 15 章](/blog/verl-guide-pr-deep-dive/)），该 PR 截至 2026-08-29 仍在 review 中。

## REINFORCE++

不依赖 critic，`compute_reinforce_plus_plus_outcome_advantage` 从序列末端反向计算折扣 reward-to-go，并在有效 response token 上白化；baseline 版本先做 prompt 组均值基线。2026-08 的 #7300 修复了多轮场景：observation token（mask=0）处 `returns` 记 0，但 `running_return` 穿越传递不清零——否则 reward 无法穿过工具返回段传播到前面的动作 token。它减少 value model 成本，但通常更依赖大 batch、归一化和稳定 reward。

## ReMax

对每个 prompt 除采样回答外，额外生成一条 greedy 回答作为 baseline。采样轨迹 reward-to-go 减去 greedy reward 得到 advantage，实现符号是 `compute_remax_outcome_advantage`。它的 baseline 既不是 critic，也不是组均值。

版本边界：公共 estimator 强制读取 `reward_baselines`，而完整 greedy rollout 和该字段写入目前只在 V0 主循环出现；默认 V1 的 advantage 输入没有它。不能只设置 `algorithm.adv_estimator=remax`，必须确认 recipe 使用 V0，或目标版本已为 V1 增加 baseline 数据链路。

## DAPO

DAPO 更像一组建立在 GRPO/PPO 基础设施上的 recipe，而不是 `adv_estimator=dapo`：

- Clip-Higher：`clip_ratio_low/high` 非对称裁剪，给正优势 token 更大上升空间。
- Dynamic Sampling：过滤同题全对或全错等 advantage 无信息的组，再补充生成。
- Token-level policy loss：改变长短序列在 batch 中的权重。
- Overlong reward shaping：接近最大长度时逐渐惩罚，避免硬截断带来的不连续信号。

当前 V1 replay buffer 已包含 group filter 约束和 refill 逻辑。同步 DAPO 路径 evict `k` 组后可给 `2k` generation credits 过量补采；异步路径会对 stale/DAPO/failure 原因取并集，evict `k` 后 refill `k`，不能把 `2k` 泛化到所有 mode。过滤指标必须在 replay-buffer sampling 前可用：规则/流式 reward 可以；reward model 需启用独立 resource pool，普通 colocated RM 要到 sampling 后才计算，不能驱动 refill。原理参考 [`docs/algo/dapo.md`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/docs/algo/dapo.md)。

## Policy loss：当前全部 12 种 loss_mode

| loss_mode | 原理 | 来源 |
|---|---|---|
| `vanilla` | 标准 PPO clip + dual-clip（负优势极端 ratio 以 `clip_ratio_c`=3.0 兜底） | PPO / dual-clip |
| `gspo` | 序列级重要性比（token log-ratio 均值的 exp），整序列 clip | Qwen GSPO（arXiv:2507.18071） |
| `cispo` | 不裁 token 更新、改为裁 IS 权重本身（stop-grad），保留全 token 梯度 | MiniMax（arXiv:2506.13585） |
| `geo_mean` | GMPO：序列内 clipped log-ratio 的几何平均作 ratio | arXiv:2507.20673 |
| `dro` | −[logπ·A − (β/2)(logπ−logπ_old)²]，二次近端惩罚替代 clip；需 `dro_beta>0` | [`docs/algo/dro.md`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/docs/algo/dro.md)（#7245 新增） |
| `sapo` | 用 sigmoid 门控替代硬 clip，软化信任域边界 | arXiv:2511.20347 |
| `dppo_tv` / `dppo_kl` | 用总变差/二元 KL 距离构造有效 token 掩码 + TIS，重思 trust region | arXiv:2602.04879 |
| `clip_cov` / `kl_cov` | 按 advantage 与 log-prob 的协方差挑高相关 token，随机屏蔽或加 KL 正则，对抗熵坍缩 | 熵机制研究（arXiv:2505.22617） |
| `gpg` | 无 ratio 的极简 policy gradient：−logπ·A | GPG |
| `bypass_mode` | rollout correction bypass 路径：old=rollout，内部做 IS/RS 后分派 ppo_clip 或 reinforce | rollout correction |

同一 advantage estimator 可与不同 policy loss 组合；算法名不能只由 `adv_estimator` 推断。例如"GSPO"= `adv_estimator=grpo` + `loss_mode=gspo`。

**GSPO 的新版本边界**：`gspo` 的 ratio/clip 粒度仍是序列级，但当前实现不再把最终 loss 聚合硬编码为 `seq-mean-token-mean`，而是使用传入的 `loss_agg_mode`。这三层不要混淆：函数签名默认仍写 `seq-mean-token-mean`；全局 actor 配置默认是 `token-mean`；官方 GSPO example 又显式覆盖为 `seq-mean-token-mean`。所以“使用 GSPO loss”不自动等于“严格复现论文的序列等权聚合”，必须检查 resolved config。

### Clip 与 dual clip

标准 clip 限制 ratio 在 `[1-eps_low, 1+eps_high]`（默认都是 0.2，DAPO 式 Clip-Higher 就是拉大 high）。dual clip 进一步对负优势样本在极端 ratio 下的损失以 `clip_ratio_c`（默认 3.0）兜底，降低异常更新。

### Loss aggregation：现在是五种模式

`agg_loss`（[`verl/trainer/ppo/core_algos.py`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/trainer/ppo/core_algos.py)）在分布式下会传入 `global_batch_info`（dp_size、全局 token 数、全局 batch size、scale factor）保证对 DP 切分不变：

| 模式 | 分子/分母直觉 | 长度效应 |
|---|---|---|
| `token-mean`（默认） | 全局有效 token loss 总和 / 全局有效 token 数 | 每个 token 等权 |
| `token-sum`（2026-08 #7197 新增） | 全局 token loss 总和，不除 token 数 | 梯度尺度随 token 量增长，配合外部归一使用 |
| `seq-mean-token-sum` | 每序列 token sum 后对全局序列数平均 | 长回答在单序列内贡献更大 |
| `seq-mean-token-mean` | 每序列先按 token 平均，再对序列平均 | 每条非空序列近似等权 |
| `seq-mean-token-sum-norm` | token sum 再除固定 `loss_scale_factor`/horizon，最后序列平均 | 用稳定尺度控制长度贡献 |

面试不要只说"都是取 mean"。对可变长 LLM，分母就是算法选择的一部分（Dr.GRPO 的固定分母、DAPO 的 token 级等权都落在这一层）。

### Entropy

entropy bonus（`entropy_coeff`，默认 0）鼓励探索，但过大可能阻止策略收敛；过小又可能快速坍缩。需要与采样温度区分：温度影响 rollout 数据分布，entropy loss 直接影响训练梯度。clip_cov/kl_cov 这类 loss 也是对抗熵坍缩的手段（作用在协方差异常 token 上）。

## Reward、KL 与 advantage 的先后

常见顺序是：规则/RM score → 长度或格式 shaping → reward-side KL（若启用）→ estimator → actor loss。

两条 KL 路径：

1. reward-side（`algorithm.use_kl_in_reward`，默认 False）：`token_reward = token_score − β·k(old,ref)`，影响 advantage/return；
2. loss-side（`actor.use_kl_loss`）：actor objective 直接对 current/ref 的 KL 估计加权，estimator 看不到该项。

任一开启都需要 reference policy（`need_reference_policy` = `use_kl_in_reward or actor.use_kl_loss`，见 [`verl/trainer/ppo/utils.py`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/trainer/ppo/utils.py)）；两个同时开可能重复约束。

KL 估计量（[`verl/trainer/ppo/core_algos.py`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/trainer/ppo/core_algos.py) 的 `kl_penalty`）：`kl/k1`（log 差）、`abs`、`mse/k2`（0.5·平方）、`low_var_kl/k3`（exp(Δ)−Δ−1，低方差无偏，做了 clamp 防溢出）、带 `+` 后缀的直通梯度变体；`full`（完整词表 KL）**仍是 NotImplementedError**。

KL controller：`fixed`（常数 `kl_coef`，默认 0.001）与 `adaptive`（按观测 KL 相对 `target_kl` 比例调整，horizon 控制步长），实现亦在 [`verl/trainer/ppo/core_algos.py`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/trainer/ppo/core_algos.py)。

## 常见故障的算法解释

| 现象 | 先检查 |
|---|---|
| reward 高但评测下降 | reward hacking、格式投机、训练/评测模板不一致 |
| GRPO advantage 大量为 0 | 同组 reward 无差异、reward 粒度太粗、分组错误 |
| clip fraction 长期很高 | 学习率/epoch 太大、old log-prob 不一致、样本过旧、训推不一致 |
| KL 突然增大 | 权重同步版本错、reference 不对、更新过猛 |
| 长回答越来越多 | loss 聚合、长度 reward、截断处理（对照 Dr.GRPO 的两个偏差） |
| critic loss 爆炸 | value target 尺度、reward outlier、mask、warmup/学习率 |

## 选择算法的场景判断

- 有可靠逐步 reward、需要 credit assignment：PPO + GAE 更自然。
- 数学/代码有明确 outcome verifier，rollout 资源充足：GRPO/DAPO 常更简单。
- 不想维护 critic，但希望序列内 reward-to-go：REINFORCE++。
- 长 CoT/MoE 上 token 级 ratio 方差大：考虑 GSPO（序列级）或 CISPO（裁权重不裁梯度）。
- 多维 reward（正确性+格式+安全等）：GDPO 的按维归一。
- 希望用当前策略确定性结果作 baseline：ReMax，但当前默认 V1 需先解决 greedy-baseline 数据链路。

不要只比较论文榜单；真正约束是 reward 形态、生成成本、显存、样本效率和可观测性。
