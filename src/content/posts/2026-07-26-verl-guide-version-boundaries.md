---
title: "verl 进阶能力与版本边界"
description: "辨析 V1、fully async、rollout correction、蒸馏、checkpoint 与确定性的真实边界（2026-08 基线）。"
date: 2026-07-26
updatedDate: 2026-08-29
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

这一章专门处理"概念上支持"与"当前默认路径真正能跑"之间的差异。verl 演进很快；面试时最可靠的做法是同时说清原理、入口、配置和当前边界。以下基于 commit `ea532913`（2026-08-29，`0.10.0.dev`）；最新正式 release 为 `v0.9.0`。

## 当前路径速查

| 能力 | 当前入口/状态 | 不要误解为 |
|---|---|---|
| V1 sync | `main_ppo.py` 默认，`trainer_mode=sync` | V0 `RayPPOTrainer` |
| V1 colocate async | `trainer_mode=colocate_async`，支持 partial rollout | 完全独立的 rollout GPU |
| V1 separate async | 增加 standalone rollout，同时保留 hybrid replicas，`parameter_sync_step` 默认 4 | 简单地把 hybrid rollout 删除 |
| separate async 借卡 | `hybrid_rollout.enable_switch=true`，step 间临时让 hybrid GPU 帮 rollout；实验性、默认关闭 | 完全动态/连续的最优资源调度，或新 trainer mode |
| separate_async + Decoupled PPO | **#7188（2026-07-29）起支持**，用 `DetachActorWorker` CPU save/restore 重算 old log-prob | "separate_async 强制 bypass"（旧版事实，已过时） |
| fully async policy | [`verl/experimental/fully_async_policy/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/verl/experimental/fully_async_policy) 独立入口；**CI 已迁到 V1 separate_async（#7357）**，官方注明准备移入 recipe | V1 第四种 trainer mode，或"已删除" |
| V0 trainer | `main_ppo_v0.py` + `RayPPOTrainer` 仍存在；入口的 v0.9.0 删除期限已过 | 已删除，或仍可长期依赖的稳定路径 |
| FSDP-Turbo | `strategy=fsdp_turbo`，CUDA/NPU language model，FSDP+EP+CP，外部 FSDPTurbo 依赖 | FSDP2 的无条件替代、value model/TP 全支持 |
| Ascend MindSpeed | `strategy=megatron` + device=npu dispatch；独立 mindspeed strategy/config 已删除 | 仍配置 `strategy=mindspeed` |
| ReMax | estimator 公共函数存在，完整 greedy baseline 数据准备见 V0 | V1 只改 estimator 即可运行 |
| HF rollout | `HFRollout` 文件存在但未注册进 `_ROLLOUT_REGISTRY` | 当前 async registry 的主路径后端 |
| full KL | 配置/分支名可见 | 已实现完整词表 KL；当前会报未实现 |
| sync ReplayBuffer | 等终态 groups、训练后清理；`max_off_policy_*` 在 sync 下是 no-op | 跨 step 长期经验回放 |
| GSPO 聚合 | ratio/clip 是序列级；最终 `loss_agg_mode` 可配置 | `loss_mode=gspo` 自动强制论文的 seq-mean 聚合 |
| Multimodal Continuous Token | AgentLoop 唯一 tokenization 路径；VL builder 自动解析，未知族可 warning 后用 generic builder，不安全组合显式报错 | 可关闭并回退 legacy re-tokenize |
| recipe/ 目录 | 已迁独立仓 verl-recipe（submodule，默认不初始化）；主仓内见 [`docs/algo/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/docs/algo) + `examples/*_trainer/` | 在主仓 recipe/ 目录下找 DAPO 等实现 |

这张表是面试中很有价值的"代码意识"：registry、实现文件、Trainer 前置数据和 recipe 四者必须同时成立，才可以说某组合开箱可用。

## Rollout correction

### 为什么需要三种 log-prob

异步或训练/推理解耦后可能存在：

- $\pi_{rollout}$：真正生成 token 的服务版本，对应 `rollout_log_probs`。
- $\pi_{old}$：训练该 batch 前固定的 proximal anchor，对应重算的 `old_log_probs`。
- $\pi_\theta$：mini-batch 更新中的 current actor。

