---
title: "CS336 Assignment 5：从 GRPO 到 DPO 的 Alignment 实战"
description: "从 rollout、reward、group advantage 到 GRPO/GSPO，再到 packed SFT 与 DPO：结合公式、张量形状、数值例子和 18 个独立测试完整拆解 Assignment 5。"
date: 2026-07-26
updatedDate: 2026-08-13
tags:
  - cs336
  - alignment
  - ai
  - engineering
featured: true
draft: false
lang: zh-CN
series: stanford-cs336
seriesOrder: 5
---

> 这份作业的核心不是记住 GRPO、GSPO、DPO 三个缩写，而是把一条 response 从文本变成 token、log-probability、reward、advantage，最后变成一次数值正确的 optimizer step。任何一处 shift、mask 或分母错一位，训练仍然能运行，但优化的已经不是原来的目标。

我完成了 Stanford CS336 Spring 2026 Assignment 5 中可在本地验证的算法部分，包括：

- prompt/response tokenization 与 response mask
- token log-probability 与 entropy
- group reward、GRPO、Dr. GRPO、RFT、MaxRL
- on-policy 与 off-policy policy-gradient loss
- PPO/GRPO clipping 与 sequence-level GSPO
- microbatch gradient accumulation
- packed SFT dataset
- MMLU/GSM8K response parser
- per-instance DPO loss

为安全公开，我把原创实现整理成一个无历史的独立仓库，并重新编写了不依赖课程 handout、starter tests、数据集或模型权重的测试。本文讲的是这份公开实现实际做了什么，也会明确哪些课程实验没有运行。

## 代码入口

