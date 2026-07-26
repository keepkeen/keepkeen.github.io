---
title: "verl 实战：从训练数据到 Hugging Face 模型导出"
description: "串联数据准备、dry-run、smoke test、正式训练、checkpoint、合并与离线验证。"
date: 2026-07-26
tags:
  - verl
  - model-export
  - checkpoint
  - llm-rl
lang: zh-CN
featured: false
draft: false
series: verl-interview-guide
seriesOrder: 14
---

本文不承诺一条命令适配所有硬件，而是给出不会迷路的操作顺序。具体 CUDA/NPU、PyTorch、vLLM/SGLang 版本组合应按 [`docs/start/install.rst`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/docs/start/install.rst)、对应容器和当前 example 核查；仓库 quickstart 也明确推荐优先使用项目提供的 Docker 环境。

## 全流程

<div style="overflow-x: auto; margin: 1.5rem 0;">
  <img src="/images/verl-interview-guide/lifecycle.svg" alt="从原始数据到 Hugging Face 模型的完整流程" style="display: block; min-width: 760px; width: 100%; height: auto;" loading="lazy" />
</div>

## 1. 先固定版本和硬件事实

记录：verl commit/tag、recipe commit、容器 tag、GPU/NPU 型号与数量、driver、PyTorch、训练后端、rollout 后端和基础模型 revision。只写“使用最新版”无法复现，且推理后端支持矩阵可能比 Trainer API 更快变化。

启动前做最小检查：

- 每节点设备数量与 `trainer.n_gpus_per_node` 一致；
- 模型能被 tokenizer/processor 加载；
- Ray 在所有节点看到预期资源；
- NCCL/HCCL 网络和共享 checkpoint 路径可用；
- rollout backend 的模型、dtype、多模态与热更新路径被当前 example 覆盖。

## 2. 把数据整理为当前 schema

GSM8K 示例可以直接运行：

```bash
python3 examples/data_preprocess/gsm8k.py --local_save_dir ~/data/gsm8k
```

生成 `train.parquet` 和 `test.parquet`。当前脚本的一条记录核心形态是：

```text
data_source: "openai/gsm8k"
prompt: [{role: "user", content: "..."}]
ability: "math"
reward_model: {style: "rule", ground_truth: "42"}
extra_info: {split: "train", index: ..., answer: ..., question: ...}
```

自己的任务应至少明确 prompt/messages、`data_source`、嵌套的 reward ground truth 和业务 extra info；工具/VLM 再加入相应字段。schema 不是纯数据工程细节，它决定 RewardLoop 路由和评测分层。

## 3. 训练前做四个 dry-run

1. **数据**：读取几十条，确认 train/val 无泄漏、字段类型一致。
2. **模板/token**：查看最终 prompt token、长度、EOS/特殊 token；多轮以 AgentLoop 实际 token 为准。
3. **reward**：用正确、错误、格式异常、超长和恶意答案测试 component 与失败类型。
4. **分组**：GRPO/RLOO 检查同一 `uid` 的 `n` 条回答确实成组，组内 reward 能产生差异。

不要用“训练 loss 能算出来”代替这四项。reward 或 mask 错误常不会报异常，却会稳定优化错误目标。

## 4. 从现成脚本开始

文本 GRPO 的当前入口之一是：

```bash
bash examples/grpo_trainer/run_qwen3_8b_fsdp.sh
```

它通过环境变量暴露常用旋钮，并将剩余参数作为 Hydra override 传入。典型用法形态：

```bash
MODEL_PATH=/path/to/model \
NNODES=1 NGPUS_PER_NODE=8 \
INFER_BACKEND=vllm \
ROLLOUT_N=5 TRAIN_BATCH_SIZE=1024 \
bash examples/grpo_trainer/run_qwen3_8b_fsdp.sh \
  "data.train_files=['/path/train.parquet']" \
  "data.val_files=['/path/val.parquet']" \
  'trainer.logger=["console"]'
```

这些数值只是脚本形态示例，不是硬件建议。第一次应按模型/显存显著缩短 response、batch、epoch 和保存间隔；同时保证 group size、mini-batch 整除和模型并行约束。若只有 24GB 单卡，仓库 [`docs/start/quickstart.rst`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/docs/start/quickstart.rst) 的 0.5B PPO 示例比 8B GRPO 更适合作为安装验证。

## 5. 会解释脚本中的六组参数

以 `run_qwen3_8b_fsdp.sh` 为例：

