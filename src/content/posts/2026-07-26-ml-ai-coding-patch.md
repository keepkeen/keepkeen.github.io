---
title: "ML / AI Coding 算法岗笔试补丁"
description: "对应 27 届实习季的 AI Coding 题型：JSON 契约、数值稳定、Viterbi、Attention、IRLS 与 One-Class 流水线的限时可运行实现要点。"
date: 2026-07-26
tags:
  - ai
  - algorithms
  - interview
featured: false
draft: false
lang: zh-CN
series: llm-algo-job-hunt
seriesOrder: 11
---

> 本文是个人求职工作区文档的发布版，最后核验 2026-07-26。文档源文件与可运行模板、测试托管在 GitHub 仓库 [llm-algo-job-notes](https://github.com/keepkeen/llm-algo-job-notes)；文中所有面经均为公开帖子的转述，证据分级见正文说明。

> 对应 27 届实习季公开题型：阿里 AI Coding、美团 One-Class SVM/IRLS、蚂蚁 Viterbi、携程门控 Top-k Attention。它们多数没有精确 LeetCode 映射，考的是接口、矩阵/概率状态、数值稳定和隐藏测试。

可执行零依赖实现：[ml_ai_coding_exam.py](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/AI%E7%AE%97%E6%B3%95/templates/ml_ai_coding_exam.py)；自动测试：[test_ml_ai_coding_exam.py](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/AI%E7%AE%97%E6%B3%95/tests/test_ml_ai_coding_exam.py)。

## 1. 五类题面信号

| 题面 | 核心模式 | 必须先确认 |
|---|---|---|
| 自然语言业务规则，要求 AI/Prompt 实作 | schema → validator → pure solve → serializer | 输入字段、默认值、错误协议、输出是否只允许 JSON |
| 训练正常样本并检测异常 | 标准化 + One-Class 模型 + 验证选参 | 分数方向、阈值、训练/验证泄漏、并列参数规则 |
| 手写 Logistic Regression/Newton/IRLS | sigmoid + 梯度 + Hessian + 线性求解 | bias 是否正则、label 编码、停止条件、奇异矩阵 |
| HMM、状态序列、最可能路径 | 对数域 Viterbi + 回溯指针 | `pi/A/B` 方向、观测编号、零概率、并列路径 |
| Q/K/V、Top-k、门控、归一化 | 缩放点积 Attention | shape、scale、mask、Top-k 并列、门控位置 |

## 2. 统一机考提交协议

```text
stdin 单个 JSON
→ parse：只解析，不做业务计算
→ validate：类型、必填字段、shape、范围
→ solve：纯函数，不读全局、不打印
→ serialize：只输出一个 JSON，禁止 debug 日志
```

建议函数签名：

```python
def dispatch(request: dict) -> dict:
    ...

def main():
    request = json.loads(sys.stdin.read())
    print(json.dumps(dispatch(request), separators=(",", ":")))
```

仓库模板已实现 `sigmoid`、`viterbi`、`attention` 三种 JSON task。真实考试字段不同，应保留四阶段结构，只改 schema 和算法参数。

## 3. 数值稳定速查

| 问题 | 错误写法 | 稳定做法 |
|---|---|---|
| sigmoid | `1/(1+exp(-x))` 对大负数溢出 | `x≥0` 与 `x<0` 分支计算 |
| softmax | 直接 `exp(logit)` | 每行先减最大值 |
| log 概率累乘 | 连乘后下溢为 0 | 全程加 `log(p)`，`p=0→-inf` |
| logsumexp | `log(sum(exp(x)))` | `m + log(sum(exp(x-m)))` |
| Newton/IRLS | `inv(H) @ g` | 解线性方程 `H·step=g`，必要时 L2 正则 |
| 标准化 | 全数据 fit scaler | 只在训练集 fit，再 apply 到验证/测试 |
| 零方差列 | 除以 0 | 明确保留为 0 或按题面删除 |

每次矩阵计算后检查：shape 是否正确、结果是否 finite、概率行和是否接近 1。

## 4. Viterbi 模式

状态：`dp[t][s]` 是处理到第 `t` 个观测、最终处于状态 `s` 的最大对数概率。

转移：

```text
dp[t][s] = log B[s][obs[t]]
           + max_p(dp[t-1][p] + log A[p][s])
parent[t][s] = 取得最大值的 p
```

最后从最佳终态沿 `parent` 逆序回溯。并列时固定选较小状态编号，才能让隐藏测试稳定。

必测：单状态、单观测、零转移、零发射、不可达序列、空观测、非法 symbol。

## 5. 门控 Top-k Attention 模式

对 `Q[Lq,d]`、`K[Lk,d]`、`V[Lk,dv]`：

1. `score[i][j] = dot(Q[i], K[j]) / sqrt(d)`。
2. 每行选 Top-k；分数并列按 key 下标。
3. 仅对选中项做 stable softmax。
4. 对 V 加权求和。
5. 按题面在输出或权重处应用 gate，不能自行假定。

不要因为题面出现 Top-k 就把整题判成堆题：Top-k 只是 Attention 流水线中的技术部件。

必测：`Lq≠Lk`、`dv≠d`、`k=1/Lk`、并列分数、极大 logits、非法 k、gate 为 0。

## 6. IRLS / Newton Logistic Regression

负对数似然的梯度和 Hessian：

```text
p = sigmoid(Xw)
g = Xᵀ(p-y) + λw
H = Xᵀ diag(p(1-p)) X + λI
solve H·step = g
w ← w - step
```

工程规则：

- 截距列是否正则化必须按题面；仓库模板默认不正则 bias。
- 不显式求逆；奇异 Hessian 应增加正则或明确失败。
- 返回 `converged` 和迭代次数，不要悄悄假装收敛。
- 完全可分数据会让无正则权重发散，测试时应加 L2。

必测：共线特征、单类别、完全可分、`max_iter=0`、非法 label、极端特征值。

## 7. One-Class SVM / 异常检测流水线

这类题依赖题目允许的库和版本，本仓库不新增 sklearn 生产依赖；训练时掌握流水线而不是背构造器参数：

```text
仅正常训练样本 X_train_normal
→ fit scaler(X_train_normal)
→ transform train/validation
→ 遍历 gamma/nu 等参数
→ 在验证集按题目指标选参
→ 固定并列规则
→ 用全部允许的正常样本重新 fit scaler 和模型
→ 对测试集输出规定方向的 score/label
```

常见致命错误：在验证/测试上重新 fit scaler；把 `decision_function` 正负方向写反；参数并列时依赖字典遍历；不固定随机种子。

## 8. AI Coding 的 60–90 分钟节奏

1. 0–10 分钟：把自然语言规则改写成 schema、纯函数签名和 3 个例子。
2. 10–20 分钟：只完成 parse/validate/serialize，确认 stdin/stdout 契约。
3. 20–55 分钟：先写正确的直接实现，再优化热点。
4. 55–70 分钟：补空集合、重复、Unicode、边界值、并列和非法输入。
5. 70–90 分钟：检查 stdout 无日志、结果确定、复杂度满足上限。

## 9. 验收线

- `stable_sigmoid(±1000)` 不溢出，softmax 行和约为 1。
- Viterbi 能与小状态暴力枚举对拍。
- Attention 明确所有 shape，Top-k 并列结果可复现。
- IRLS 在有正则的小二分类数据上收敛，权重全部 finite。
- CLI 重复运行输出一致，且 stdout 只有一个可解析 JSON。
- One-Class 流水线能解释每一步数据来自哪里，不发生训练/验证泄漏。

运行：

```bash
python3 -m unittest discover -s '笔试/AI算法/tests' -v
```