- [独立代码仓库](https://github.com/keepkeen/cs336-assignment5-alignment)
- [核心实现 `alignment.py`](https://github.com/keepkeen/cs336-assignment5-alignment/blob/main/src/cs336_alignment/alignment.py)
- [18 个独立回归测试](https://github.com/keepkeen/cs336-assignment5-alignment/blob/main/tests/test_alignment.py)
- [运行说明与实现边界](https://github.com/keepkeen/cs336-assignment5-alignment/blob/main/README.md)
- [归属与发布说明](https://github.com/keepkeen/cs336-assignment5-alignment/blob/main/NOTICE)
- [课程官方仓库](https://github.com/stanford-cs336/assignment5-alignment)

公开仓库不包含课程讲义、starter tests、课程 prompt、评测数据、模型资产、远程训练工具和提交脚本。

---

## 1. 先看全局：一批 rollout 如何变成一次更新

Assignment 5 可以先压缩成下面这条数据流：

```text
prompt
  │
  ├── policy 采样 G 条 response
  │
  └── ground truth
         │
         ▼
response text ── reward_fn ──> raw reward
     │                            │
     │                            └── group baseline / normalization
     │                                         │
     ▼                                         ▼
tokenize + shift                         sequence advantage
     │                                         │
     ├── input_ids                              │
     ├── labels                                 │
     └── response_mask                          │
              │                                 │
              └──────── model forward ──────────┘
                              │
                              ▼
                 per-token policy objective
                              │
                              ▼
               mask + loss normalization
                              │
                              ▼
                  backward / clip / step
```

这里有三个容易混淆的层级：

1. **token 层**：`input_ids`、`labels`、`log_probs`、`response_mask`。
2. **sequence 层**：一整条 response 共用一个 reward 和 advantage。
3. **group 层**：同一个 prompt 的 $G$ 条 response 放在一起计算 baseline 和 normalizer。

GRPO 的大部分实现错误，都来自把这三个层级混在一起。例如：

- 用 token 位置去索引 sequence advantage；
- 在 prompt token 上也计算 policy loss；
- 对整个 rollout batch 求 reward mean，而不是按 prompt group 求；
- microbatch 内重新计算分母，导致它与 full-batch objective 不等价。

### 实现结构

公开仓库故意保持很小：

```text
src/cs336_alignment/alignment.py
  ├── tokenize_prompt_and_output
  ├── get_response_log_probs
  ├── compute_rollout_rewards
  ├── compute_group_normalized_rewards
  ├── compute_policy_gradient_loss
  ├── aggregate_loss_across_microbatch
  ├── grpo_train_step
  ├── PackedSFTDataset
  ├── parse_mmlu_response / parse_gsm8k_response
  └── compute_per_instance_dpo_loss

tests/test_alignment.py
  └── 独立的数值、形状、梯度与边界测试
```

训练逻辑只依赖这些 primitive。理解每个 primitive 的输入输出，比从一个几百行训练脚本中追踪状态更可靠。

---

## 2. 符号与张量形状

后文统一使用以下符号：

| 符号 | 含义 |
|---|---|
| $N$ | rollout batch 中不同 prompt 的数量 |
| $G$ | 每个 prompt 采样的 response 数量，即 group size |
| $B=NG$ | rollout response 总数 |
| $T$ | padding 后、shift 后的 token 序列长度 |
| $V$ | vocabulary size |
| $x_i$ | 第 $i$ 个 prompt |
| $y_{i,j}$ | prompt $i$ 的第 $j$ 条 response |
| $r_{i,j}$ | 该 response 的 scalar reward |
| $A_{i,j}$ | group 处理后的 sequence-level advantage |
| $m_{b,t}$ | response mask，值为 0 或 1 |
| $\ell_{b,t}$ | 第 $b$ 条序列第 $t$ 个 label token 的 log-probability |

核心张量形状如下：

| 张量 | 形状 | 层级 |
|---|---:|---|
| `raw_rewards` | `(B,)` | sequence |
| `advantages` | `(B,)` | sequence |
| `input_ids` | `(B, T)` | token |
| `labels` | `(B, T)` | token |
| `response_mask` | `(B, T)` | token |
| `logits` | `(B, T, V)` | token distribution |
| `policy_log_probs` | `(B, T)` | token |
| `old_log_probs` | `(B, T)` | token |

在 loss 中，`advantages` 会从 `(B,)` 变成 `(B, 1)`，然后依靠 broadcasting 作用到每个 token。这是有语义的广播：同一条 response 的所有 response token 共用同一个 advantage。

---

## 3. Tokenization：mask 必须与 labels 对齐

### 3.1 为什么 prompt 和 response 要分开 tokenize

输入是两组字符串：

```python
prompt_strs: list[str]
output_strs: list[str]
```

实现分别调用：

```python
tokenizer.encode(text, add_special_tokens=False)
```

然后再拼接：

```text
full_tokens = prompt_tokens + response_tokens
```

分开 tokenize 的主要原因不是性能，而是必须知道 prompt 有多少 token。没有这个边界，就无法构造只覆盖 response 的 mask。

关闭自动 special tokens 也很重要。否则 tokenizer 可能给 prompt 和 response 分别插入 BOS/EOS，拼接后的序列就不再等价于真实的 prompt-response 文档。

### 3.2 一个完整的 shift 例子

假设：

```text
prompt tokens   = [10, 11]
response tokens = [20, 21, 22]
```

拼接后：

```text
full = [10, 11, 20, 21, 22]
```

causal LM 的输入和标签是：

```text
input_ids = [10, 11, 20, 21]
labels    = [11, 20, 21, 22]
```

逐位置看：

| 位置 $t$ | 模型看到的 token | 要预测的 label | label 属于 response? |
|---:|---:|---:|---|
| 0 | 10 | 11 | 否 |
| 1 | 11 | 20 | 是，response 的第一个 token |
| 2 | 20 | 21 | 是 |
| 3 | 21 | 22 | 是 |

所以：

```text
response_mask = [False, True, True, True]
```

最容易犯的错误是根据 `input_ids[t]` 判断 mask。位置 1 的 input token 仍是 prompt 的最后一个 token，但它预测的是 response 的第一个 token，因此该位置必须参与训练。

若 prompt 长度为 $P$、response 长度为 $R$，代码中的 `label_position` 是原完整序列里的 label 下标，mask 条件是：

$$
m_t = \mathbf{1}\left[P \le t+1 < P+R\right]
$$

这里的 $t+1$ 正是 shift 后 `labels[t]` 在完整序列里的位置。

### 3.3 padding 为什么要发生在 shift 之前

batch 中不同样本长度不同，需要先把完整序列 pad 到同一个长度：

```python
padded_tokens = tokens + [pad_token_id] * pad_len
input_ids = padded_tokens[:-1]
labels = padded_tokens[1:]
```

如果先对每条序列切出 `input_ids` 和 `labels`，再分别 padding，很容易让短序列末端的 label 与 mask 错一位。先 pad 完整序列再统一 shift，能保证三者始终来自同一坐标系。

padding 位置的 mask 必须是 `False`。公开测试专门构造一长一短两条样本，检查：

- 三个张量形状完全一致；
- response 第一个 token 的 mask 没有左移；
- 短样本最后的 padding label 不参与 loss。

### 3.4 空 response 不是普通的零损失样本

实现直接拒绝 tokenize 后长度为 0 的 response。

原因是空 response 会产生全 false mask。表面上 masked loss 为 0，但如果代码仍调用 AdamW 的 `optimizer.step()`，decoupled weight decay 仍可能修改参数。于是会出现“日志里 loss 为 0，模型却变了”的隐蔽错误。

因此公开测试不只检查抛出异常，还比较异常前后的全部参数，确认 AdamW 没有机会执行更新。

---

## 4. 从 logits 得到真实 token 的 log-probability

模型输出：

```text
logits: (B, T, V)
```

第一步是在 vocabulary 维归一化：

$$
\log p_\theta(v\mid x_{<t})
=
\operatorname{logsoftmax}(\text{logits}_t)_v
$$

代码使用 `log_softmax`，而不是先 `softmax` 再 `log`，因为前者使用稳定的 log-sum-exp 计算。

然后用真实 label 从 $V$ 个候选中选出一个：

```python
all_log_probs = F.log_softmax(logits, dim=-1)       # (B, T, V)
label_index = labels.unsqueeze(-1)                  # (B, T, 1)
log_probs = all_log_probs.gather(-1, label_index)  # (B, T, 1)
log_probs = log_probs.squeeze(-1)                   # (B, T)
```

`log_probs[b, t]` 表示：

$$
\log \pi_\theta
\left(y_{b,t}\mid x_b,y_{b,<t}\right)
$$

它不是整个 vocabulary 的分布，也不是整条 sequence 的 log-probability。

### token entropy

同一份分布可以计算：

$$
H_{b,t}
=
-\sum_{v=1}^{V}
p_\theta(v\mid h_{b,t})
\log p_\theta(v\mid h_{b,t})
$$

entropy 高表示下一 token 分布更平，低表示模型更确定。它用于训练诊断，不直接进入这里的 policy loss。

`get_response_log_probs` 不应用 response mask。这样函数只负责“模型在每个位置给真实 label 多少概率”，至于哪些位置属于训练目标，由聚合函数统一决定。这个职责分离能避免同一个 mask 在多个函数中被重复、甚至不一致地应用。

---

## 5. Reward：先保留原始分数，再构造 advantage

reward 函数接收 `(response_text, ground_truth)`，并返回类似：

```python
{
    "reward": 1.0,
    "format_reward": 1.0,
    "answer_reward": 1.0,
}
```

训练真正使用的是 `reward`，其他分量进入 metadata，便于区分模型是否遵守格式、是否答对，以及总 reward 的变化来自哪里。

这一层输出 `raw_rewards: (B,)`。reward 必须保持 rollout 原始顺序，因为后续会直接 reshape 为 `(N, G)`。正确排列应是：

```text
prompt 1 response 1
prompt 1 response 2
...
prompt 1 response G
prompt 2 response 1
...
```

如果 response 按其他方式交错，reshape 虽然不会报错，却会把不同 prompt 的 reward 放进同一 group，baseline 就失去意义。

---

## 6. Group advantage：GRPO、Dr. GRPO、RFT、MaxRL 的共同核心

对第 $i$ 个 prompt 的 $G$ 个 reward：

$$
\mathbf r_i =
\left[r_{i,1},r_{i,2},\ldots,r_{i,G}\right]
$$

group mean 为：

$$
\mu_i = \frac{1}{G}\sum_{j=1}^{G}r_{i,j}
$$

### 6.1 标准 GRPO

$$
A_{i,j}
=
\frac{r_{i,j}-\mu_i}
{\sigma_i+\epsilon}
$$

高于同组平均的 response 得到正 advantage，低于平均的得到负 advantage。GRPO 不需要单独训练 value model，代价是每个 prompt 必须采样多条 response，且尺度依赖组内 reward 分布。

### 6.2 Dr. GRPO

Dr. GRPO 去掉 reward standard-deviation normalization：

$$
A_{i,j}=r_{i,j}-\mu_i
$$

std normalization 会让相同 reward 差在不同 group 中产生不同尺度，尤其在 reward 方差很小时可能被放大。

### 6.3 RFT

Rejection Fine-Tuning 在这里表达为：

$$
A_{i,j}=r_{i,j}
$$

也就是不减 baseline、不做 normalizer。如果 reward 是 0/1，只有通过筛选的样本产生有效梯度。

### 6.4 MaxRL

公开实现中的 MaxRL 配置是：

$$
A_{i,j}=\frac{r_{i,j}}{\mu_i+\epsilon}
$$

它不减 group mean，而是用 group mean 调整 reward 尺度。

### 6.5 配置表

| 方法 | baseline | advantage normalizer | 常用 loss normalization |
|---|---|---|---|
| 标准 GRPO | group mean | group std | sequence |
| GRPO constant | group mean | group std | constant |
| Dr. GRPO | group mean | none | constant |
| RFT | none | none | constant |
| MaxRL | none | group mean | constant |

这不是五套完全独立的训练器，而是同一数据流上的三个选择：是否减 baseline、是否归一化 advantage、token loss 最终除以什么。

### 6.6 用两个 reward 手算一次

假设：

$$
\mathbf r=[1,3],\qquad \mu=2
$$

PyTorch 默认 `std` 使用样本标准差，所以 $\sigma=\sqrt 2$。

| 方法 | advantage |
|---|---|
| GRPO | $[-1/\sqrt 2,\;1/\sqrt 2]$ |
| Dr. GRPO | $[-1,\;1]$ |
| MaxRL | $[0.5,\;1.5]$ |

这组数值直接写进测试，比只检查 shape 或 finite 更能防止配置写反。

### 6.7 边界条件

- `group_size` 必须大于 0；
- reward 数量必须能被 `group_size` 整除；
- `group_size=1` 时样本标准差没有定义，实现显式避免 NaN；
- 分母加 $\epsilon$ 只能防止除零，不能自动解决 group mean 接近 0 导致尺度过大的建模问题。

---

## 7. On-policy policy gradient 到底在优化什么

若 rollout 来自当前 policy，不需要 importance correction。对 sequence advantage $A_b$，每个 response token 的 loss 为：

$$
L_{b,t}=-A_b\ell_{b,t}
$$

我们想最大化 $A_b\log\pi_\theta$，而 PyTorch optimizer 最小化 loss，所以加负号。

- $A_b>0$：提高已采样 token 的概率；
- $A_b<0$：降低这些 token 的概率；
- $A_b=0$：该 sequence 没有梯度贡献。

advantage 被视为常数，不对 reward 或 group statistics 反向传播。

`compute_policy_gradient_loss` 返回 `(B,T)` 的 per-token loss，它还不是最终 scalar。prompt 和 padding 仍在张量中，必须在下一层用 mask 去掉。

---

## 8. Loss normalization：分母决定每条 response 的权重

定义：

$$
\widetilde L_{b,t}=m_{b,t}L_{b,t}
$$

### 8.1 Sequence normalization

先对每条 response 内的 token 求平均，再对 sequence 求平均：

$$
L_{\text{seq}}
=
\frac{1}{B}
\sum_{b=1}^{B}
\frac{
\sum_t m_{b,t}L_{b,t}
}{
\sum_t m_{b,t}
}
$$

每条 response 总体权重相同。长 response 不会仅因为 token 更多就自动占据更大权重，但每个 token 的权重与 response 长度成反比，会引入 length-related bias。

### 8.2 Constant normalization

固定分母 $Z$：

$$
L_{\text{const}}
=
\frac{1}{Z}
\sum_{b,t}m_{b,t}L_{b,t}
$$

此时每个有效 token 权重相同，response 越长，总贡献越大。$Z$ 必须由训练配置明确给出，不能在每个 microbatch 内临时重算。

### 8.3 一个数值例子

```text
losses =
[[1, 3, 99],
 [2, 4,  6]]

mask =
[[1, 1, 0],
 [1, 1, 1]]
```

`99` 被 mask，不应有贡献。

Sequence normalization：

$$
\frac{1}{2}
\left(
\frac{1+3}{2}
+
\frac{2+4+6}{3}
\right)
=3
$$

若 $Z=8$：

$$
\frac{1+3+2+4+6}{8}=2
$$

公开测试直接断言这两个 scalar，确保 mask 和分母都没有被悄悄改掉。

---

## 9. Microbatch accumulation：如何与 full batch 严格等价

### 9.1 sequence 模式的缩放

设原始 rollout batch 有 $B_0$ 条 sequence，第 $k$ 个 microbatch 有 $M_k$ 条。microbatch 内部返回：

$$
\overline L_k=\frac{1}{M_k}\sum_{b\in k}L_b
$$

要恢复 full-batch objective：

$$
L=\frac{1}{B_0}\sum_b L_b
$$

每个 microbatch backward 前应乘 $M_k/B_0$：

$$
\sum_k
\frac{M_k}{B_0}\overline L_k
=
\frac{1}{B_0}\sum_bL_b
$$

简单除以 accumulation steps 只在每批大小完全相同且没有过滤样本时才碰巧正确。

### 9.2 零 advantage pruning 不应改变分母

实现先过滤：

```python
active_mask = advantages != 0
```

零 advantage sequence 的理论贡献是 0，跳过 forward 可以节省计算。但分母仍保留过滤前的 `original_batch_size`。若改除以 active count，剩余梯度会被放大，pruning 就从等价优化变成了修改 objective。

如果整个 batch 的 advantage 都为 0，代码清空梯度并直接返回，不执行 model forward 或 optimizer step。

### 9.3 constant 模式

每个 microbatch 计算：

$$
L_k=\frac{1}{Z}\sum_{b,t\in k}m_{b,t}L_{b,t}
$$

所有 $L_k$ 直接相加即可，因为它们共享全局分母 $Z$。这里再乘 $M_k/B_0$ 会重复缩放。

### 9.4 train step 的准确顺序

1. 计算 raw reward 与 metadata；
2. 按 group 计算 advantage；
3. tokenize 得到 input、label 和 mask；
4. 记录原始 batch size；
5. 过滤零 advantage；
6. 清空梯度；
7. 每个 microbatch forward；
8. 计算 per-token objective；
9. 应用 mask 与 normalization；
10. 按全局分母缩放并 backward；
11. 汇总 entropy、importance weight、clip fraction；
12. clip gradient norm；
13. optimizer step；
14. 再次清空梯度。

测试从同一个模型副本出发，分别用 full batch 和两个 microbatch 更新，再逐参数比较结果。这比只比较 loss 更直接地证明 accumulation 等价。

---

## 10. Off-policy correction：为什么 loss 里不再乘 log-prob

rollout 来自旧 policy 时，定义：

$$
\rho_{b,t}
=
\frac{\pi_\theta(y_{b,t}\mid\cdot)}
{\pi_{\text{old}}(y_{b,t}\mid\cdot)}
=
\exp\left(
\ell^\theta_{b,t}-\ell^{\text{old}}_{b,t}
\right)
$$

unclipped loss 是：

$$
L_{b,t}=-A_b\rho_{b,t}
$$

不是 $-A_b\rho_{b,t}\ell^\theta_{b,t}$。原因是 ratio 已经依赖当前 log-prob：

$$
\nabla_\theta\rho
=
\rho\nabla_\theta\log\pi_\theta
$$

所以：

$$
\nabla_\theta(-A\rho)
=
-A\rho\nabla_\theta\log\pi_\theta
$$

这正是 importance-weighted policy gradient。额外乘 log-prob 会引入不属于目标的项。

实现先在 log-space 相减再 exp，避免直接对两个很小概率做除法：

```python
log_ratios = policy_log_probs - old_log_probs
weights = torch.exp(log_ratios)
```

---

## 11. PPO/GRPO clipping：必须结合 advantage 符号理解

$$
J_{b,t}
=
\min\left(
A_b\rho_{b,t},
A_b\operatorname{clip}
(\rho_{b,t},1-\epsilon,1+\epsilon)
\right)
$$

loss 是 $-J$。

当 $A>0$ 时，response 表现好；若 $\rho>1+\epsilon$，概率已经提高太多，上界阻止继续奖励。

当 $A<0$ 时，response 表现差；若 $\rho<1-\epsilon$，概率已经下降太多，下界阻止继续下降。

所以 clipping 不能简化成“ratio 超过上界就裁剪”，负 advantage 对应的是下界。

公开测试设 $\rho=2$、$\epsilon=0.2$：

| advantage | unclipped objective | clipped objective | 最终 loss |
|---:|---:|---:|---:|
| $A=1$ | $2$ | $1.2$ | $-1.2$ |
| $A=-1$ | $-2$ | $-1.2$ | $2$ |

第二行没有在上界裁剪，因为对负 advantage 来说，$\rho=2$ 不是危险方向。

`clip_fraction` 只统计 response token，prompt 和 padding 不应稀释指标。

---

## 12. GSPO：从 token ratio 到 sequence ratio

GSPO 先在 response token 上求 mean log-ratio：

$$
\overline{\Delta\ell}_b
=
\frac{
\sum_t m_{b,t}
(\ell^\theta_{b,t}-\ell^{\text{old}}_{b,t})
}{
\sum_t m_{b,t}
}
$$

再取指数：

$$
s_b=\exp(\overline{\Delta\ell}_b)
$$

等价地：

$$
s_b=
\left(
\prod_{t:m_{b,t}=1}\rho_{b,t}
\right)^{1/|y_b|}
$$

所以 $s_b$ 是 response token ratio 的几何平均。同一条 response 的所有 token 共享这个 sequence weight。

实现先得到 `(B,1)` 的 objective，再 expand 成 `(B,T)`，最后由 response mask 决定哪些 token 进入聚合。

必须保证：

- mean log-ratio 只在 response 上求；
- prompt 与 padding 不进入分母；
- 每条 sequence 至少有一个 response token；
- GSPO clip fraction 按 sequence 数聚合；
- token-level GRPO clip fraction 按有效 response token 数聚合。

---

## 13. Metadata 也必须跨 microbatch 正确聚合

训练能更新参数，不代表监控指标就是对的。

### Entropy

$$
H_{\text{response}}
=
\frac{
\sum_{b,t}m_{b,t}H_{b,t}
}{
\sum_{b,t}m_{b,t}
}
$$

不能先算每个 microbatch mean 再简单平均，否则不同 token 数的 microbatch 权重错误。

### Importance weights

各 microbatch 的 weight 按 batch 维拼接，保持与过滤后样本的顺序一致，而不是只保留第一批。

### Clip fraction

每批 fraction 要乘自己的统计单元数：token GRPO 使用有效 response token 数，GSPO 使用 sequence 数。最后再除全局总数。

这类 bug 不影响 backward，因此单看 loss 很难发现。测试特意让 clipping 主要发生在后一个 microbatch，确认最终 metadata 不会只反映第一批。

---

## 14. Packed SFT：为什么切块长度要多一个 token

公开实现使用自有中性模板：

```text
Instruction:
{instruction}

Response:
{response}
```

每条 record 支持 `prompt/response` 或 `instruction/completion`。处理流程是：

1. 读取 JSONL 或 gzip JSONL；
2. 可选地用固定 seed 打乱；
3. 文档前加 BOS；
4. 格式化并 tokenize；
5. 文档后加 EOS；
6. 拼成连续 token stream；
7. 切 fixed-length next-token examples。

若训练长度为 $T$，必须先取 $T+1$ 个 token：

```python
chunk = token_stream[start : start + seq_length + 1]
input_ids = chunk[:-1]  # T
labels = chunk[1:]      # T
```

只取 $T$ 个 token，shift 后会只剩 $T-1$。不足 $T+1$ 的尾部直接丢弃。

packing 允许一个 chunk 跨越两条文档。EOS 表示前一文档结束，下一条 BOS 开始，减少 padding 并提高 token 利用率。

### 错误消息也有隐私边界

缺字段时只报告：

```text
SFT record 3 is missing response/completion.
```

而不打印完整 dict。训练数据可能含私有文本；完整 record 进入 CI 日志会形成二次泄露。测试放入一个 `private_note` 字段，并断言异常中不包含它。

---

## 15. MMLU 与 GSM8K parser：评测代码也是实验定义

MMLU parser 按优先级匹配：

```text
The correct answer is (C)
Answer is C
C
c
```

最终统一返回大写 A/B/C/D，无法可靠识别时返回 `None`。优先匹配完整短语，避免推理文本中偶然出现的字母过早成为答案。

GSM8K parser 提取所有阿拉伯数字并返回最后一个，支持千位逗号、正负号和小数。例如：

```text
Intermediate result: 1,200.
After correction, the final answer is -3.5.
```

返回 `-3.5`。它不解析英文拼写的 number，也不判断推理过程是否正确。

parser 的变化会直接改变 accuracy，因此版本必须被视为评测配置的一部分。

---

## 16. DPO：把成对偏好转成分类目标

给定 prompt $x$、chosen $y_w$、rejected $y_l$：

$$
\Delta_w
=
\log\pi_\theta(y_w\mid x)
-
\log\pi_{\text{ref}}(y_w\mid x)
$$

$$
\Delta_l
=
\log\pi_\theta(y_l\mid x)
-
\log\pi_{\text{ref}}(y_l\mid x)
$$

DPO loss：

$$
L_{\text{DPO}}
=
-\log\sigma\left(
\beta(\Delta_w-\Delta_l)
\right)
$$

训练希望 $\Delta_w>\Delta_l$：相对于 reference，当前 policy 应更多提高 chosen response。

$\beta$ 直接缩放 preference logit。它不是 learning rate；改变它会改变目标函数的陡峭程度。

### 实现步骤

1. 用同一模板格式化 chosen 与 rejected；
2. response 后追加 EOS；
3. 计算 policy 下两条文档的 sequence log-prob；
4. 在 `torch.no_grad()` 中计算 reference；
5. 将 reference scalar 移到 policy device；
6. 构造两个 log-ratio；
7. 使用数值稳定的 `-F.logsigmoid`。

sequence log-prob 是所有 next-token log-prob 的和：

$$
\log\pi_\theta(z)
=
\sum_{t=1}^{|z|-1}
\log\pi_\theta(z_{t+1}\mid z_{\le t})
$$

chosen/rejected 有相同的 prompt/template prefix。在同一个模型里，这部分 prefix log-prob 在 chosen 与 rejected 的差中抵消，留下 response 分叉后的概率差。

### 为什么相同 policy/reference 的测试太弱

若二者相同，$\Delta_w=\Delta_l=0$，无论 response 是否计分正确都有：

$$
L=-\log\sigma(0)=\log 2
$$

所以公开测试使用不同的固定 logits，让 policy 明确偏好 chosen token，reference 保持均匀，再与手算值比较。漏掉 response、写反 chosen/rejected 或忘记 reference 项都会失败。

---

## 17. 18 个测试分别证明什么

当前公开测试结果：

```text
18 passed
```

| 测试组 | 数量 | 核心断言 |
|---|---:|---|
| Tokenization / log-prob | 3 | shift、mask、padding、entropy、空 response |
| Reward / advantage | 2 | reward component、三种 advantage 手算值 |
| Policy loss / aggregation | 5 | on-policy、noclip、GRPO、GSPO、两种分母 |
| GRPO train step | 4 | 参数更新、AdamW 边界、累积等价、metadata |
| SFT / parser | 3 | packing、错误脱敏、答案解析 |
| DPO | 1 | 非同 policy/reference 的手算 loss |

测试不仅确认没有异常，还检查具体 shape、mask 布尔值、手算 loss、更新前后参数、full/microbatch 参数等价，以及后一个 microbatch 的 clipping 是否进入 metadata。

### 这些测试没有证明什么

18 个测试不能证明：

- 大模型训练会收敛；
- 某个 learning rate 最优；
- GRPO 比其他方法效果更好；
- mixed precision、distributed training 或 vLLM rollout 正确；
- safety benchmark 达到课程要求；
- 公开中性模板与课程模板产生相同数值。

单元测试验证 primitive 与小规模组合行为，不能替代真实训练实验。

---

## 18. 实现边界

我不是 Stanford 学生，因此没有进行课程提交，也没有使用课程共享资源。

未执行的远程或大规模 deliverables 包括：

- OLMo-2-0425-1B prompting baseline
- GRPO 训练到指定 validation accuracy
- learning-rate tuning 与 prompt ablation
- 多随机种子的 Dr. GRPO / RFT / MaxRL 对比
- 大倍率 off-policy GRPO / GSPO 实验
- supplement 的 SFT / DPO GPU 训练
- AlpacaEval、SimpleSafetyTests 与 red-teaming

本文中的“完成”严格指本地算法实现、独立测试和代码审查完成，不代表远程实验完成。

---

## 19. 从这份作业得到的工程结论

1. **Shape 正确不代表语义对齐。** 三个张量都是 `(B,T)`，mask 仍可能错一位；必须用短序列逐位置检查。
2. **分母是 objective 的一部分。** sequence mean、token sum 与固定常数改变样本相对权重。
3. **优化与监控要分别验证。** 错误的 clip fraction 不影响梯度，却会误导实验判断。
4. **跳过无效样本必须保持数学等价。** 过滤零 advantage 不能改变原 batch denominator。
5. **边界条件要考虑 optimizer。** 全 false mask 下 AdamW 仍可能通过 weight decay 更新参数。
6. **off-policy ratio 已经承载梯度。** 机械地再乘 log-prob 会重复引入项。
7. **公开代码要重新建立验证边界。** 不公开课程资产时，必须清楚说明独立测试验证了什么。

---

## 20. 延伸阅读

- [DeepSeekMath / GRPO](https://arxiv.org/abs/2402.03300)
- [DeepSeek-R1](https://arxiv.org/abs/2501.12948)
- [Understanding R1-Zero-Like Training / Dr. GRPO](https://arxiv.org/abs/2503.20783)
- [Maximum Likelihood Reinforcement Learning / MaxRL](https://arxiv.org/abs/2506.15920)
- [Group Sequence Policy Optimization](https://arxiv.org/abs/2507.18071)
- [Direct Preference Optimization](https://arxiv.org/abs/2305.18290)
- [Kimi k1.5](https://arxiv.org/abs/2501.12599)
- [Does RL Really Incentivize Reasoning Capacity Beyond the Base Model?](https://arxiv.org/abs/2504.13837)

---

## 结语

Assignment 5 把几类常被一句话略过的问题变成了可以执行、可以失败的代码：

- “只训练 response”要求 mask 与 shifted label 严格对齐；
- “group normalization”要求明确 baseline、normalizer 和 group 边界；
- “gradient accumulation 等价于 full batch”要求分母推导成立；
- “off-policy correction”要求区分 token ratio 与 sequence ratio；
- “DPO 不需要 reward model”仍要求正确的 tokenization、reference policy 和 preference logit；
- “测试通过”必须说明测试究竟约束了什么。

把这些细节逐项手算并写进测试后，GRPO、GSPO 和 DPO 才不再只是论文中的目标函数，而是一条从文本、概率、reward 到梯度更新都能解释清楚的训练链路。

代码与测试：**[keepkeen/cs336-assignment5-alignment](https://github.com/keepkeen/cs336-assignment5-alignment)**。

如果想把这些组件放回完整的强化学习知识体系——从 MDP、PPO 推导到 GRPO 家族的失败模式、Agentic RL 与训练系统排障——可以接着读姊妹合集[《大模型强化学习：从零到面试》](/series/llm-reinforcement-learning-interview/)。
