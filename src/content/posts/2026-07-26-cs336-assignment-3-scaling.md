---
title: "CS336 Assignment 3：用 IsoFLOPs 外推计算最优模型"
description: "基于 9 组合成 IsoFLOPs profile，复现 Chinchilla 风格的计算最优模型与数据规模拟合，并实现 completed-run 过滤、loss 外推和 48 B200-hour 配置生成管线。"
date: 2026-07-26
tags:
  - cs336
  - llm
  - scaling-laws
  - engineering
lang: zh-CN
featured: true
draft: false
series: stanford-cs336
seriesOrder: 3
---

> 本文对应 **Stanford CS336 Assignment 3: Scaling**。我不是 Stanford 在校生，也没有访问课程训练 API 或 Gradescope；Part 2 的数字来自仓库内合成数据，Part 3 只用离线 fixture 验证分析链路，不是 48 B200-hour leaderboard 结果。课程 handout 明确限制正式作业中的 AI 使用，因此本文只是一份独立、公开、可复现的学习记录。

## 快速入口

- [独立公共代码仓库][repo]
- [官方 Assignment 3 handout][handout]
- [完整中文实现讲解][guide]
- [Scaling-law 分析代码][analysis]
- [IsoFLOPs 端到端脚本][isoflops-script]
- [离线/API 配置估计脚本][estimate-script]
- [测试代码][tests]
- [拟合结果 JSON][summary-json]

## 结果先行

我从 9 组固定 compute budget 的合成训练结果中，各选出 final loss 最低的 run，再拟合两条幂律：

$$
N_{\mathrm{opt}}(C)=1.1634106364\,C^{0.4686826677}
$$

$$
D_{\mathrm{opt}}(C)=0.1432569563\,C^{0.5313173323}
$$

其中 $C$ 是训练 FLOPs，$N$ 是非 embedding 参数量，$D$ 是训练 token 数。拟合结果为：

| 指标 | 数值 |
|---|---:|
| 模型规模拟合 log-$R^2$ | 0.9787 |
| 数据规模拟合 log-$R^2$ | 0.9834 |
| $10^{23}$ FLOPs 参数量 | 70.054B |
| $10^{23}$ FLOPs tokens | 237.911B |
| $10^{24}$ FLOPs 参数量 | 206.119B |
| $10^{24}$ FLOPs tokens | 808.596B |

![IsoFLOPs 模型规模拟合][model-figure]

![IsoFLOPs 数据规模拟合][data-figure]

这两个 $R^2$ 很高，但它们只说明观测区间内的 log-log 关系贴合得好。最大的观测预算是 $3\times10^{21}$ FLOPs，$10^{24}$ 已经是跨越两个多数量级的强外推，不能把漂亮曲线当成真实大规模训练的精确保证。

## 1. 作业真正要解决什么

Scaling law 讨论的不是“模型越大越好”，而是一个受预算约束的分配问题：

- 参数太少，模型容量不足；
- 参数太多，每一步训练太贵，固定 compute 下又走不了足够多的优化步骤；
- token 太少，模型欠训练；
- token 太多，就必须牺牲模型规模。

Assignment 3 把这个问题拆成两部分：

1. 在合成数据上复现 Chinchilla 的 IsoFLOPs 方法；
2. 用不超过 12 B200-hour 的小实验，预测 48 B200-hour 最终训练的模型规模、token 数、超参数和 validation loss。

第二部分需要 Stanford 托管训练 API 才能产生真实结果。我的目标不是伪造一个 leaderboard 数字，而是把**数据导入、实验过滤、拟合、配置生成和安全提交**这条工程链路做完整。

## 2. IsoFLOPs 的数学核心

训练 dense Transformer 的常用近似是：

$$
C\approx 6ND
$$

固定 compute budget $C$ 后，只要选择模型大小 $N$，对应的数据量就是：

$$
D=\frac{C}{6N}
$$

因此每个 IsoFLOPs profile 的处理流程很直接：

