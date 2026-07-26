---
title: "verl 高频面试题与回答框架"
description: "覆盖定位、架构、算法、系统性能、数据奖励与落地场景的 40 道高频题。"
date: 2026-07-26
tags:
  - verl
  - interview
  - llm-rl
lang: zh-CN
featured: false
draft: false
series: verl-interview-guide
seriesOrder: 11
---

建议先遮住答案口述，每题控制在 1～3 分钟。回答架构题用“问题 → 抽象 → 数据流 → 取舍”，场景题用“约束 → 方案 → 指标 → 风险”。

## 基础与定位

### 1. verl 是什么，核心价值是什么？

它是 LLM RL 后训练的分布式框架。核心价值不是某一个 PPO loss，而是用单控制器表达灵活算法流，并解耦角色、资源、训练后端和推理后端；同时解决 actor 训练与 rollout 生成之间的设备复用、显存切换和权重同步。

### 2. 为什么不能直接用普通 PyTorch 训练循环？

因为一轮 RL 同时包含变长大规模生成、规则/模型 reward、多个模型 forward、分布式优化和频繁权重同步。它们使用不同并行策略与显存状态，还可能跨节点异步。普通循环能做小实验，但很快遇到资源编排和吞吐瓶颈。

### 3. HybridFlow 的“hybrid”体现在哪里？

一是 hybrid-controller：driver 的集中控制流与 worker 的分布式 SPMD 计算结合；二是 hybrid engine：actor 训练和 rollout 推理在同一 GPU 池分时复用，并在不同权重/显存布局间转换。

### 4. V0 与 V1 的关系？

V0 `RayPPOTrainer` 是经典 DataProto 经过单 controller 的同步实现，容易读但已 deprecated。当前默认 V1 使用 TransferQueue/replay buffer，并提供 sync、colocate async、separate async。算法依赖基本相同，数据调度更细粒度。

## 架构

### 5. Role、Worker 和 WorkerGroup 有什么区别？

Role 是 Actor/Critic 等逻辑职责；Worker 是一个 Ray 进程中的实际执行对象；WorkerGroup 是多个 worker 的群组抽象，负责远程方法、rank dispatch 和结果聚合。三者解耦后，Trainer 不绑定 Ray RPC 或 FSDP/Megatron 实现。

### 6. ResourcePool 和 placement group 分别做什么？

ResourcePool 是 verl 的角色到逻辑 GPU 布局映射；Ray placement group 把一组 CPU/GPU bundle 原子地预留和调度。多个角色映射到同 pool 才有共置基础。

### 7. DataProto 为什么分三部分？

TensorDict 放可批处理张量，non-tensor batch 放文本、ground truth 等 object 数据，meta_info 放调用控制信息。这样既保留统一 batch 操作，又不强迫所有业务数据 tensor 化。

### 8. TransferQueue 解决什么问题？

它按 trajectory key 跟踪生产/消费状态，并使用可插拔存储。AgentLoop 在一条 trajectory 完成后批量写入 rollout 字段，后续阶段选择性读取和追加字段；不同 trajectory 可独立完成，从而减少完整 batch 都经单 controller 的瓶颈，并支持异步流水和自定义 sampler。

### 9. actor、rollout、ref 为什么可以在一个 Worker 里？

它们共享同一基础模型权重，但处于训练、推理和冻结参考三种语义。共置可减少 GPU 和网络传输；Worker 内统一管理 offload、reshard、LoRA/ref 语义和 rollout sleep/wake。

## 算法

### 10. PPO 中 old policy 和 reference policy 是一回事吗？

不是。`rollout_log_probs` 来自实际生成策略；decoupled 模式在训练 batch 前重算并冻结 `old_log_probs` 作为 ratio 分母，bypass 模式才直接使用 rollout 值；reference policy 通常是冻结初始/SFT 策略，用于 KL。异步时可能同时有 rollout、old、current 三个版本。

### 11. GAE 为什么需要 critic？

GAE 用 `V(s_t)` 和 `V(s_{t+1})` 构造 TD residual，再做 lambda-return 递推。没有 value 无法按该公式得到 advantage。critic 降低方差，但增加模型、优化器和误差来源。

### 12. GRPO 为什么通常不需要 critic？

它用同 prompt 多条回答 reward 的组内均值/标准差作 baseline。代价从训练 critic 转移到多 rollout，并要求 verifier 能让组内形成有效差异。

### 13. GRPO 与 RLOO 的区别？

