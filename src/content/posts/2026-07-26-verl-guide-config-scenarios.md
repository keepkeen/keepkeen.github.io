---
title: "verl 配置方法与真实训练场景"
description: "从 Hydra 配置树和 batch 约束出发，给出数学、代码、Agent 与大模型训练方案。"
date: 2026-07-26
tags:
  - verl
  - hydra
  - llm-rl
  - configuration
lang: zh-CN
featured: false
draft: false
series: verl-interview-guide
seriesOrder: 8
---

## Hydra 配置怎么读

根配置 [`verl/trainer/config/ppo_trainer.yaml`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/trainer/config/ppo_trainer.yaml) 用 defaults 将组件装到配置树，例如 actor 到 `actor_rollout_ref.actor`、rollout 到 `actor_rollout_ref.rollout`。示例 shell 脚本用命令行 override 参数。读一个命令时按以下顺序归类：

1. 数据与长度。
2. 模型路径、tokenizer/processor、LoRA。
3. rollout 采样与推理并行。
4. actor/critic 优化与 micro-batch。
5. 算法 estimator、KL、loss。
6. 资源节点/GPU 与 trainer mode。
7. 日志、评测、checkpoint。

不要从上到下机械背参数；先知道它属于哪个角色。

## 六组最关键的 batch 概念

- `train_batch_size`：一个逻辑训练 step 的 prompt 数，GRPO 展开后响应数约为它乘 `rollout.n`。
- generation batch：一次送去生成的 prompt 数，V1 过滤/异步下可与 train batch 不同。
- PPO mini-batch：一次 optimizer 迭代使用的逻辑数据块。
- micro-batch：单次前后向能放进显存的数据。
- max token length per GPU：动态 batch 时用 token 总量而不是样本条数限制负载。
- rollout max batched tokens / sequences：推理服务调度上限。

面试时说明这些量分别作用于算法统计、optimizer 和设备执行，不能互相随便替换。

## 从零跑通一个数学 GRPO

推荐流程：

1. 选小模型和现成 [`examples/grpo_trainer/`](https://github.com/verl-project/verl/tree/18a55518540f92588111a0ee48dcf0abf8fe3172/examples/grpo_trainer) 脚本。
2. 预处理极小数据集，人工检查 20 条 prompt/chat template。
3. 单独调用 reward function 测正确、错误、格式异常和截断答案。
4. 先单机 V1 sync，较小 `train_batch_size`、`rollout.n` 和 response length。
5. 关闭非必要异步、复杂 offload 和高级 kernel，跑 2～5 step。
6. 查看同一 `uid` 的多条 response、reward、advantage 是否有差异。
7. 再逐步增加 batch/长度，打开 dynamic batch/remove padding。
8. 最后才扩多机或换异步。

关键配置关系而非固定数值：`adv_estimator=grpo`、`rollout.n>1`、critic 不需要、reward 可验证、组内 reward 有差异。

## 场景一：代码生成 RL

约束：执行单测昂贵且有安全风险，reward 延迟长尾，错误类型复杂。

方案：规则 reward + sandbox；记录 compile error、timeout、test pass、format 分量；Agent/RewardLoop 并发执行；先同步验证正确性，长尾显著且有独立资源时再 separate async。

指标：有效编译率、测试通过率、sandbox timeout、reward p50/p95/p99、截断率、每秒完成轨迹数。风险：模型利用测试漏洞、非确定性测试、外部依赖污染、旧策略样本过多。

## 场景二：多轮搜索 Agent

约束：轮数和工具 latency 变化大，真实 token 必须保留，环境失败不等于策略失败。

方案：AgentLoop + stateful tool；tool observation mask；sticky session；限制最大轮数/总 token/工具并发与超时；单独奖励最终正确性、合法 tool call 和成本。

指标：task success、平均/分位轮数、tool error、token cost、policy token 比例、版本陈旧度。风险：模板重编码、工具输出过长、模型伪造 observation、异步长尾拖垮 buffer。

## 场景三：70B 模型、8×80GB

先判断是否必须 full fine-tune。LoRA + FSDP2 往往是更现实起点；使用 activation checkpoint、reshard、必要的 optimizer/parameter offload，并严格控制 response length 和 KV cache。rollout TP 以“模型能装下后尽量保留 DP 并发”为原则，不盲目拉满 8。

若 full fine-tune 仍 OOM，应量化各项显存而不是继续随机开 flag：参数、梯度、optimizer、activation、临时 all-gather、rollout weights、KV cache、CUDA graph。

## 场景四：超大 MoE 多机

优先 Megatron，多维并行按物理拓扑映射：跨节点通信昂贵的维度要谨慎；EP all-to-all 特别依赖网络。先验证 checkpoint/权重转换和单 step correctness，再扩规模。监控 expert load balance、straggler、通信时间和 MFU。

## 场景五：吞吐优先的生产训练

先在 sync 模式建立正确性与样本效率 baseline，再用 stage timing 确认瓶颈：

- rollout 慢：增加服务副本、调 TP/DP、batch token、KV cache、prefix cache。
- reward 慢：并发/批处理、独立资源、缓存可重复 verifier。
- train 慢：dynamic batching、remove padding、micro-batch、后端并行。
- 同步慢：共置/分离拓扑、checkpoint engine、同步频率。

切异步后同时报告 wall-clock reward/评测提升和数据陈旧度，不能只报告 tokens/s。

## Checkpoint 与恢复

checkpoint 不只是模型权重，还可能包含 optimizer、scheduler、RNG、dataloader 和 global step。V1 会保存/恢复 StatefulDataLoader；TransferQueue checkpoint 仅在异步 mode 且所装 TQ 版本支持相应 API 时保存，不能视作无条件保证。恢复时 pending/running prompts 会被重新发出，因此 verifier/tool 必须能处理重试或幂等。配置 `resume_mode` 支持自动、禁用和指定路径；分布式文件系统还需确认所有节点可见与原子写入。

参考 [`docs/advance/checkpoint.rst`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/docs/advance/checkpoint.rst)。

训练 checkpoint 的首要目标是 resume，不能先假定它可直接部署。应先检查 checkpoint layout/manifest：FSDP 分片用 `python -m verl.model_merger merge --backend fsdp ...`；仅纯 Megatron `model/dist_ckpt/` 用 `--backend megatron`，大模型可分布式 merge；当前推荐的 mbridge Megatron 默认已产出可直接加载的 `model/huggingface/`，无需再 merge。导出后应做 tokenizer/config、固定输入 logits 或 generation、权重版本和独立评测检查。完整流程见 [从数据到模型导出的实战闭环](/blog/verl-guide-data-to-model-export/)。

## Validation 是独立数据流

V1 validation 使用独立 TQ partition 和 rollout `val_kwargs`，不应盲目复用训练时的 temperature/top-p。多轮任务以每个 session 的最终输出计入评测；指标可按 data source 和 reward component 聚合，并可输出 generation table/JSONL。

常用控制包括 `val_before_train`、`val_only`、`test_freq` 和 rollout `val_kwargs`。可信评测应固定或明确记录采样次数、seed、verifier 版本与数据分层；总均值之外必须查看各 source 和失败类型。

## 配置变更的安全顺序

1. 一次只改变一个维度。
2. 保存 resolved config 和版本信息。
3. 先跑短 smoke test。
4. 对比数据/token/reward，而不仅是 loss。
5. 再做规模和性能实验。

这套顺序本身就是很好的场景题回答。
