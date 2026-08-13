---
title: "verl 的数据、奖励、多轮 Agent 与 VLM"
description: "说明训练数据 schema、reward 管理、多轮 token mask、工具调用、VLM 和 LoRA。"
date: 2026-07-26
updatedDate: 2026-08-14
tags:
  - verl
  - agent
  - reward-modeling
  - vlm
lang: zh-CN
featured: false
draft: false
series: verl-interview-guide
seriesOrder: 7
---

## RL 数据最小结构

一条可训练样本通常需要：

- prompt 或 messages；
- `data_source`，让统一 reward router 知道任务类型；
- `reward_model: {ground_truth: ...}`，这是当前默认 reward manager 读取的嵌套结构；
- 可选 `extra_info`，例如测试用例、工具环境参数、索引；
- 多模态时的 image/video 数据或引用。

预处理最好写成 Parquet/HF Dataset，并在正式训练前做小批量 tokenization、模板和 reward dry-run。数据入口见 [`docs/preparation/prepare_data.rst`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/docs/preparation/prepare_data.rst) 和 [`verl/utils/dataset/rl_dataset.py`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/utils/dataset/rl_dataset.py)。

业务评分函数参数里的 `solution_str` 通常由 manager 解码 rollout response 后生成，不是数据集必须预先保存的根字段。

## 长度、padding 与截断

prompt length 和 response length 是独立预算。prompt 过长可过滤、报错或按配置截断；response 达最大长度时要区分自然 EOS 与硬截断。硬截断如果仍给高 reward，会鼓励不完整答案；一律判错又可能形成不连续信号，因此 DAPO 等使用 overlong soft punishment。

动态 batch/token budget 比固定"每卡几条"更适合变长序列。remove padding 降低无效计算，但要求 position ids、mask 与后端支持正确。

## Reward 三层结构

1. **业务评分函数**：输入回答与 ground truth，输出 correctness、format、tool success 等分量。
2. **RewardManager/RewardLoop**：选择函数、并发执行、解码数据、整理结果。
3. **Trainer 数学层**：组合 rm score、KL 和 shaping，生成 token-level reward，再估计 advantage。

自定义函数可通过配置动态导入（`custom_reward_function.path/name`）；RewardManager 有两套 registry：legacy 的 `verl/workers/reward_manager/`（naive、dapo、prime、batch、rate_limited）与当前主路径 `verl/experimental/reward_loop/reward_manager/`（naive、dapo、gdpo、remote、rate_limited），`load_reward_manager` 默认解析到 experimental registry。源码入口：