```text
固定 C 的多条训练 run
  -> 选择 final_loss 最低的 run
  -> 得到 N_opt(C)
  -> 用 D = C / (6N) 计算 D_opt(C)
  -> 在 log-log 空间拟合幂律
  -> 外推到目标 compute
```

实现入口在 [`cs336_scaling/analysis/isoflops.py`][isoflops-code]。代码先按 `compute_budget` 分组，然后对每组执行最低 loss 选择。这里没有额外拟合每条 profile 的二次曲线，和 handout 的简化建议一致。

## 3. 为什么在 log-log 空间拟合

若假设：

$$
y=ax^b
$$

取对数后变为：

$$
\log y=\log a+b\log x
$$

于是幂律拟合可以转成普通线性回归。我的 [`fit_power_law`][power-law-code] 完全使用 Python 标准库，显式计算斜率、截距、log-RMSE 和 log-$R^2$，避免把关键数学藏在黑盒优化器里。

同一个模块还提供了一个 loss 外推模型：

$$
L(C)=E+AC^b
$$

实现会扫描不可约损失 $E$，对 $L-E$ 做 log-log 拟合，再选择原始 loss 空间中 RMSE 最小的候选。这个模型是我的透明 heuristic，不是 Stanford 指定方法。

## 4. 从原始数据到两张曲线

仓库中的 [`data/isoflops_curves.json`][isoflops-data] 给出了多组模型大小、compute budget 和 final loss。选出的 9 个最优点覆盖：

| Compute FLOPs | 最优参数量 | 推导 tokens | Final loss |
|---:|---:|---:|---:|
| $6.0\times10^{18}$ | 0.762B | 1.312B | 5.8999 |
| $1.0\times10^{19}$ | 0.807B | 2.066B | 5.6179 |
| $3.0\times10^{19}$ | 1.537B | 3.253B | 5.1072 |
| $6.0\times10^{19}$ | 1.952B | 5.123B | 4.8306 |
| $1.0\times10^{20}$ | 3.253B | 5.123B | 4.6529 |
| $3.0\times10^{20}$ | 5.904B | 8.469B | 4.3112 |
| $6.0\times10^{20}$ | 6.971B | 14.345B | 4.1212 |
| $1.0\times10^{21}$ | 6.859B | 24.298B | 4.0028 |
| $3.0\times10^{21}$ | 12.149B | 41.156B | 3.7732 |

端到端脚本会同时：

- 读取原始 JSON；
- 选择 9 个最优点；
- 拟合参数、数据和 loss 曲线；
- 输出 $10^{23}$ 与 $10^{24}$ FLOPs 的预测；
- 写出两张 SVG 和结构化 JSON。

```bash
uv run python scripts/chinchilla_isoflops.py --output-dir docs/figures
```

这里专门修正了一个容易忽略的转写错误：PDF 中的 $10^{24}$ 在纯文本抽取时可能变成 `1024`。脚本、测试和文档现在都使用正确的 $10^{24}$，不会再生成“1024 FLOPs 训练几十个参数”的无意义结果。

## 5. 外推为什么比拟合危险

Scaling law 最大的风险不是“线没拟合直”，而是实验设计没有覆盖目标附近的行为。

这组数据的观测区间是 $6\times10^{18}$ 到 $3\times10^{21}$ FLOPs，而目标最高到 $10^{24}$。即使 log-$R^2$ 接近 0.98，仍然存在这些失效来源：

- 架构、优化器或训练精度发生变化；
- 高质量数据不足，token 不再同质；
- 小模型和大模型的最优 learning rate 不按同一规则缩放；
- 硬件利用率、通信和 kernel 效率改变 wall-clock 与理论 FLOPs 的关系；
- validation loss 最优不等于 reasoning、coding 等下游能力最优。

所以更严谨的报告应加入 bootstrap、leave-one-budget-out 或 holdout compute profile，而不只给一条回归线。

## 6. Part 3：把实验结果变成最终配置

真实 Part 3 的分析链路是：