- `DATA`：estimator、train/val files、逻辑 prompt batch、长度与截断策略。
- `MODEL`：基础模型、remove padding、gradient checkpointing。
- `ACTOR`：学习率、PPO mini-batch、dynamic batch、KL loss、FSDP offload。
- `ROLLOUT`：vLLM/SGLang/TRT-LLM、TP、KV cache 比例、每 prompt 采样数。
- `REF`：reference log-prob 的 dynamic batch、token budget 与 offload。
- `TRAINER`：节点/GPU、logger、checkpoint、validation、epoch。

面试时不要逐项背值，而要说明哪个角色消费这个参数、影响显存还是算法统计、改动后应观察什么指标。

## 6. Smoke test 的通过标准

短跑 2～5 step，至少确认：

- 初始化日志显示预期 V1 mode、训练 engine 和 rollout backend；
- rollout 文本、response mask 与 reward 正常；
- GRPO 组内有正负/不同 advantage，或 GAE value/return 尺度合理；
- old/ref/current log-prob 对应相同 token，首轮 ratio 没有异常漂移；
- actor grad norm 非零，参数更新后 rollout 权重版本推进；
- checkpoint 能保存，并能从一个短 run 恢复；
- validation 能输出目标 data source 的指标和样例。

如果任一正确性条件失败，先停在单机/sync；不要靠多机或异步掩盖问题。

## 7. 正式训练观察什么

每个实验保存 resolved config、git/model/data/reward 版本和硬件拓扑。Dashboard 至少分四组：

- 学习：train/val reward components、advantage/return、KL、clip、entropy、grad norm。
- 数据：长度/截断、失败组、tool/verifier error、过滤/refill。
- 性能：各 stage time、tokens/s/GPU、MFU、KV cache、rank imbalance。
- 版本：rollout/old/current span、weight sync、异步 drop/wait/IS/rejection。

定期保存 rollout 样例；纯标量曲线无法发现格式投机、reward hacking 和模板错误。

## 8. Checkpoint 先服务于恢复

默认路径形如：

```text
checkpoints/<project>/<experiment>/global_step_<N>/actor/
```

里面可能是 FSDP/Megatron 分片和 optimizer/extra 状态。它用于恢复训练，不一定能直接由 Transformers/vLLM 加载。恢复演练应在正式长跑前完成：保存一个短 checkpoint、重启、核对 global step、数据位置、权重版本和首个 validation。

## 9. 导出 Hugging Face 模型

FSDP 示例：

```bash
python -m verl.model_merger merge \
  --backend fsdp \
  --local_dir checkpoints/<project>/<experiment>/global_step_<N>/actor \
  --target_dir /path/to/exported_hf_model
```

Megatron 必须先看 checkpoint layout：当前默认/推荐 mbridge 通常已经产出可直接加载的 `model/huggingface/`，无需 merger。只有纯 Megatron distributed checkpoint 的 `model/dist_ckpt/` 才使用 `--backend megatron`，必要时加 `--tie-word-embedding`；超大模型可按 [`docs/advance/checkpoint.rst`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/docs/advance/checkpoint.rst) 使用多节点 `torchrun` 分布式 merge。实际以 manifest、`save_contents` 和 `use_mbridge` 为准。

不要在未经确认时使用 `--hf_upload_path`：它会写远端 Hugging Face 仓库，属于单独的发布动作。

## 10. 导出后验证

至少检查：

1. config、tokenizer/processor 和特殊 token 完整。
2. 模型可用 Transformers 加载，参数 shape/dtype 正确。
3. 对固定 prompts 比较 merge 前 checkpoint 路径的可信参考与 merge 后 logits/greedy generation。
4. 跑独立 validation/benchmark，而不是只看训练 reward。
5. 若使用 LoRA，确认导出的是 adapter、merged model，还是 base + adapter 组合。

`verl.model_merger` 支持 FSDP/Megatron merge，并提供 test/验证相关入口；实现位于 [`verl/model_merger/`](https://github.com/verl-project/verl/tree/18a55518540f92588111a0ee48dcf0abf8fe3172/verl/model_merger)，完整参数见 [`docs/advance/checkpoint.rst`](https://github.com/verl-project/verl/blob/18a55518540f92588111a0ee48dcf0abf8fe3172/docs/advance/checkpoint.rst)。

## 面试中的项目叙述模板

> 我先固定模型、verl/recipe 和训练/推理后端版本，把数据转为带 `data_source`、prompt、嵌套 ground truth 的 Parquet。训练前分别验证模板、reward、mask 和 GRPO 分组。先用 V1 sync 做 2～5 step smoke test，确认 rollout→reward→advantage→actor update→weight sync 全链正确，再依据 stage timing 扩 batch、多机或异步。正式训练同时看学习、数据质量、性能和模型版本指标。checkpoint 先做恢复演练，结束后用 model merger 把 FSDP/Megatron 分片导出为 HF 模型，并用固定生成和独立评测验证，而不是直接把训练 reward 当作交付结果。