普通 PPO ratio 约束 current 相对 old，但如果 rollout 已经陈旧（异步）或数值不一致（训推引擎算子差异），还存在 rollout→old 的分布偏移。这两类偏移正是 2025 年社区"训推不一致/RL 崩溃"讨论的核心（详见第 14 章专题一）。

### Decoupled（默认，`bypass_mode=false`）

V1 用 actor 重算一次 old log-prob，再固定到本批更新结束（见 [`verl/trainer/ppo/v1/trainer_base.py`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/trainer/ppo/v1/trainer_base.py) 的 `_compute_old_log_prob`）。后续 correction 分支基于 rollout/old 比率调用 `compute_rollout_correction_and_add_to_batch`，完成：

- token-level 或 sequence-level importance sampling（`rollout_is: token|sequence`，TIS 上界 `rollout_is_threshold=2.0`，也支持 IcePop 式上下界）；
- rejection sampling（`rollout_rs`：如 `token_k1`、`seq_sum_k1`、`seq_mean_k3`）；
- 对应的有效样本率和偏移指标（`rollout_corr/*`：KL、k3_kl、训推 PPL 差、χ²、ESS、RS 掩蔽比例等）。

优势是明确区分"数据来自谁"和"PPO 更新锚点是谁"；代价是一次训练侧 log-prob forward，并引入 IS 方差。

### Bypass（`bypass_mode=true`）

直接令 `old_log_probs = rollout_log_probs`，只保留 rollout/current 两策略。loss 可使用 PPO clipped ratio（`loss_type=ppo_clip`），或 REINFORCE + 显式 IS（`loss_type=reinforce`）。省一次重算 forward，但把训推数值差异直接并入 PPO ratio。

配置见 [`verl/trainer/config/algorithm/rollout_correction.yaml`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/trainer/config/algorithm/rollout_correction.yaml)；三种 trainer mode 均可自由选择两种模式（#7188 之后）。

### correction 不能替代版本治理

IS 权重可能极端、rejection 会降低有效 batch，过旧数据仍然有不可接受的方差。需要同时控制 `parameter_sync_step`、`max_off_policy_threshold`、`drop|wait`，并观察 model-version span、IS 分布、rejection rate、clip fraction 与 wall-clock reward/validation。

## Separate async 的 step-boundary 借卡

`trainer.v1.separate_async.hybrid_rollout.enable_switch=true` 解决的是一个具体空洞：上一步训练结束后，standalone rollout 尚未准备好下一批时，hybrid trainer GPU 在等待。启用后：

1. hybrid replicas 同步权重、恢复生成并加入 standalone load balancer；
2. ReplayBufferAsync 用 `get_sampleable_count`/`wait_for_sampleable` 反馈 buffer 深度；
3. 达到 `clamp(round(ratio × train_batch_size), one_mini_batch, train_batch_size)` 后移出 balancer、abort partial request、sleep 并回到训练；
4. `adaptive_switch_threshold` 根据持续 idle/calm 调高/调低 ratio，决策还比较预计生成收益与最近切换成本。

边界：默认关闭；不能与 rollout PD disaggregation 同开；自定义 sampler 必须实现两个 sampleable API；收益估计使用静态 GPU 数比例，源码仍有进一步动态化 TODO。评价它要同时看 `timing_s/gen`、`timing_s/switch_wait`、`timing_s/switch_to_rollout`、`timing_s/switch_to_trainer`、`separate_async/switch/*`、`separate_async/decision/*`、sampleable/remaining、staleness 与最终质量，不可只看 tokens/s。

## 独立 fully-async 架构