```text
Stanford API / 本地 JSON
  -> 只保留 completed run
  -> 读取 val_losses[-1]
  -> 计算 C = 6ND
  -> 按相近 compute 分组
  -> 每组选择最低 loss
  -> 拟合 N_opt(C)、D_opt(C)、L(C)
  -> 生成合法 TrainingConfig
```

### Completed-only 过滤

[`completed_runs_from_api_payload`][experiments-code] 明确忽略 queued、running 和 failed run，只读取 completed 状态的最后一个 validation loss。这样不会把超时任务的 partial loss 当成完整训练结果。

### 配置生成

配置模块使用 handout 给出的非 embedding 参数近似：

$$
N\approx 12\,n_{\mathrm{layer}}d_{\mathrm{model}}^2
$$

[`select_architecture_for_params`][config-code] 会搜索 layer 数、hidden size 和 head dimension 的合法组合，同时满足：

- `hidden_size = num_heads × head_dim`；
- RoPE head dimension 为偶数；
- token 数可被 batch、sequence length 和 evaluation cadence 整除；
- 总 token 不超过 API 上限。

这些结构约束是硬条件；learning rate、depth-width tradeoff 等仍然只是保守 heuristic，真实 final run 应由小规模实验继续校准。

### 默认不提交

最终估计脚本只有显式传入 `--submit` 才会调用 `/final_submission`：

```bash
uv run python scripts/estimate_final_config.py \
  --input results.json \
  --target-flops 9.6e18 \
  --output-json final_estimate.json
```

这让离线分析、结果审阅和真实提交之间有清晰边界，不会因为一次脚本试跑覆盖远端答案。

## 7. 离线 fixture 能证明什么

仓库提供了 completed-run fixture，用于证明数据管线和 schema 可以闭环。示例输出为：

| 项目 | 数值 |
|---|---:|
| 目标 compute | $9.6\times10^{18}$ FLOPs |
| 预测非 embedding 参数 | 557.710M |
| 预测训练 tokens | 2.869B |
| 量化后训练 tokens | 2,868,903,936 |
| 预测 validation loss | 3.20724 |
| 生成架构 | 35 layers / 1152 hidden / 18 heads |

这些数字来自合成 fixture，只说明 pipeline 可以运行、输出可以通过 `TrainingConfig` 校验。它们不代表真实 B200 吞吐，不是 Stanford validation loss，也不是 48 B200-hour 最优答案。

## 8. 当前验证状态

独立公共仓库从官方 MIT starter 的干净快照构建，并在发布前重新执行：

```bash
uv sync --extra server
uv run pytest -q tests/test_analysis.py tests/test_config.py
uv run ruff check cs336_scaling scripts tests
uv run ty check \
  cs336_scaling/analysis \
  scripts/chinchilla_isoflops.py \
  scripts/estimate_final_config.py \
  tests/test_analysis.py
```

结果：

- 目标测试：`12 passed`；
- Ruff：`All checks passed!`；
- ty：`All checks passed!`；
- IsoFLOPs CLI：重新生成两张 SVG 与 JSON，$10^{23}/10^{24}$ 结果与文档一致。

数据库支持的全量 API/scheduler suite 需要本地 PostgreSQL，本次公开发布没有把它写成“刚刚全量复测通过”。

## 9. 提交与非学生限制

正式学生需要提交 `writeup.pdf`、`code.zip`，并通过 API 提交最终配置和预测 loss。这里有三个现实边界：

1. 我没有 Stanford student ID、VPN 或 Gradescope 权限；
2. 没有真实 completed API experiments，不能验证 leaderboard 表现；
3. 公开仓库默认不会执行任何远端 final submission。

因此这个实现的价值是可复现的数学与工程框架，而不是一个无法核实的分数。

## 10. 2025–2026：Scaling law 正在扩展什么

这份作业建立的是 dense pretraining 的最小模型：参数量、token 数、compute 和 loss。近两年的研究正在把更多变量纳入同一个预算分配问题。

### 直接拟合 loss surface

