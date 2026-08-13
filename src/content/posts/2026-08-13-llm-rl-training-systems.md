---
title: "大模型 RL 训练系统、指标与排障"
description: "梳理 rollout 与 trainer 数据流、并行和显存、TRL/verl/slime/OpenRLHF/AReaL/ROLL 选型，以及八类高频故障诊断。"
date: 2026-08-13
tags:
  - reinforcement-learning
  - llm
  - interview
lang: zh-CN
draft: false
series: llm-reinforcement-learning-interview
seriesOrder: 9
---
> 目标：不仅会写公式，还能解释一轮大模型 RL 训练到底有哪些进程、数据如何流动、显存花在哪里，以及指标异常时先查什么。

## 1. 先画出完整数据流

```text
prompt dataset
      │
      ▼
rollout workers ──► responses / trajectories ──► reward or verifier
      ▲                         │                       │
      │                         └──────────┬────────────┘
      │                                    ▼
      └──── policy weight sync ◄──── trainer computes loss
                                           │
                              reference / critic / reward model
```

一轮更新通常包含：

1. 读取一批 prompt；
2. rollout policy 为每个 prompt 采样一个或多个 response/trajectory；
3. verifier、reward model 或环境给分；
4. 计算 old/reference/current log-prob、advantage 与 mask；
5. policy 做若干 minibatch 更新；
6. 将新权重同步给 rollout worker；
7. 记录评测、吞吐和稳定性指标。

PPO 还需要 critic；GRPO 可以省去 critic，但不能省去 rollout、reward、old policy 语义和稳定性监控。

## 2. 四类模型分别占什么资源

以标准 RLHF PPO 为例：

- **policy/actor**：需要参数、梯度、优化器状态和激活，训练显存最大；
- **critic**：也需要训练状态，规模可与 policy 相近或更小；
- **reference**：冻结，仅前向计算 KL；
- **reward model**：冻结，仅前向打分。

粗略估算一个 \(N\) 参数模型使用 Adam 混合精度训练的静态状态：

```text
bf16 参数       2N bytes
bf16/FP32 梯度  2N 或 4N bytes
FP32 master     4N bytes（实现相关）
Adam m, v       8N bytes
```

常见面试估算会得到约 16N bytes，再加激活、临时 buffer、通信和碎片。不要把“16 bytes/参数”当成所有框架永远固定的真理，要先声明精度和优化器实现。

## 3. 并行与显存优化

- **DP/DDP**：每卡完整模型，数据不同；梯度同步。
- **ZeRO/FSDP**：切分优化器、梯度和参数，降低静态显存。
- **TP**：切分单层矩阵计算，通信频繁，适合单模型放不下一卡。
- **PP**：按层切分，注意流水线气泡。
- **CP/SP**：沿序列维切分，长上下文更常见。
- **activation checkpointing**：用重算换激活显存。
- **offload**：把状态移到 CPU/NVMe，用带宽与延迟换显存。

RL 还多一个部署选择：训练模型与推理引擎共卡（colocate），或拆成独立集群（disaggregate）。前者省卡但切换复杂，后者弹性好但权重同步成本高。

## 4. 同步、异步与部分 rollout

### 4.1 同步

等整批轨迹完成再训练。语义清晰、policy lag 小，但最慢轨迹决定整个 batch 的耗时。

### 4.2 异步

rollout 与 trainer 独立运行。GPU 利用率更高，但旧样本增多。至少要记录：

- `rollout_policy_version`；
- 样本生成时间和训练时间；
- current/behavior policy ratio；
- 样本被裁剪或丢弃的比例。