GRPO 对每个样本减完整组均值，通常再除组标准差；RLOO 对样本 i 减“排除 i 后其余样本均值”。RLOO 不是简单关闭 GRPO 标准差归一。

### 14. ReMax 的 baseline 是什么？

同 prompt 的额外 greedy rollout reward，而不是 critic 或组均值。因此会增加一次确定性生成成本。当前完整 baseline 数据准备仅见 V0；默认 V1 不能只设置 ReMax estimator 就直接运行。

### 15. DAPO 相比 GRPO 增加什么？

它是 recipe 组合：Clip-Higher、动态过滤全对/全错组、token-level loss aggregation、overlong soft punishment 等。不能只设置一个 estimator 就声称实现完整 DAPO。

### 16. KL 放 reward 和放 loss 有何区别？

放 reward 会先改变 token reward，从而影响 advantage/return；放 loss 只在 actor objective 中直接约束当前策略。两者同时开可能重复惩罚，任一路径通常都需要 reference log-prob。

### 17. 为什么 loss aggregation 影响长度偏置？

严格说 `token-mean` 是全局每 token 等权，并非“每条长回答天然获得固定更大权重”的独立样本目标；`seq-mean-token-sum` 才明确让序列内 token 累加，`seq-mean-token-mean` 使非空序列近似等权，`sum-norm` 再用固定尺度归一。可变长任务中，分母就是目标的一部分。

## 系统与性能

### 18. Colocate 有什么收益和风险？

收益是省 GPU、减少权重跨节点传输；风险是训练状态与 KV cache 竞争、频繁切换和阶段无法完全重叠。正确性依赖严格的 rollout sleep、actor restore/update、weight sync、actor offload、rollout wake 顺序。

### 19. FSDP2 与 Megatron 怎么选？

HF 模型、接入速度、dense 中大型规模优先 FSDP2；超大 dense/MoE、需要 TP/PP/CP/EP 和高性能多维并行时选 Megatron。最终取决于模型、上下文、网络拓扑、权重转换能力，而非固定优劣。

### 20. rollout TP 为什么不是越大越好？

TP 增大让模型可装下、单请求算得更快，但通信增加并减少可用 DP 副本。生成有大量独立 prompt 时，更多 DP 往往更能提升总吞吐。要结合 KV cache 和长度分布压测。

### 21. 异步训练最大风险是什么？

轨迹由旧版本策略生成，current/old log-prob 差异增大，破坏近似 on-policy 假设。需要 model version、同步频率、off-policy threshold、drop/wait 策略和 rollout correction；评价要看 wall-clock 学习效果，不只吞吐。

### 22. 权重同步需要保证什么？

完整性、版本原子性、布局转换正确、同步与请求边界一致、失败可检测。若一个 rollout server 混到不同版本分片，可能不崩溃却生成错误数据，因此 checksum/版本确认很重要。

### 23. 为什么变长序列导致 straggler？

data-parallel rank 按样本数平均不代表按 token/FLOPs 平均，最长 rank 决定 collective 完成时间。verl 可按序列长度重排、dynamic batch 和 token budget 缓解。

### 24. 第一步如何定位性能瓶颈？

先看 stage timing、tokens/s/GPU、per-token latency、rank imbalance 和 weight sync 占比；确认是 rollout、reward、train、data 还是 sync，再用 profiler 深挖。不要一开始就随机调 TP 或显存比例。

## 数据、奖励与 Agent

### 25. outcome reward 为什么常放最后一个 token？

它评价整条回答，在 token-shaped tensor 中放在最后有效 response token 最自然。GAE/ReMax/REINFORCE++ 用时间递推或 reward-to-go 传播；GRPO/RLOO 先汇总序列 reward，再把组相对标量广播到 action token，并非 token-level temporal credit assignment。mask 保证 padding 不参与。

### 26. 多轮对话为什么不能最后重新 tokenize？

重新套 chat template 可能改变特殊 token、空格或工具格式，使训练时 token 不等于 rollout 实际采样 token，old/current log-prob 不再可比，PPO ratio 与 KL 会失真。

### 27. 工具返回 token 是否参与 loss？

通常不参与，因为它们是环境 observation，不是策略动作；但应保留在 attention context。模型生成的 tool call token 应参与，否则学不会调用工具。

### 28. 如何防 reward hacking？

拆分并记录 reward components，使用独立 held-out verifier/人工评测，加入恶意和边界样本，sandbox 隔离，避免易伪造代理指标，并监控长度、格式和行为分布漂移。

## 场景题

### 29. 让你用 8 卡做数学 GRPO，如何落地？