[`verl/experimental/fully_async_policy/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/verl/experimental/fully_async_policy) 用独立的 Rollouter、MessageQueue、Trainer 和 ParameterSynchronizer 组织 streaming/partial rollout，特性由 `async_training.staleness_threshold`、`trigger_parameter_sync_step`、`partial_rollout` 控制。它面向生成与训练长期重叠、动态资源和更细粒度轨迹流转。

2026-08 状态：README 仍在（最后更新 2026-05），但 CI 已删除其 e2e workflow 并迁移到 `e2e_v1_separate_async*`（#7357）。官方在 PR 中说明"preparing to move fully_async into recipe"。使用它前要回答：

- partial trajectory 在模型版本变化后如何继续；
- 谁记录 token 对应的 rollout version/log-prob；
- queue backpressure 和失败重试怎样处理；
- trainer/rollout 动态资源切换是否在当前路径完整实现；
- checkpoint 是否能恢复 queue 与 in-flight 状态。

入口和限制见 [`docs/advance/fully_async.md`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/docs/advance/fully_async.md) 与 [`verl/experimental/fully_async_policy/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/verl/experimental/fully_async_policy)。实验性目录表示需要额外验证，不等于不可用，也不等于生产承诺。

## On-policy distillation

V1 可在 PPO 训练旁建立 teacher 服务：

1. Trainer 创建独立 teacher resource pool 与 `MultiTeacherModelManager`。
2. AgentLoop/teacher loop 获取 teacher 在 response token 上的 log-prob；仅 `forward_kl_topk` 模式额外返回 top-k token ids/log-probs。
3. 多 teacher 可按 `teacher_key`（默认可用 `data_source`）路由。
4. 蒸馏信号可直接进入 distillation loss，也可走 policy-gradient 形式，并可与 task reward 混合。蒸馏 loss 已修复 micro-batch 归一化（#7225）。

主要取舍：teacher 质量与覆盖、额外推理资源、task reward 和 imitation 的权重；使用 top-k 模式时还要评估截断近似误差。teacher 与 reference policy 不同：前者是学习信号，后者主要是策略漂移约束。

