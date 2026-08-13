---
title: "verl 进阶能力与版本边界"
description: "辨析 V1、fully async、rollout correction、蒸馏、checkpoint 与确定性的真实边界（2026-08 基线）。"
date: 2026-07-26
updatedDate: 2026-08-14
tags:
  - verl
  - async-training
  - versioning
  - llm-rl
lang: zh-CN
featured: false
draft: false
series: verl-interview-guide
seriesOrder: 13
---

这一篇专门处理"概念上支持"与"当前默认路径真正能跑"之间的差异。verl 演进很快；面试时最可靠的做法是同时说清原理、入口、配置和当前边界。以下基于 commit [`09ac3725`](https://github.com/verl-project/verl/tree/09ac37258ea66b0cb69b2738eec3074ea4e7261c)（2026-08，0.9.0.dev）。

## 当前路径速查

| 能力 | 当前入口/状态 | 不要误解为 |
|---|---|---|
| V1 sync | `main_ppo.py` 默认，`trainer_mode=sync` | V0 `RayPPOTrainer` |
| V1 colocate async | `trainer_mode=colocate_async`，支持 partial rollout | 完全独立的 rollout GPU |
| V1 separate async | 增加 standalone rollout，同时保留 hybrid replicas，`parameter_sync_step` 默认 4 | 简单地把 hybrid rollout 删除 |
| separate_async + Decoupled PPO | **#7188（2026-07-29）起支持**，用 `DetachActorWorker` CPU save/restore 重算 old log-prob | "separate_async 强制 bypass"（旧版事实，已过时） |
| fully async policy | `experimental/fully_async_policy` 独立入口；**CI 已迁到 V1 separate_async（#7357）**，官方注明准备移入 recipe 仓库 | V1 第四种 trainer mode，或"已删除" |
| V0 trainer | `main_ppo_v0.py` + `RayPPOTrainer`，入口警告 v0.9.0 移除（当前即 0.9.0.dev） | 仍可长期依赖的路径 |
| ReMax | estimator 公共函数存在，完整 greedy baseline 数据准备见 V0 | V1 只改 estimator 即可运行 |
| HF rollout | `HFRollout` 文件存在但未注册进 `_ROLLOUT_REGISTRY` | 当前 async registry 的主路径后端 |
| full KL | 配置/分支名可见 | 已实现完整词表 KL；当前会报未实现 |
| sync ReplayBuffer | 等终态 groups、训练后清理；`max_off_policy_*` 在 sync 下是 no-op | 跨 step 长期经验回放 |
| recipe/ 目录 | 已迁独立仓 verl-recipe（submodule，默认不初始化）；主仓内见 `docs/algo/` + `examples/*_trainer/` | 在主仓 recipe/ 目录下找 DAPO 等实现 |

这张表是面试中很有价值的"代码意识"：registry、实现文件、Trainer 前置数据和 recipe 四者必须同时成立，才可以说某组合开箱可用。

## Rollout correction

### 为什么需要三种 log-prob

异步或训练/推理解耦后可能存在：

- $\pi_{rollout}$：真正生成 token 的服务版本，对应 `rollout_log_probs`。
- $\pi_{old}$：训练该 batch 前固定的 proximal anchor，对应重算的 `old_log_probs`。
- $\pi_\theta$：mini-batch 更新中的 current actor。

普通 PPO ratio 约束 current 相对 old，但如果 rollout 已经陈旧（异步）或数值不一致（训推引擎算子差异），还存在 rollout→old 的分布偏移。这两类偏移正是 2025 年社区"训推不一致/RL 崩溃"讨论的核心（详见[真题热点篇](/blog/verl-guide-real-interview-questions/)专题一）。

### Decoupled（默认，`bypass_mode=false`）

V1 用 actor 重算一次 old log-prob，再固定到本批更新结束（[`trainer_base.py:1479-1493`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/trainer/ppo/v1/trainer_base.py#L1479-L1493)）。rollout correction 基于 rollout/old 比率（1607-1617 调用 `compute_rollout_correction_and_add_to_batch`）做：

- token-level 或 sequence-level importance sampling（`rollout_is: token|sequence`，TIS 上界 `rollout_is_threshold=2.0`，也支持 IcePop 式上下界）；
- rejection sampling（`rollout_rs`：如 `token_k1`、`seq_sum_k1`、`seq_mean_k3`）；
- 对应的有效样本率和偏移指标（`rollout_corr/*`：KL、k3_kl、训推 PPL 差、χ²、ESS、RS 掩蔽比例等）。

优势是明确区分"数据来自谁"和"PPO 更新锚点是谁"；代价是一次训练侧 log-prob forward，并引入 IS 方差。

### Bypass（`bypass_mode=true`）

直接令 `old_log_probs = rollout_log_probs`，只保留 rollout/current 两策略。loss 可使用 PPO clipped ratio（`loss_type=ppo_clip`），或 REINFORCE + 显式 IS（`loss_type=reinforce`）。省一次重算 forward，但把训推数值差异直接并入 PPO ratio。

配置见 [`verl/trainer/config/algorithm/rollout_correction.yaml`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/trainer/config/algorithm/rollout_correction.yaml)；三种 trainer mode 均可自由选择两种模式（#7188 之后）。

### correction 不能替代版本治理

IS 权重可能极端、rejection 会降低有效 batch，过旧数据仍然有不可接受的方差。需要同时控制 `parameter_sync_step`、`max_off_policy_threshold`、`drop|wait`，并观察 model-version span、IS 分布、rejection rate、clip fraction 与 wall-clock reward/validation。

## 独立 fully-async 架构

`experimental/fully_async_policy` 用独立的 Rollouter、MessageQueue、Trainer 和 ParameterSynchronizer 组织 streaming/partial rollout，特性由 `async_training.staleness_threshold`、`trigger_parameter_sync_step`、`partial_rollout` 控制。它面向生成与训练长期重叠、动态资源和更细粒度轨迹流转。

2026-08 状态：README 仍在（最后更新 2026-05），但 CI 已删除其 e2e workflow 并迁移到 `e2e_v1_separate_async*`（#7357）。官方在 PR 中说明"preparing to move fully_async into recipe"。使用它前要回答：

- partial trajectory 在模型版本变化后如何继续；
- 谁记录 token 对应的 rollout version/log-prob；
- queue backpressure 和失败重试怎样处理；
- trainer/rollout 动态资源切换是否在当前路径完整实现；
- checkpoint 是否能恢复 queue 与 in-flight 状态。

入口和限制见 [`docs/advance/fully_async.md`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/docs/advance/fully_async.md)。实验性目录表示需要额外验证，不等于不可用，也不等于生产承诺。

## On-policy distillation

V1 可在 PPO 训练旁建立 teacher 服务：

1. Trainer 创建独立 teacher resource pool 与 `MultiTeacherModelManager`。
2. AgentLoop/teacher loop 获取 teacher 在 response token 上的 log-prob；仅 `forward_kl_topk` 模式额外返回 top-k token ids/log-probs。
3. 多 teacher 可按 `teacher_key`（默认可用 `data_source`）路由。
4. 蒸馏信号可直接进入 distillation loss，也可走 policy-gradient 形式，并可与 task reward 混合。蒸馏 loss 已修复 micro-batch 归一化（#7225）。

主要取舍：teacher 质量与覆盖、额外推理资源、task reward 和 imitation 的权重；使用 top-k 模式时还要评估截断近似误差。teacher 与 reference policy 不同：前者是学习信号，后者主要是策略漂移约束。

配置：[`verl/trainer/config/distillation/distillation.yaml`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/trainer/config/distillation/distillation.yaml)；执行：`verl/experimental/teacher_loop/`。

## Validation 的独立语义

V1 validation 不是从训练 batch 随手算一个 reward：

- 使用独立 `val` TransferQueue partition；
- rollout sampling 使用 `val_kwargs`，可与训练温度/top-p 分开；
- 多轮场景取每个 session 的最终输出；
- 可按 data source、reward component 聚合；
- 支持 generation table 和 JSONL dump；
- `val_before_train` 能先验证模型、数据、reward 和服务链是否一致。

真实面试场景中，应说明为什么 train reward、validation reward 和最终 benchmark 三者可能不同，以及如何防止 verifier/data leakage。

## Checkpoint 与 in-flight 状态

V1 checkpoint/resume 要分状态看：

- actor/critic：模型、optimizer 等训练状态；
- global step 与 StatefulDataLoader：数据顺序和进度；
- TransferQueue：仅异步 mode 且安装的 transfer_queue >= 0.1.9、提供 snapshot/restore API 时保存（`_tq_supports_checkpoint`）；
- pending/running prompts：恢复后由 `_reissue_inflight_prompts` 重发（在 `fit` 进入训练循环前调用）；
- rollout server 权重：恢复 actor 后需要重新同步。

因此"恢复成功"不等于逐 token 轨迹完全连续。外部 tool/verifier 要支持幂等，指标要识别重试，checkpoint 需要和数据/reward/代码版本绑定。

## Determinism 的支持边界

普通 seed 只固定部分随机源。full determinism 还需要固定 kernel、数据顺序、vLLM batch-invariant 行为、请求路由与 reward 执行。仓库在 `ray.init` 前传播 `VERL_FULL_DETERMINISM`、`VLLM_BATCH_INVARIANT` 和 `PYTHONHASHSEED`（[`main_ppo.py:43-50`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/trainer/main_ppo.py#L43-L50)）；rollout 与生成式 reward model 的 rollout 均可配置 `full_determinism`（后者来自 #7027，让用户自定义 GenRM 判分可复现）。

代价和边界：

- 可能牺牲 continuous batching 和整体吞吐；
- 当前重点是 vLLM 路径，不能外推到所有 rollout 后端；
- multi-turn/tool 的外部 latency 和调度使完整 bitwise 复现更难；
- 硬件、驱动、依赖版本变化仍可能破坏一致性。

面试时最好先问需求是"统计可复现"还是"逐 token/逐 bit 一致"。参考 [`docs/advance/determinism.md`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/docs/advance/determinism.md)。

## 其他值得知道的能力

以下能力适合作为进阶导航，不应在没有核对当前 recipe/CI 时宣称所有组合都开箱支持：

- 低精度：FP8 rollout/训练、NVFP4 QAT（`docs/low_precision/`）。
- Muon 优化器：Megatron 后端经 TensorParallelMuon 暴露（#7120，`examples/muon/`），注意有效步长是 `lr × muon_extra_scale_factor`。
- 动态上下文并行（DCP，#6555）：按 packed micro-batch 长度动态选 CP size，`megatron.dynamic_context_parallel=True` + `max_seqlen_per_dp_cp_rank`；暂不支持 multimodal/value/FP8/distillation/VPP。
- speculative/MTP、router replay（R2/R3 模式，R3 需 rollout 返回 routed experts）：`examples/mtp_trainer/`、`examples/router_replay/`。
- DeepSeek-V4 支持：Megatron flash 与 veomni 路径、FP8/FP4 权重 refit、ROCm 适配（2026-07/08 密集合入）。
- rollout correction 的数学与实现：`docs/algo/rollout_corr.md`、`rollout_corr_math.md`。
- PD/rollout 解耦与 KV offload：`docs/advance/`、`docs/perf/` 中当前材料；PD 分离目前 SGLang 独有。
- SkipManager、rollout trace 与 RL-Insight：用于跳过阶段、轨迹可观测性和线上诊断（`trainer.logger` 支持 `rl_insight`）。
- 平台 engine：TorchTitan、VeOmni、AutoModel、MindSpeed/NPU，通过 EngineRegistry 扩展。

## 每次升级后的五分钟审计

1. 看 `ppo_trainer.yaml` 的 `use_v1`、trainer mode 和 defaults。
2. 看 `AdvantageEstimator`、policy loss registry 与 rollout registry。
3. 检查 estimator 所需字段是否由所选 Trainer 产生。
4. 看示例是否显式切 V0、实验入口或外部子模块。
5. 对后端支持同时查 registry、配置校验、example 和 CI，而不是只看 README 新闻。

这套审计方法比背一个固定"支持矩阵"更适合快速演进的框架。本文 2026-08 的更新本身就是一次这样的审计：发现了 separate_async 解锁 decoupled、fully_async CI 迁移、`token-sum` 聚合新增、DRO/CISPO loss 注册等变化。