- [`verl/trainer/ppo/reward.py:111-157`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/trainer/ppo/reward.py#L111-L157)（`load_reward_manager`）
- [`verl/experimental/reward_loop/reward_loop.py`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/experimental/reward_loop/reward_loop.py)
- [`verl/workers/reward_manager/registry.py`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/workers/reward_manager/registry.py)（legacy）

**已知缺陷（[PR #7151](https://github.com/verl-project/verl/pull/7151) 修复中）**：reward loop 与 agent loop 各有一处把逐样本 `reward_extra_info` 拼成 batch 列时只用第 0 条样本的 keys 推断 schema；混合数据集（不同 data_source 的 scorer 返回不同 key 集合）或条件性诊断 key 下，会随 batch 顺序随机 KeyError 或静默丢列。细节见本系列 [PR 拆解篇](/blog/verl-guide-pr-deep-dive/)。

**生成式 RM 与确定性（#7027）**：判别式 RM 在 `full_determinism` 下强制 `max_num_seqs=1` 串行打分；用户自定义生成式 RM（走 chat completions）则依赖 `VLLM_BATCH_INVARIANT` + per-request seed + 确定性路由实现可复现判分，bitwise 复现目前还要求 V0 路径。

## 规则 reward 与 reward model

规则 reward 适合数学、代码、格式和可执行任务：便宜、可解释，但容易被 exploit，sandbox 也可能成为瓶颈。reward model 能表达主观偏好，但推理成本高、存在分布外误判，也需要单独资源与版本治理。

真实系统常组合：correctness 为主、format 小权重、长度仅作温和 shaping，并始终记录每个 component，不能只记录总分。

## 写 reward 时的工程原则

- 对解析失败、超时、sandbox 错误与真正答错分开计数。
- 保证确定性或记录随机种子，避免同一回答分数漂移。
- 对异常输出设置边界，不让 NaN/极端值进入 advantage whitening。
- 避免直接奖励容易伪造的字符串模式。
- 在训练前用对/错/边界/恶意答案建立单元样例。
- reward 版本必须进入实验元数据；否则无法复现实验。

## 多轮 AgentLoop

AgentLoop 把一次 rollout 扩展为：模型生成 tool call → 执行工具/环境 → 把 observation 加入上下文 → 继续生成，直到终止。LLM server client 对服务副本做负载均衡，并在需要时保持 sticky session。

扩展方式包括 stateful `BaseTool` 和无状态 `@function_tool`；工具可并行执行，并配置响应截断。参考 [`docs/advance/agent_loop.rst`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/docs/advance/agent_loop.rst) 与 `examples/tutorial/agent_loop_get_started/`。

## Tool token 为什么要 mask

模型生成的 token 应参与 policy loss；工具返回/环境 observation 不是策略动作，通常 mask 掉。它们仍保留在 attention context 中，影响后续动作。如果把 observation 当模型输出训练，模型会学着伪造工具结果；如果把模型的 tool call 也 mask，策略又学不会调用工具。

## 多轮 token 一致性

训练必须使用 rollout 真实生成并拼接的 token ids。若最后只保留 messages，再重新 `apply_chat_template`，特殊 token、空格、工具格式可能发生变化；重算 log-prob 就不再对应采样轨迹。这个问题会表现为 PPO ratio/KL 异常，而不是显式报错。

## VLM/视频

多模态数据除文本外还要 processor、image/video key、像素/帧预算、位置编码和后端支持。现有示例包括 Qwen2.5-VL/Qwen3-VL（FSDP 与 Megatron）、GLM-4.1V、MiniCPM-o，以及 Qwen3.5 video FSDP2（`examples/grpo_trainer/` 下的对应脚本）。起步应复制同模型族示例，再逐项改数据，而非从纯文本配置硬加 image 字段。

重点风险：

- processor/chat template 与 rollout server 不一致；
- 图像预处理重复或丢失；
- 每样本视觉 token 差异导致严重负载不均；
- reward 只看文本，未验证视觉依据；
- 后端版本宣称支持模型但不支持热更新/多图/视频路径。

## LoRA

LoRA 减少可训练参数和优化器状态，适合显存受限或多实验。FSDP/FSDP2 走 PEFT（配置用 `lora_rank` 等字段），Megatron 走 bridge 路径（配置用 `lora` dict，`merge` 开关在其中——两套配置尚未统一，读脚本时注意）。rollout 侧两种策略：作为 adapter 动态加载，或 `merge=True` 时先合并进 base 再全量同步（SGLang 下 merge 模式会保持 LoRA-free，#7234；vLLM 侧按版本处理 `.base_layer` 权重名解析，#7327）。reference 可利用"同一 base model、不应用 adapter"的语义减少冗余，但必须核对配置与后端实际支持；`delta_sharded` 权重同步当前不支持 LoRA。

参考 [`docs/advance/ppo_lora.rst`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/docs/advance/ppo_lora.rst) 和 `examples/tuning/lora/`。

## On-policy distillation

V1 还能为 student 创建独立 teacher resource pool。单 teacher 或多个 teacher 可按 `data_source` 等 `teacher_key` 路由。默认 `k3` 等模式返回真实 response token 对应的 teacher log-prob；只有 `forward_kl_topk` 模式返回 top-k token ids/log-probs。训练可以把蒸馏项直接加入 loss，或通过 policy-gradient 路径作为 reward 使用，并可与 task reward 混合。

面试中要区分它与 reference policy：teacher 提供学习目标且可按任务选择，reference 主要用于 KL 约束。需监控 teacher 覆盖率、蒸馏 loss、task reward 和额外推理成本；仅 top-k 模式还要关注截断近似误差。蒸馏 loss 模式复用 KL 估计量（k1/k2/k3/abs）外加 `forward_kl_topk`；#7225 修复了 micro-batch 归一化（聚合前注入全局 dp_size/token 数，使 loss 对 micro-batch 大小不变）。配置见 [`verl/trainer/config/distillation/distillation.yaml`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/trainer/config/distillation/distillation.yaml)，管理器见 `verl/experimental/teacher_loop/`（`MultiTeacherModelManager`）。