配置：[`verl/trainer/config/distillation/distillation.yaml`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/trainer/config/distillation/distillation.yaml)；执行：[`verl/experimental/teacher_loop/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/verl/experimental/teacher_loop)、[`verl/trainer/ppo/v1/trainer_base.py`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/trainer/ppo/v1/trainer_base.py)。

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

### Driver-side checkpoint callback

`trainer.checkpoint_callback_class` 可加载 `CheckpointCallback` 子类。`on_save(trainer, global_step, checkpoint_dir, async_save, **kwargs)` 在 driver 上、worker-group 保存 RPC 之后调用；适合上传、登记和外部编排。异常默认传播并终止训练，以免耐久性关键操作悄悄失败。若 `async_save=true`，Megatron worker 的写入可能仍在进行，latest marker 也可能尚未更新，因此回调触发不是 durable commit 事件。

## AgentLoop 的 Continuous Token 边界

Continuous Token 现在是 AgentLoop 唯一路径：builder 根据根 `config.json` 的 `model_type` 精确解析模型族；未知值会 warning 并根据是否存在 multimodal processor 选通用 text/VL builder，已识别的纯文本族与多模态 processor 不能安全匹配等情况才明确报错。增量 merge 必须保证 runtime token prefix 与完整 chat-template encoding 一致，新增 boundary/observation token 的 mask/logprob 为 0。多模态轨迹在结束后用最终 token stream 解码得到的文本与累计媒体对象重建训练 tensor；VL prompt 超长不做破坏 placeholder 对齐的静默截断。整个过程始终不回退 legacy re-tokenize。

这类实现的面试价值在于：**token 一致性是 PPO 的数据契约，不是 tokenizer 的小细节**。若 runtime token 与训练重编码不同，rollout/old/current log-prob 对不上，ratio 会在不报错的情况下失真。

## Determinism 的支持边界

普通 seed 只固定部分随机源。full determinism 还需要固定 kernel、数据顺序、vLLM batch-invariant 行为、请求路由与 reward 执行。仓库在 `ray.init` 前传播 `VERL_FULL_DETERMINISM`、`VLLM_BATCH_INVARIANT` 和 `PYTHONHASHSEED`（见 [`verl/trainer/main_ppo.py`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/trainer/main_ppo.py)）；rollout 与生成式 reward model 的 rollout 均可配置 `full_determinism`（后者来自 #7027，让用户自定义 GenRM 判分可复现）。

代价和边界：

- 可能牺牲 continuous batching 和整体吞吐；
- 当前重点是 vLLM 路径，不能外推到所有 rollout 后端；
- multi-turn/tool 的外部 latency 和调度使完整 bitwise 复现更难；
- 硬件、驱动、依赖版本变化仍可能破坏一致性。

面试时最好先问需求是"统计可复现"还是"逐 token/逐 bit 一致"。参考 [`docs/advance/determinism.md`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/docs/advance/determinism.md)。

## 其他值得知道的能力

以下能力适合作为进阶导航，不应在没有核对当前 recipe/CI 时宣称所有组合都开箱支持：

- 低精度：FP8 rollout/训练、NVFP4 QAT（[`docs/low_precision/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/docs/low_precision)、[`verl/utils/vllm/vllm_fp8_utils.py`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/verl/utils/vllm/vllm_fp8_utils.py)/`vllm_fp4_utils.py`/`vllm_quant_utils.py`）。
- Muon 优化器：Megatron 后端经 TensorParallelMuon 暴露（#7120，[`examples/muon/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/examples/muon)），注意有效步长是 `lr × muon_extra_scale_factor`。
- FSDP-Turbo：CUDA/NPU 的 FSDP+EP+CP overlap 后端；当前 language-model only、TP=1、外部 patch plan 是支持前提。
- TorchTitan：FSDP2/HSDP+TP/CP/EP、nightly 依赖；PP 当前不支持，`delta_sharded` export 也显式拒绝 PP。
- 动态上下文并行（DCP，#6555）：按 packed micro-batch 长度动态选 CP size，`megatron.dynamic_context_parallel=True` + `max_seqlen_per_dp_cp_rank`；暂不支持 multimodal/value/FP8/distillation/VPP。
- speculative/MTP、router replay（R2/R3 模式，R3 需 rollout 返回 routed experts）：[`examples/mtp_trainer/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/examples/mtp_trainer)、[`examples/router_replay/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/examples/router_replay)。
- DeepSeek-V4 支持：Megatron flash 与 veomni 路径、FP8/FP4 权重 refit、ROCm 适配（2026-07/08 密集合入）。
- rollout correction 的数学与实现：[`docs/algo/rollout_corr.md`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/docs/algo/rollout_corr.md)、`rollout_corr_math.md`。
- PD/rollout 解耦与 KV offload：[`docs/advance/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/docs/advance)、[`docs/perf/`](https://github.com/verl-project/verl/tree/ea53291385ce764019a2b40733605f21d8317583/docs/perf) 中当前材料；PD 分离当前同时支持 SGLang 和 vLLM replica。vLLM PD 只支持 `nixl|mooncake`、`prefill_replicas=1`、单节点、DP=1、PP=1，NPU 未验证，不能从"已注册"外推成任意部署。
- SkipManager、rollout trace 与 RL-Insight：用于跳过阶段、轨迹可观测性和线上诊断；当前还能转发 Agent session/span telemetry（需 RL-Insight >=0.3.0）。
- 平台 engine：TorchTitan、VeOmni、AutoModel、FSDP-Turbo；Ascend MindSpeed patch 通过 `backend=megatron, device=npu` dispatch，不再有独立 mindspeed strategy。
- uv 环境：[`manage_envs.py`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/manage_envs.py) 组合 extras 并由单一 [`uv.lock`](https://github.com/verl-project/verl/blob/ea53291385ce764019a2b40733605f21d8317583/uv.lock) 固定，但平台边界是 Linux x86_64/Python 3.12/CUDA 13.0；其他硬件不能照搬。

## 每次升级后的五分钟审计

1. 看 `ppo_trainer.yaml` 的 `use_v1`、trainer mode 和 defaults。
2. 看 `AdvantageEstimator`、policy loss registry 与 rollout registry。
3. 检查 estimator 所需字段是否由所选 Trainer 产生。
4. 看示例是否显式切 V0、实验入口或外部子模块。
5. 对后端支持同时查 registry、配置校验、example 和 CI，而不是只看 README 新闻。

这套审计方法比背一个固定"支持矩阵"更适合快速演进的框架。本指南 2026-08-29 的重审再次说明这一点：正式版号越过 V0 删除警告却未删除、separate_async 新增实验性借卡、FSDP-Turbo 加入 registry、独立 MindSpeed strategy 被移除、GSPO 聚合从硬编码变成可配置、AgentLoop 统一到 Multimodal Continuous Token。
