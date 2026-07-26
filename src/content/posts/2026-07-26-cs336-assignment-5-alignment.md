---
title: "CS336 Assignment 5：从 GRPO 到 DPO 的 Alignment 实战"
description: "完整拆解 Stanford CS336 Assignment 5：实现 GRPO、Dr. GRPO、MaxRL、GSPO、SFT 数据打包与 DPO，并用 26 个本地测试验证关键数学细节。"
date: 2026-07-26
tags:
  - cs336
  - alignment
  - ai
  - engineering
featured: true
draft: false
lang: zh-CN
---

> 结论先行：这份作业真正难的不是把公式抄成 PyTorch，而是让 token shift、response mask、advantage normalizer、microbatch 分母和 off-policy importance weight 在同一个坐标系里严格对齐。

我完成了 Stanford CS336 Spring 2026 Assignment 5 的本地代码部分：主作业的 GRPO / RLVR 组件与训练 step，以及 optional supplement 中可由本地测试验证的 SFT、MMLU/GSM8K parser 和 DPO loss。最终结果是 **26 个测试全部通过**。

先放入口：

- [作业代码仓库](https://github.com/keepkeen/cs336-coursework/tree/cs336-coursework/assignment5-alignment)
- [核心实现 `alignment.py`](https://github.com/keepkeen/cs336-coursework/blob/cs336-coursework/assignment5-alignment/cs336_alignment/alignment.py)
- [课程 adapter 接线](https://github.com/keepkeen/cs336-coursework/blob/cs336-coursework/assignment5-alignment/tests/adapters.py)
- [完整作业总文档](https://github.com/keepkeen/cs336-coursework/blob/cs336-coursework/assignment5-alignment/tasks/assignment5_alignment_report.md)
- [逐函数实现讲解](https://github.com/keepkeen/cs336-coursework/blob/cs336-coursework/assignment5-alignment/tasks/solution_explanation.md)
- [测试目录与 snapshot](https://github.com/keepkeen/cs336-coursework/tree/cs336-coursework/assignment5-alignment/tests)

---

## 1. 这份作业在做什么

主作业叫 **Reasoning RL**，目标是理解并实现 Group Relative Policy Optimization（GRPO），再逐步引入：

1. 标准 on-policy GRPO
2. Dr. GRPO
3. Rejection Fine-Tuning（RFT）
4. MaxRL
5. token-level off-policy importance weighting
6. PPO/GRPO clipping
7. sequence-level GSPO

Optional supplement 则补上更完整的 post-training 管线：

- MMLU、GSM8K、AlpacaEval、SimpleSafetyTests
- instruction tuning 数据打包
- supervised fine-tuning
- HH preference data
- Direct Preference Optimization（DPO）
- safety evaluation 与 red-teaming

课程把“大模型后训练”拆成了很多可独立验证的小组件。与其直接写一个长训练脚本，不如先把每个 primitive 写对，再组合成 train step。

## 2. 我的实现结构

课程测试通过 `tests/adapters.py` 调用学生实现。初始 adapter 里的函数都只会抛出 `NotImplementedError`。

我没有把全部逻辑堆在 adapter 里，而是增加了独立模块：

```text
tests/test_*.py
       │
       ▼
tests/adapters.py          课程规定的接口层
       │
       ▼
cs336_alignment/alignment.py
       ├── tokenization / response mask
       ├── log-prob / entropy
       ├── reward / advantage
       ├── on-policy / off-policy loss
       ├── microbatch GRPO train step
       ├── packed SFT dataset
       ├── MMLU / GSM8K parser
       └── DPO loss
```

这种分层让测试 glue 和真实实现保持分离，之后如果补完整 GPU 训练脚本，也可以直接复用同一套函数。

---

## 3. Tokenization：第一个容易错的地方

函数需要分别 tokenize prompt 和 output，拼接后构造：

- `input_ids`
- `labels`
- 与 `labels` 对齐的 `response_mask`

关键不是“做一个 mask”，而是理解它对齐谁。

设完整序列为：

```text
[prompt tokens][response tokens][padding]
```

next-token prediction 使用：

```python
input_ids = padded_tokens[:-1]
labels = padded_tokens[1:]
```

因此 `response_mask[t]` 表示的是 `labels[t]` 是否属于 response，而不是 `input_ids[t]` 是否属于 response。

另一个 snapshot 才暴露出来的细节是：**先 padding 完整序列，再切 `input_ids` 和 `labels`**。如果先切片再分别 padding，短序列末端会发生一位偏差。

## 4. 从 logits 到 response log-prob

模型输出形状为：

```text
(batch_size, sequence_length, vocabulary_size)
```

对 vocabulary 维做 `log_softmax`，再 gather 真实 label：

```python
all_log_probs = F.log_softmax(logits, dim=-1)
log_probs = all_log_probs.gather(
    dim=-1,
    index=labels.unsqueeze(-1),
).squeeze(-1)
```

token entropy 使用同一份分布：

$$
H_t = -\sum_v p_t(v)\log p_t(v)
$$

这里不立刻应用 response mask。函数只负责返回 per-token statistics，mask 统一留给 loss aggregation 处理。

---

## 5. GRPO 的 advantage 不是唯一写法

对每个 prompt 采样一组 response，得到 reward：

$$
r_{i,1}, r_{i,2}, \ldots, r_{i,G}
$$

标准 GRPO 使用 group mean baseline 和 group standard deviation：

$$
A_{i,j} = \frac{r_{i,j}-\mu_i}{\sigma_i+\epsilon}
$$

作业让同一个函数支持多种组合：

| 方法 | baseline | advantage normalizer | loss normalization |
|---|---|---|---|
| 标准 GRPO | group mean | group std | sequence |
| GRPO constant | group mean | group std | constant |
| Dr. GRPO | group mean | none | constant |
| RFT | none | none | constant |
| MaxRL | group mean | group mean | constant |

这张表很重要：它说明这些算法在代码上不是五套独立实现，而是同一个数据流上的三组策略开关。

## 6. On-policy policy gradient

对 sequence-level advantage $A$，每个 response token 的 loss 是：

$$
\mathcal{L}_t = -A\log\pi_\theta(y_t\mid x,y_{<t})
$$

负号来自 PyTorch optimizer 做 gradient descent，而我们想最大化期望 reward。

真正的区别发生在聚合阶段。

### Sequence normalization

先在每条 response 内平均，再对 batch 平均：

$$
\mathcal{L} = \frac{1}{B}\sum_i
\frac{\sum_t m_{i,t}\mathcal{L}_{i,t}}
{\sum_t m_{i,t}}
$$

它让长短 response 的总权重更接近，但也会引入 length-related bias。

### Constant normalization

$$
\mathcal{L} = \frac{1}{Z}\sum_{i,t}m_{i,t}\mathcal{L}_{i,t}
$$

Dr. GRPO 等方法使用固定 normalizer，避免每条 sequence 自己除长度。

---

## 7. Microbatch gradient accumulation 的隐藏分母

完整 rollout batch 通常放不进单卡，因此需要 microbatch：

```text
full batch
  ├── microbatch 1 -> forward -> backward
  ├── microbatch 2 -> forward -> backward
  └── microbatch N -> forward -> backward
                         │
                         ▼
                 clip grad -> step
```

如果使用 sequence normalization，microbatch loss 不能简单除以 gradient accumulation steps，而要按该 microbatch 的 sequence 数占原始 batch 的比例缩放。

还有一个更隐蔽的点：作业要求剪掉 advantage 为零的 sequence 以节省 forward。但剪枝后，sequence normalization 的全局分母仍应是**原始 batch sequence count**。否则剪枝会无意中放大剩余样本的梯度。

这是我在本地 snapshot 全通过后额外做实现审查时补上的质量修正。

## 8. Off-policy：从 token ratio 到 GSPO

当 rollout 来自旧 policy $\pi_{old}$，当前模型已经更新为 $\pi_\theta$，需要 importance weight：

$$
w_t = \exp\left(
\log\pi_\theta(y_t)-\log\pi_{old}(y_t)
\right)
$$

### Noclip

$$
\mathcal{L}_t = -A w_t
$$

注意这里不是 `-A * w_t * log_prob`。梯度通过 $w_t$ 中的当前 policy log-prob 产生。

### PPO / GRPO clipping

$$
\mathcal{L}_t = -\min\left(
A w_t,
A\operatorname{clip}(w_t,1-\epsilon,1+\epsilon)
\right)
$$

### GSPO

GSPO 不对每个 token 单独 reweight，而是在 response token 上计算 mean log-ratio：

$$
s = \exp\left(
\frac{1}{|y|}\sum_t
\left(\log\pi_\theta(y_t)-\log\pi_{old}(y_t)\right)
\right)
$$

也就是整条 sequence importance ratio 的几何平均，再对 $s$ 做 clipping。

实现时必须只在 `response_mask` 为真的位置求平均，不能把 prompt 和 padding 算进去。

---

## 9. Supplement：SFT packed dataset

SFT 使用仓库提供的 Alpaca 模板：

```text
Below is an instruction that describes a task. Write a response that appropriately completes the request.

### Instruction:
{prompt}

### Response:
{response}
```

每条 document 前加 BOS、后加 EOS，然后把所有 document 拼成一个长 token stream。

为了构造长度为 `seq_length` 的 next-token example，每次要取 `seq_length + 1` 个 token：

```python
input_ids = chunk[:-1]
labels = chunk[1:]
```

不足完整长度的最后一个 chunk 直接丢弃。测试 fixture 不只检查 shape，而是逐 token 检查 75 个 packed example，因此模板末尾换行、BOS/EOS 和切片方式都必须精确一致。

## 10. MMLU 与 GSM8K parser

MMLU parser 优先匹配：

```text
The correct answer is B
Answer is C
```

无法得到孤立 A/B/C/D 时返回 `None`。

GSM8K parser 按 handout 要求取输出中的最后一个阿拉伯数字，并支持逗号、小数和正负号。英文拼写的数字不解析。

这看似简单，但 parser 是评测可信度的一部分。解析规则稍微变化，就可能把“模型能力变化”与“评测脚本变化”混在一起。

---

## 11. DPO loss

对 chosen response $y_w$ 和 rejected response $y_l$，DPO 使用：

$$
\mathcal{L}_{DPO} =
-\log\sigma\left(
\beta\left[
\log\frac{\pi_\theta(y_w\mid x)}{\pi_{ref}(y_w\mid x)}
-
\log\frac{\pi_\theta(y_l\mid x)}{\pi_{ref}(y_l\mid x)}
\right]
\right)
$$

实现细节：

- chosen / rejected 都用完整 Alpaca 文档格式
- response 后追加 EOS
- 对完整 concat string 求 next-token log-prob sum
- reference model 放在 `torch.no_grad()` 下
- reference log-prob 移到 policy model device 后再相减

测试标准是 tiny model fixture 上的 loss 接近 `0.9104`，容差 `1e-4`。如果只对裸 prompt/response 求概率，结果不会匹配。

## 12. 测试到底在验证什么

完整本地测试结果：

```text
.venv/bin/python -m pytest -q

26 passed in 2.79s
```

| 测试组 | 数量 | 主要标准 |
|---|---:|---|
| GRPO | 19 | tensor snapshot、loss、更新后模型参数、grad 清理 |
| Metrics | 4 | 成功/失败解析行为 |
| SFT data | 2 | dataset 长度、逐 token fixture、batch shape/dtype |
| DPO | 1 | 固定模型上的 loss 数值 |

训练 step 测试会比较 optimizer step 后 tiny model 的全部参数，因此它同时覆盖了：

- loss 公式
- microbatch 缩放
- response mask
- gradient accumulation
- gradient clipping
- optimizer step
- `zero_grad(set_to_none=True)`

这比“loss 能 backward”严格得多。

## 13. 课程提交流程的一个陷阱

README 推荐：

```bash
uv sync --no-install-package flash-attn
uv sync
uv run pytest tests/test_grpo.py
```

课程脚本 `test_and_make_submission.sh` 会运行主作业测试并生成 `code.zip`。但脚本里的 pytest 后面带有 `|| true`，也就是说：**即使测试失败，脚本仍可能继续生成提交包。**

因此真正提交前应该先独立运行 pytest 并确认全绿，不能只看 `code.zip` 是否出现。

我不是 Stanford 学生，因此没有执行课程提交，也没有运行依赖 B200、Modal、课程共享 volume 和 WandB 的大规模实验。

## 14. 哪些部分还没有做

代码层面，本地测试覆盖的任务已经完成。未执行的是 handout 中的远程实验 deliverables：

- OLMo-2-0425-1B prompting baseline
- GRPO 训练到指定 validation accuracy
- learning-rate tuning 与 prompt ablation
- 多随机种子的 Dr. GRPO / RFT / MaxRL 对比
- 32x off-policy GRPO / GSPO 实验
- supplement 的 SFT / DPO GPU 训练
- AlpacaEval、SimpleSafetyTests、red-teaming 结果与图表

因此本文的“完成”指 **本地实现与本地评分测试完成**，不把未运行的 GPU 实验伪装成结果。

---

## 15. 2025–2026 的延伸阅读

这份作业几乎正好踩在 reasoning RL 快速演化的时间点上。几条与实现最直接相关的线索：

- [DeepSeek-R1](https://arxiv.org/abs/2501.12948)：大规模 RL 激励 chain-of-thought reasoning，R1-Zero 展示了无冷启动 SFT 的极端路线。
- [Kimi k1.5](https://arxiv.org/abs/2501.12599)：从工程系统角度讨论如何 scale LLM reinforcement learning。
- [Understanding R1-Zero-Like Training / Dr. GRPO](https://arxiv.org/abs/2503.20783)：重新审视 std normalization 与 sequence normalization 引入的偏差。
- [GSPO](https://arxiv.org/abs/2507.18071)：用 sequence-level 几何平均 importance weight 改善 off-policy 稳定性。
- [Does RL Really Incentivize Reasoning Capacity Beyond the Base Model?](https://arxiv.org/abs/2504.13837)：追问 RLVR 是创造新能力，还是主要重新分配已有能力的概率质量。
- [Qwen3 Technical Report](https://arxiv.org/abs/2505.09388)：thinking / non-thinking 模式和工业级 post-training 管线。
- [OpenAI o3/o4-mini System Card](https://openai.com/index/o3-o4-mini-system-card/)：reasoning RL 之外的 deliberative alignment、能力阈值与部署安全。
- [Anthropic Constitutional Classifiers](https://www.anthropic.com/research/next-generation-constitutional-classifiers)：训练后安全 guardrail 与 jailbreak 防御。

[完整总文档](https://github.com/keepkeen/cs336-coursework/blob/cs336-coursework/assignment5-alignment/tasks/assignment5_alignment_report.md) 还整理了 Meta Llama 4、LlamaFirewall、Gemini 2.5、Seed1.5-Thinking、Phi-4-reasoning 和 DPO/RL survey 等资料。

## 16. 最后的理解

这份作业最有价值的地方，是把几个常被一句话带过的概念变成了可以出错、可以测试的代码：

- “只训练 response”意味着 mask 必须与 shifted label 对齐
- “normalize advantage”必须说明按什么统计量、在哪个 group 上算
- “gradient accumulation 等价于 full batch”需要证明分母一致
- “off-policy correction”必须区分 token ratio 与 sequence ratio
- “DPO 不需要 reward model”不代表 tokenization 和 reference policy 可以随便处理

当这些细节都通过 snapshot 和参数更新测试后，GRPO、GSPO、DPO 就不再只是论文里的缩写，而是同一套概率模型、采样分布、奖励和梯度估计之间的具体选择。

代码和文档都在这里：**[keepkeen/cs336-coursework · Assignment 5](https://github.com/keepkeen/cs336-coursework/tree/cs336-coursework/assignment5-alignment)**。