从现成小模型 FSDP2 + vLLM sync recipe 起步；校验数据模板和规则 reward；设置多采样并检查 uid 分组；小 batch 跑通 2～5 step；监控组内 reward、advantage、KL/clip 和截断；再开 dynamic batch/remove padding，最后扩长度和规模。

### 30. Reward 上升但线上效果下降，怎么查？

先冻结训练，比较 held-out 指标和真实样例；分解 reward component、长度/格式/工具行为变化；检查 train/eval 模板与 verifier 泄漏；确认不是权重同步或 checkpoint 版本错。若为 hacking，修 reward/数据而非继续调学习率。

### 31. 多机训练偶发 hang，怎么定位？

从 Ray 资源/placement 与模型 collective 分层。若 actors 未全启动，查 bundle 和节点资源；若已进入训练后 hang，找首个异常 rank、NCCL collective 顺序、空 batch/异常分支、网络接口和 timeout；用短复现和有限 debug 日志定位。

### 32. OOM 但 GPU 平均利用率不高，为什么？

OOM 看峰值而非平均利用率。可能在权重 all-gather、optimizer step、checkpoint full state、LoRA merge、rollout CUDA graph 或 KV cache 恢复时瞬时叠加。必须按时间点做显存快照并区分阶段。

### 33. Decoupled 与 Bypass rollout correction 有什么区别？

Decoupled 保留 rollout、old、current 三策略：训练前重算 old anchor，并可对 rollout→old 偏移做 token/sequence IS 或 rejection sampling。Bypass 直接令 old=rollout，只保留 rollout/current 两策略，可用 PPO ratio 或显式 IS 的 REINFORCE loss；`separate_async` 当前强制 bypass。

### 34. V1 三种 mode 与 fully async 是什么关系？

sync、colocate_async、separate_async 是 V1 的三个 trainer mode。[`experimental/fully_async_policy`](https://github.com/verl-project/verl/tree/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/experimental/fully_async_policy) 是独立入口和架构，以 MessageQueue、Rollouter、Trainer、ParameterSynchronizer 支持 streaming/partial rollout；不能称为第四种 V1 mode。

### 35. On-policy distillation 与 reference policy 有何区别？

teacher 提供 response-token log-prob 等学习目标；只有 `forward_kl_topk` 模式返回 top-k token ids/log-probs。teacher 可有独立资源池、多 teacher 并按 data source 路由；蒸馏项可直接进 loss 或走 policy-gradient，并可混合 task reward。reference policy 通常冻结，只用于 KL 约束策略漂移。

### 36. 怎样设计可信的 validation？

使用独立 val partition 和 `val_kwargs`，明确温度、采样次数和 seed；多轮只统计最终 session output；按 data source/reward component 分层，并保存 generation 样例。`val_before_train` 先验证基线，`test_freq` 控制训练中评测。

### 37. V1 checkpoint 是否一定恢复 TransferQueue 中所有轨迹？

不是。actor/critic、StatefulDataLoader 等有各自状态；TQ checkpoint 只在异步 mode 且依赖版本支持时保存。恢复时 pending/running prompt 会重发，因此工具/verifier 需幂等，并应检查 rollout 权重版本与重复样本。

### 38. 相同 config 两次运行为何仍不一致？

seed 只控制部分随机源。continuous batching、请求路由、工具延迟、reward 并发和非确定 kernel 都会改变轨迹。full determinism 有性能和后端限制，目前不能对 SGLang/TRT-LLM 或 multi-turn/tool 一概承诺 bitwise 复现。

### 39. RLOO 组大小为 1 会怎样？

当前实现不会报错，而是保留原始 reward，静默偏离 leave-one-out 定义。因此必须在数据/采样配置层保证每组至少两条，并监控实际 group size。

### 40. 为什么 DAPO 动态过滤不能直接依赖普通 colocated RM？

group refill 在 replay-buffer sampling 前就要知道 reward metric；普通 colocated RM 是 sample 后才计算。应使用规则/流式 reward，或让 reward model 启用独立 resource pool，使指标在筛选时可用。

## 反问面试官可用的问题

- 你们的 reward 是可验证 outcome、process reward 还是 reward model？
- rollout、reward 和 train 的 wall-time 占比分别是多少？
- actor/rollout 采用共置还是分离，权重同步如何做？
- 当前最大问题是样本效率、吞吐、稳定性还是可观测性？
- 多轮任务如何保证 token/log-prob 一致和环境可复现？

这些问题能快速暴露真实系统约束，也让讨论从背概念进入工程设计。