[Farseer][farseer] 不只拟合每个 compute profile 的最优点，而是建模完整的 $L(N,D)$ surface。这种方法能保留更多小实验信息，也更适合报告外推误差。

### 超参数也会 scaling

[Predictable Scale][step-law] 研究 learning rate、batch size 随模型和数据规模如何变化。它提醒我们：固定 AdamW recipe 再外推 $N,D$，隐含了一个很强的控制变量假设。

### Token 不是同质资源

[Scaling Data-Constrained Language Models][data-constrained] 和数据混合研究表明，高质量数据受限、重复训练或域配比变化时，单纯增加 token 计数并不等价于增加有效数据。

### Precision 与 MoE 会打破简单的 `6ND`

[Scaling Laws for Precision][precision] 把训练/推理精度纳入 scaling；MoE 则把 total parameters、active parameters 和每 token FLOPs 解耦。真实 B200-hour 还会受到 kernel、通信和 MFU 的影响。

### 最优规模依赖评估目标

[Compute Optimal Scaling of Skills][skills] 指出 knowledge 与 reasoning 等能力可能拥有不同的 compute-optimal 分配。Validation loss 最优，只能说明模型对该验证分布最优。

## 结语

Scaling law 最有价值的部分，不是给出一个看起来精确的巨大参数量，而是迫使我们回答：

- 哪些变量被固定了？
- 小实验覆盖了多大的 compute 区间？
- 哪些点是真实观测，哪些点是外推？
- 数据、优化器、精度和硬件变化后，原公式还成立吗？

只要这些边界写清楚，小规模实验就能成为大规模决策的依据；反过来，再高的 $R^2$ 也可能只是一个漂亮但脆弱的数字。

[repo]: https://github.com/keepkeen/cs336-assignment3-scaling
[handout]: https://github.com/keepkeen/cs336-assignment3-scaling/blob/main/cs336_assignment3_scaling.pdf
[guide]: https://github.com/keepkeen/cs336-assignment3-scaling/blob/main/docs/assignment3_scaling_detailed_guide_zh.md
[analysis]: https://github.com/keepkeen/cs336-assignment3-scaling/tree/main/cs336_scaling/analysis
[isoflops-script]: https://github.com/keepkeen/cs336-assignment3-scaling/blob/main/scripts/chinchilla_isoflops.py
[estimate-script]: https://github.com/keepkeen/cs336-assignment3-scaling/blob/main/scripts/estimate_final_config.py
[tests]: https://github.com/keepkeen/cs336-assignment3-scaling/blob/main/tests/test_analysis.py
[summary-json]: https://github.com/keepkeen/cs336-assignment3-scaling/blob/main/docs/figures/isoflops_summary.json
[isoflops-code]: https://github.com/keepkeen/cs336-assignment3-scaling/blob/main/cs336_scaling/analysis/isoflops.py
[power-law-code]: https://github.com/keepkeen/cs336-assignment3-scaling/blob/main/cs336_scaling/analysis/power_law.py
[experiments-code]: https://github.com/keepkeen/cs336-assignment3-scaling/blob/main/cs336_scaling/analysis/experiments.py
[config-code]: https://github.com/keepkeen/cs336-assignment3-scaling/blob/main/cs336_scaling/analysis/configs.py
[isoflops-data]: https://github.com/keepkeen/cs336-assignment3-scaling/blob/main/data/isoflops_curves.json
[model-figure]: https://raw.githubusercontent.com/keepkeen/cs336-assignment3-scaling/main/docs/figures/isoflops_model_size.svg
[data-figure]: https://raw.githubusercontent.com/keepkeen/cs336-assignment3-scaling/main/docs/figures/isoflops_dataset_size.svg
[farseer]: https://farseer-scaling-law.github.io/
[step-law]: https://step-law.github.io/
[data-constrained]: https://jmlr.org/papers/v26/24-1000.html
[precision]: https://proceedings.iclr.cc/paper_files/paper/2025/hash/b2cac94f82928a85055987d9fd44753f-Abstract-Conference.html
[skills]: https://aclanthology.org/2025.findings-acl.688/
