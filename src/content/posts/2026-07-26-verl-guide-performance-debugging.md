---
title: "verl 性能分析、稳定性与排障"
description: "按阶段时间、显存、通信、数值、训推不一致和奖励问题建立可复用的诊断流程。"
date: 2026-07-26
updatedDate: 2026-08-29
tags:
  - verl
  - performance
  - debugging
  - distributed-systems
lang: zh-CN
featured: false
draft: false
series: verl-interview-guide
seriesOrder: 9
---

## 先建立阶段时间账本

一轮 RL 的 wall time 可粗分为：数据准备、rollout、reward、old/ref/value forward、advantage、critic update、actor update、权重同步、checkpoint/validation。先看 `timing_s/*`，再钻到某一后端；否则很容易优化了只占 5% 的环节。

常用指标：

- 系统性能：end-to-end/stage time、prompt/response tokens、tokens/s/GPU、per-token rollout latency、KV cache、MFU、weight sync、rank token imbalance。
- 学习正确性：score/reward、advantage/return、actor ratio/clip fraction/KL/entropy、critic loss 与 explained variance。
- 数据质量：response clip/abort、有效 mask 比例、reward component、失败/过滤/refill 数。
- 异步：model-version span、staleness、drop/wait、importance weight、rejection/有效样本率。
- separate-async 借卡：`switch_wait`、`switch_to_rollout`、`switch_to_trainer`、实际 `wait_samples`、sampleable count、remaining、阈值比例、收益/切换成本与最终 decision。
- Agent/MoE：turn/tool 调用与错误/延迟、expert load balance、跨 rank 负载。

指标定义入口：[`verl/trainer/ppo/metric_utils.py`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/trainer/ppo/metric_utils.py)（`compute_data_metrics` 429 行起、`compute_timing_metrics` 611、`compute_throughout_metrics` 655、MoE 负载均衡指标 274/312）。启用 rollout correction 时还有 `rollout_corr/*` 系列指标（rollout/old 两分布的 KL、k3_kl、训练/rollout PPL 及其差、χ²、IS 权重均值/极值/有效样本率 ESS、RS 掩蔽比例），是诊断训推不一致与异步陈旧度的第一入口。

## OOM 分类

### rollout OOM

常见原因：`gpu_memory_utilization` 过高、max batched tokens/sequences 过大、长 response 导致 KV cache 激增、CUDA graph 捕获、TP 太小、共置状态未正确释放。

处理顺序：确认发生阶段 → 降并发/token budget → 核对 max length → 调 KV cache 比例 → 检查 sleep/offload/reshard → 再改变 TP 或硬件。

### train forward/backward OOM

降低 micro-batch 或 per-GPU token budget；开 activation checkpoint/remove padding；核对 sequence parallel；必要时 CPU offload。不要先降全局 train batch，因为可以保持算法 batch、只增加 gradient accumulation。

若 profiler 显示 actor 在 old-log-prob/update 前后的 CPU↔GPU 整模迁移形成空洞，当前 FSDP2 helper 已使用 pinned CPU storage + non-blocking copy；这项优化只覆盖 FSDP2 的 whole-model transfer，不应外推到 FSDP1、optimizer offload 或 Megatron。确认依赖/硬件真正走异步拷贝，再判断剩余瓶颈。

### optimizer/checkpoint OOM

检查 optimizer state 分片/offload、保存时是否召回 full state dict、LoRA merge、峰值临时 tensor。OOM 发生在保存步骤通常不是训练 activation 问题。

## GPU 利用率低

可能是 CPU tokenization/reward、Ray object copy、数据长尾、固定 micro-batch padding、TP 通信或频繁权重同步。用 stage timing 和 profiler 区分：

- GPU 有周期性长空洞：阶段串行或数据未就绪。
- 某一 rank 总是晚：长度不均或硬件/网络 straggler。
- rollout 单请求快但总吞吐低：DP 副本/调度 batch 不足。
- train kernel 很密但 MFU 低：小矩阵、通信占比或 checkpoint 重算。
- separate async 的 hybrid GPU 大段空闲、standalone rollout 忙：先调资源比例；仍有稳定 `timing_s/gen` 等待，再试 step-boundary 借卡并把切换成本纳入收益。

## Ray 启动或 placement 卡住

检查实际集群资源、placement group bundle 是否能同时满足、每节点 GPU 配置、角色是否错误共用/拆分 pool。Ray 能看到 GPU 不等于 NCCL 网络正确；若 actor 已启动后 collective 卡住，再查 rank/world size、网卡、端口和驱动。

## NCCL hang

典型表现是所有进程等 collective、只有部分 rank 报错。核对：各 rank 是否走到相同调用、batch 是否为空/异常提前退出、模型并行拓扑一致、网络接口、timeout 和首个失败 rank。开启 NCCL debug 会产生大量日志，应窄化到短复现并保存首个异常，不要只看最后的 watchdog timeout。

## 训练数值异常