量化参照（[AReaL 论文](https://arxiv.org/abs/2505.24298)，清华 IIIS+蚂蚁）：全异步系统靠"可中断 rollout worker + 版本号追踪 + staleness 上限 + staleness-aware PPO"实现同卡数下 2.57× 于最好同步系统的吞吐，且实验显示样本陈旧度控制在 **8 个版本以内**时性能无损。面试答"异步的代价"时给这三件套：版本差上限、current/behavior ratio 监控、超龄样本过滤。

### 4.3 Partial rollout

长轨迹未结束时保存状态，之后继续，而不是让 worker 一直占着批次。恢复时必须保存 RNG、环境状态、上下文和 policy 语义；否则续跑轨迹不是同一分布。

## 5. 训练框架怎么选

| 框架 | 适合起点 | 优势 | 使用时要追问 |
|---|---|---|---|
| [TRL](https://huggingface.co/docs/trl/main/) | 单机/小规模验证算法 | API 简单，DPO/GRPO/PPO 上手快 | 数据格式、生成后端和多机上限 |
| [verl](https://verl.readthedocs.io/) | 大规模 PPO/GRPO、系统研究 | rollout 与训练编排完整，配置丰富 | worker 角色、资源池、权重同步 |
| [slime](https://thudm.github.io/slime/) | 大规模 RL、Agent rollout | 强调训练与推理解耦、可定制 rollout | 异步语义、样本版本与自定义环境 |
| [OpenRLHF](https://openrlhf.readthedocs.io/) | 分布式 RLHF 工程 | Ray 编排、多种对齐算法 | actor/critic/reward/reference 如何放置 |
| [AReaL](https://github.com/inclusionAI/AReaL) | 大规模异步 reasoning/Agent RL（清华+蚂蚁） | 全异步解耦、可中断 rollout、staleness-aware PPO；轻量版 AReaL-lite | 版本追踪与 `max_head_offpolicyness`、经验缓冲、权重同步协议 |
| [ROLL](https://github.com/alibaba/ROLL) | 大规模多任务/Agentic RL（阿里） | Ray 多角色解耦、RewardWorker 奖励路由（verifier/沙盒/LLM-judge）、内置 GRPO/GSPO/REINFORCE++/GiGPO | 角色资源映射、异步语义、StarPO vs GiGPO 两种 Agent 范式 |
| [Agent Lightning](https://microsoft.github.io/agent-lightning/stable/) | 已有 Agent 接入 RL | 把 Agent 执行与训练解耦 | 轨迹 schema、credit assignment、adapter |

框架不是简历上的名词。面试官更关心：你改过哪一层、看过哪些中间张量、遇到过什么故障、如何证明修复有效。

## 6. 指标分四层看

### 6.1 任务质量

- reward mean、分位数和分项 reward；
- pass@1 / success rate / win rate；
- 独立验证集结果；
- 长度、工具次数、成本和安全指标。

### 6.2 策略更新

- policy loss；
- KL(policy, reference)；
- approximate KL(current, old)；
- clip fraction；
- entropy；
- importance ratio 的均值、方差和分位数；
- gradient norm。

### 6.3 数据与 advantage

- 每组 reward 方差；
- 全对组、全错组比例；
- advantage 均值、标准差、正负比例；
- response length 与 reward 的相关性；
- 各失败类型占比；
- 有效 token 比例。

### 6.4 系统性能

- rollout tokens/s、training tokens/s；
- 每阶段耗时；
- GPU utilization 与 memory；
- 最长/中位轨迹耗时；
- 推理队列长度与 trainer 等待时间；
- 权重同步时间、样本年龄和故障重试率。

只报一个总 reward 会掩盖大多数问题。

## 7. 高频故障的诊断树

### 7.1 Reward 上升，真实评测下降

先查：

1. 是否利用 verifier 漏洞；
2. reward 是否偏爱长度、格式或模板；
3. 训练集与评测集是否泄漏；
4. reward model 是否超出训练分布；
5. 独立人评/隐藏测试是否同步下降。

措施：修 verifier、加入对抗样本、拆分 reward 分项、设成本约束，并用独立评测闭环。

### 7.2 KL 突然增大

检查学习率、PPO epoch、clip range、reward scale、advantage normalization、旧权重同步和数据是否陈旧。降低学习率或 epoch 只是止血，必须定位分布为何突然变化。

### 7.3 Clip fraction 长期很高

说明更新太大或样本太旧。检查 ratio 的 log-space 计算、old/current policy 是否对应、异步 policy lag、每批更新次数和学习率。

### 7.4 Entropy 快速下降

可能是策略过早坍缩、reward 过尖、采样温度太低或熵奖励不足。还要分 token 位置看：最终答案格式固定导致的低熵不一定有害。

### 7.5 Reward 不动

检查 verifier 是否几乎恒定、全对/全错组比例、数据难度、response mask、reward 是否正确广播，以及 optimizer 是否真的更新。GRPO 中全组同分是首要怀疑对象。

### 7.6 Loss NaN

按顺序查：

- reward/advantage 是否有 NaN/Inf；
- group std 是否加 epsilon；
- log-prob 差是否过大后直接 `exp`；
- softmax/log-softmax 是否用稳定实现；
- 混合精度 overflow；
- gradient norm 与异常 batch；
- mask 分母是否为零。

先保存首个异常 batch 和中间张量，不要只靠重启训练碰运气。

### 7.7 OOM

区分静态状态、激活、KV cache、生成长度长尾和内存碎片。记录峰值发生在 rollout 还是 training，再决定缩 batch、限制长度、checkpoint、ZeRO/FSDP 或调整资源放置。

### 7.8 吞吐突然下降

看输入/输出长度分布、慢工具、队列阻塞、数据加载、通信、权重同步和节点故障。均值正常时也要看 P95/P99，因为 Agent rollout 的长尾最容易拖住同步训练。

## 8. 三组容易混淆的 KL

### 8.1 对 reference 的 KL

限制策略不要偏离初始对齐模型太远，主要是正则目标：

\[
D_{KL}(\pi_\theta\Vert\pi_{ref})
\]

### 8.2 对 old policy 的变化

PPO ratio 比较 current 与采样时 old policy，控制单次更新步长。

### 8.3 监控用 approximate KL

实践中常用样本上的 log-prob 差近似监控 current 与 old 的变化。它与 reference KL 目的不同，名字相似但不能混答。

## 9. 一次排障要留下什么证据

推荐最小实验记录：

```text
代码 commit + 配置 hash + 模型 checkpoint
数据版本 + prompt IDs
rollout policy version
随机种子与环境版本
核心曲线 + 分位数
首个异常 batch 的张量统计
修复前后单变量对照
独立评测结果
```

“改了参数后好了”不是可复现结论。至少做一个只改变单个因素的对照。

## 10. 面试中的 90 秒系统回答

> 我会把系统拆成 rollout、reward/verifier、advantage 与 trainer 四段。rollout 侧记录行为策略版本、old log-prob 和完整 mask；PPO 还需要 critic，GRPO 用同 prompt 多样本的组内相对奖励。训练侧分别监控任务 reward、reference KL、old-policy ratio/clipfrac、entropy、advantage 有效率和梯度。系统指标看 rollout/training 吞吐、长尾与权重同步。如果 reward 上升但真实评测下降，优先怀疑 reward hacking 或分布偏差；如果 clipfrac 高，优先核对 old/current 语义、学习率和 policy lag。大规模 Agent 任务会把 rollout 异步化，但会显式限制样本年龄并保留环境快照以便重放。

## 11. 本章自测

1. 7B 模型用 Adam 训练时，为什么不能只按 14 GB 估算？
2. reference KL 和 current/old ratio 分别解决什么问题？
3. 异步 rollout 的吞吐收益和统计代价是什么？
4. reward 上升、KL 正常但真实评测下降，应先查什么？
5. 如何区分训练 OOM 与 rollout KV cache OOM？
6. 你使用过的框架中，policy 权重怎样同步给推理引擎？
---

原始讲义与可运行材料：[GitHub 源文件](https://github.com/keepkeen/llm-algo-job-notes/blob/main/%E7%AC%94%E8%AF%95/AI%E7%AE%97%E6%B3%95/%E5%BC%BA%E5%8C%96%E5%AD%A6%E4%B9%A0/08_%E8%AE%AD%E7%BB%83%E7%B3%BB%E7%BB%9F_%E6%A1%86%E6%9E%B6_%E6%8C%87%E6%A0%87%E4%B8%8E%E6%8E%92%E9%9A%9C.md)。