推荐排查顺序：

1. token 与 response mask。
2. reward components 与异常值。
3. 同 `uid` 分组及 advantage 分布。
4. rollout/old/current/ref log-prob 是否对应同一 token 和模型版本。
5. ratio、clip fraction、approx KL、entropy。
6. grad norm、学习率、optimizer。

如果 ratio 在第一次 epoch 就远离 1，优先怀疑 token/log-prob/版本不一致，而不是立刻调 clip epsilon。

一个 2025 年后必须纳入排查清单的项：**训推不一致**。同权重下 rollout 引擎与训练引擎的 log-prob 天然存在数值差异（算子/精度/并行导致），长序列上会累积成显著的分布偏移。特征是训练一段时间后 KL(rollout‖train) 缓慢增长、梯度尖刺、reward 崩塌；MoE 模型和长 CoT 尤其敏感。缓解手段：开 rollout correction（sequence-level TIS/掩码优先于 token-level）、检查 lm_head 等关键层精度（社区案例：固定 FP32）、必要时走 batch-invariant/determinism 路径做工程对齐。

## Reward 不涨

- reward 是否真的区分好坏，是否大部分组全对/全错；
- 是否被格式或长度分量主导；
- rollout 温度与 `n` 是否产生足够探索；
- advantage whitening 后是否几乎为零；
- actor update 是否实际执行，grad norm 是否非零；
- validation 与 train reward 是否同分布；
- checkpoint/权重同步后 rollout 是否确实加载新 actor。

## Reward 涨但能力下降

这是 reward hacking 的典型信号。看 held-out verifier、人工样例、回答长度/格式变化和不同 reward component。训练 reward 不是最终 KPI；必须保留独立评测集和不参与优化的 judge。

## 多轮任务异常

- tool call 成功但 loss 异常：检查 tool observation mask。
- KL/ratio 离谱：检查是否重新 tokenize messages。
- 大量超长：工具返回截断、最大轮数和总 token budget。
- 利用率低：tool p99 latency、并发限制、sticky session 倾斜。
- success 波动：环境非确定性、失败重试是否改变 reward。

## Profiling 策略

先用框架 timing 找阶段，再用 PyTorch profiler/Nsight 找 kernel/通信。只 profile 少数稳定 step，避开模型初始化和 checkpoint；多 rank 时先选代表 rank。框架支持 nsys、torch、torch_memory 等配置，见 `global_profiler` 和 [`docs/perf/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/docs/perf)。

当前 profiler 还支持：

- `relocate_results=true` 把 Ray 固定目录与 rollout 子目录中的 trace 汇总到 `save_path`；
- `finish_hook_cmd` 在最后一个 profile step 后执行一次，可上传/登记整目录，配合 `finish_hook_ranks` 选择每节点一个 rank，避免重复上传；
- Torch profiler 的 mini-batch schedule 与 `record_function("micro_batch<i>")`，能把 forward-only/训练的细粒度空洞标出来；
- V1 会去重 colocated alias worker group，并覆盖 hybrid 与 standalone rollout managers。

代码当前输出的借卡等待量指标是 `separate_async/switch/wait_samples`；上游异步文档一处仍写 `sample_wait_seconds`，做 dashboard 时应以目标 commit 的实际 metric key 为准。若 torch trace 只有 CPU op 没有 CUDA kernel，还要检查 CUPTI subscriber 冲突；verl 在 torch profiler 模式下会处理 `NVTX_INJECTION64_PATH`，除非显式设置 `VERL_KEEP_NVTX_INJECTION=1`。

线上/长任务可用 RL-Insight 把 scalar、rollout/TQ 状态与 Agent session/span trace 关联；但 trace 是定位工具，不替代独立训练指标和原始样本留存。

## 结果不可复现

只设置 seed 不保证分布式 rollout bitwise 一致：continuous batching 的请求组合、路由、工具延迟、reward 并发和非确定 kernel 都会改变结果。仓库的 full determinism 会传播确定性环境变量并启用 vLLM batch-invariant 路径，但有性能代价和明确边界；当前 SGLang/TRT-LLM、multi-turn/tool 场景不能据此承诺完整 bitwise reproducibility。

排查时先区分“统计结果在合理方差内”与“必须逐 token 一致”。后者需要固定模型/依赖/硬件、数据顺序、请求路由、reward 执行顺序和 checkpoint 状态，并按 [`docs/advance/determinism.md`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/docs/advance/determinism.md) 的支持矩阵验证。

## 一套面试可复用的排障回答

> 我先确认问题发生在哪个阶段和哪类资源，再构造最小短复现。正确性问题先追单个 uid 的 token、mask、reward、log-prob 和 model version；性能问题先分解 stage time、token throughput 和 rank imbalance；OOM 按 rollout KV cache、训练 activation/optimizer、权重同步峰值分类。每次只改一个参数，用 resolved config 和短 checkpoint 保证可比较，最后用独立评测确认优化没有牺牲学习效果。
