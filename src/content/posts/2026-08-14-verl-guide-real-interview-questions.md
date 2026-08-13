---
title: "2025–2026 大厂面试真题与热点精讲：verl 与 LLM RL"
description: "字节、阿里、快手、腾讯、百度真题逐题精讲，加训推不一致、异步 RL、Agentic RL 三大热点专题。"
date: 2026-08-14
tags:
  - verl
  - interview
  - llm-rl
  - grpo
lang: zh-CN
featured: true
draft: false
series: verl-interview-guide
seriesOrder: 15
---

本篇基于 2025–2026 年公开面经（牛客网、面试大师等）与各厂公开技术材料整理，覆盖大模型厂商（字节、阿里、百度、MiniMax、智谱系等）、大厂（腾讯、快手、美团等）与中厂的真实提问。每题给出"面试官想听什么 + 参考回答骨架 + 结合 verl 的加分点"。

先记住三条命题规律：

1. **算法八股必考**：GRPO vs PPO、GAE、KL、重要性采样，几乎每场都有；
2. **verl 已成为默认语境**：字节系直接问"verl 里怎么改"，其他厂问"你用什么框架训练、它怎么解决 X"；
3. **2025 起新增三大热点**：训推不一致、异步 RL/staleness、Agentic RL。老八股答对只是及格线，热点答好才拉开差距。

---

## 一、真题总览（按公司）

### 字节跳动（Seed / TikTok，2025 校招与实习面）

来自多篇牛客面经的原题：

1. GRPO 相比 PPO 的优缺点是什么？
2. PPO 是如何计算优势的？GAE 的原理？
3. 除了 GRPO 还了解哪些强化学习训练方法？
4. DAPO 改进了什么地方？
5. **你觉得 verl 框架如果用 DAPO 该改哪些地方？**（直接考 verl）
6. DPO 的原理是什么？如何推导出来的？
7. 重要性采样的原理？
8. GRPO 公式？为什么公式里 clip 了外面还要计算一次 mean？
9. SFT 和 GRPO 在优化目标上的区别？
10. Advantage 怎么算的？一组的大小这个超参数如何影响模型训练？
11. 为什么组内全好或者全坏时，这一步对模型训练不起作用？
12. 手撕：PPO/GRPO loss、MHA、动态规划（Hot100）。

### 阿里（通义/淘天等）

1. PPO 和 DPO 在大模型对齐中的主要区别？DPO 训练的注意事项？用过 GRPO 么？
2. 从 PPO 到 DPO 再到 GRPO 的演进反映了什么趋势？
3. QwenLong-L1 的渐进式上下文扩展和混合奖励机制怎么配合？
4. Agent 多轮任务：工具调用链路的调度策略、异常 fallback、评估维度（planning vs hallucination）。
5. 在 PPO、DPO、GRPO 里选型的依据？

### 快手

1. DPO、PPO、GRPO 的原理和区别？
2. PPO 的损失是 token 级别还是 sequence 级别的？
3. PPO 中的 Critic 模型是如何计算优势的？
4. 为什么选 SFT 而不是 RL（或反之）？
5. LoRA 原理、如何减少训练参数。

### 腾讯（微信等）

1. 手撕 PPO；手撕 AdamW。
2. 围绕 GRPO、PPO、reward model 的强化学习细节拷打；马尔可夫决策过程。
3. bf16/fp16/fp32 区别并计算（联动训推一致性话题）。
4. 计算 SFT 的参数量与显卡利用率。
5. 用 RL 训练大模型 vs 小模型要改什么？

### 百度

1. DAPO、GSPO、GFPO 等 GRPO 变体分别试图解决哪些后训练问题？（面试大师收录原题）

### 中厂/创业公司（MiniMax、智谱系、六小龙及量化私募 AI 岗等）

侧重实战与系统：

1. 你们训练用什么框架？colocate 和 disaggregate 怎么选？
2. 训推不一致是什么？怎么修？（MiniMax 公开分享过 FP32 lm_head 案例，属"送分暗号"）
3. 异步训练的 staleness 怎么控制？partial rollout 是什么？
4. Agent RL 里工具返回的 token 参与 loss 吗？为什么？
5. reward hacking 见过什么案例，怎么防？

---

## 二、A 组精讲：PPO/GRPO 必考八股

### A1. GRPO 相比 PPO 的优缺点（字节/快手/阿里必考）

**回答骨架**：

- PPO：actor + critic（+RM + ref）四模型；GAE 从 value 估计 token 级优势；优点是通用、token 级 credit assignment；缺点是 critic 与 actor 同量级，显存和调参成本翻倍，value 估计不准时优势也不准。
- GRPO：对同一 prompt 采 n 条回答，用组内奖励的均值（默认再除以标准差）做 baseline，省掉 critic；优点是省显存、实现简单、天然适配可验证奖励（数学/代码）；缺点是要多倍 rollout 成本、优势是序列级标量（广播到 token，无时序分辨率）、组内奖励无差异时梯度为零、std 归一化引入难度偏差（简单/太难题被放大或缩小）。
- 落点：DeepSeek-R1 用 GRPO 出圈后，可验证任务的默认选择是 GRPO 系，但"critic-free 不是免费的"，代价转移到了 rollout。

**verl 加分点**：verl 里两者共用同一主循环，差别只是配置组合——`algorithm.adv_estimator=gae` 时启用 critic worker，`=grpo` 时 critic 自动不需要（`need_critic` 判断），`rollout.n>1` 提供组内样本，`norm_adv_by_std_in_grpo` 控制是否除 std。能说出"算法 = estimator + loss + 采样配置的组合，而不是一个独立 Trainer 类"就超过大多数候选人。

### A2. PPO 优势怎么算 / GAE 原理（必考）

**回答骨架**：优势 $A(s,a)=Q(s,a)-V(s)$，衡量动作比平均好多少，作用是给策略梯度降方差。GAE 用 TD 残差 $\delta_t = r_t + \gamma V(s_{t+1}) - V(s_t)$ 做指数加权：$A_t = \sum_l (\gamma\lambda)^l \delta_{t+l}$，等价递推 $A_t = \delta_t + \gamma\lambda A_{t+1}$ 从序列末端往回扫。$\lambda \to 0$ 低方差高偏差（一步 TD），$\lambda \to 1$ 无偏高方差（蒙特卡洛）。LLM 场景 $\gamma$ 常取 1，outcome reward 落在最后一个有效 token 上往回传。

**verl 加分点**：`compute_gae_advantage_return`（[`core_algos.py:215-263`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/trainer/ppo/core_algos.py#L215-L263)）先用未白化递推得到 `returns = raw_advantages + values` 给 critic 当回归目标，再只对 actor 用的 advantage 做 masked whitening；多轮场景 mask=0 的 observation token 跳过 TD 更新但递推状态跨越传递。能讲出"critic target 不用白化后的优势"这一实现细节非常加分。

### A3. 为什么组内全对/全错时这一步不起作用（字节原题）

**回答骨架**：GRPO 的优势是 $(r_i-\mu_g)/(\sigma_g+\epsilon)$。全对或全错时 $r_i=\mu_g$，每条优势都是 0，policy gradient 为零——这批样本白算了（占 batch 位置但无梯度）。这不是 bug 而是组相对基线的数学必然：没有组内差异就没有相对信号。

**解决方案（面试官等着你主动说）**：DAPO 的 Dynamic Sampling——过采样后把全对/全错组过滤掉并补充新组，保证 batch 内有效梯度密度；或者调 reward 粒度（加过程分/格式分制造差异）、调温度和 n 增加多样性、课程学习控制题目难度使 pass rate 处于中间区间。

**verl 加分点**：V1 的 ReplayBuffer 内置 group filter + refill 逻辑（`verl/trainer/ppo/v1/replay_buffer.py`，evict 后按 2k credit 补生成）；但过滤指标必须在 sampling 前可得——规则/流式 reward 可以，普通 colocated reward model 是 sample 之后才算分，无法驱动 refill，需要给 RM 配独立资源池。这个"数据依赖顺序"细节是区分背书和真懂的分水岭。

### A4. 组大小 n 如何影响训练（字节原题）

**回答骨架**：n 是"baseline 质量 vs rollout 成本"的旋钮。n 越大：组均值/方差估计越准，优势噪声越小；全对/全错概率越低（有效样本率高）；pass@k 类信号越丰富；但 rollout 计算量线性涨、单 step 时间被最长回答拖住（长尾更明显）。n 太小（如 2）时 baseline 噪声大，RLOO 场景 n=1 时 leave-one-out 数学上无定义。常见取 4–16，数学/代码任务 8 上下。

**verl 加分点**：`actor_rollout_ref.rollout.n` 控制；V1 里同一 `uid` 展开成多个 session（trajectory key `{uid}_{session_id}_{index}`），GRPO 按 uid 聚合。可顺带提：verl 的 RLOO 循环实现对 n=1 组保留原始 reward，而向量化实现会把它清零——两个"等价"实现语义相反，这是我提的 [PR #7150](https://github.com/verl-project/verl/pull/7150) 修复的 bug（修复在 review 中；详见 [PR 拆解篇](/blog/verl-guide-pr-deep-dive/)）。

### A5. GRPO 公式里为什么 clip 了外面还要 mean（字节原题）

**回答骨架**：这问的是目标函数结构 $\frac{1}{G}\sum_i \frac{1}{|o_i|}\sum_t \min(r_{i,t}A_i, \text{clip}(r_{i,t})A_i)$。clip 是对**单个 token 的 ratio** 做信任域截断，防止单点更新过猛；外层 mean 是把 token/序列级的逐点目标**聚合成标量 loss** 才能反向传播——一个是稳定性机制（作用在 ratio 上），一个是期望估计/聚合机制（作用在样本维度上），层次不同缺一不可。可以再进一层：怎么 mean 本身就是算法选择——按 token 平均还是按序列平均直接决定长度偏置（见 B 组 Dr.GRPO/DAPO）。

**verl 加分点**：verl 把这层"怎么 mean"显式做成 `loss_agg_mode`，当前五种：`token-mean`、`token-sum`（2026-08 新增）、`seq-mean-token-sum`、`seq-mean-token-mean`、`seq-mean-token-sum-norm`（`core_algos.py` 的 `agg_loss`）。

### A6. SFT 与 GRPO 优化目标的区别（字节原题）

**回答骨架**：形式上都是对生成 token 的 log-prob 加权求和。SFT 权重来自示范数据的 loss_mask（正样本恒为 1），最大化人写答案的似然，数据分布固定；GRPO/RL 权重是模型**自己采样**回答的 advantage（可正可负），好回答推高、差回答压低，数据分布随策略变化（on-policy）。本质区别：SFT 是模仿（分布内插值），RL 是试错优化（可以超越示范、也可能 reward hacking）；SFT 没有探索问题，RL 必须管理探索（温度/entropy/clip）。

### A7. PPO 损失是 token 级还是 sequence 级（快手原题）

**回答骨架**：标准 PPO-LLM 实现是 token 级：每个 response token 有自己的 ratio 和 advantage（GAE 时 advantage 逐 token 不同；GRPO 时同一序列共享标量 advantage 但 ratio 仍逐 token）。聚合成标量时的分母选择（token-mean vs seq-mean）造成不同长度偏置。GSPO（Qwen 团队 2025）则把 ratio 本身也提到序列级——序列似然的几何平均——clip 时整条序列一起裁剪，动机是 token 级 IS 权重在长序列和 MoE 上方差太大。答这题时把"advantage 粒度 / ratio 粒度 / 聚合粒度"三个层次分开说，就是满分结构。

### A8. 重要性采样原理（字节原题，串联训推不一致）

**回答骨架**：想估计 $\mathbb{E}_{x\sim p}[f(x)]$ 但样本来自 q，用恒等式 $\mathbb{E}_{x\sim p}[f] = \mathbb{E}_{x\sim q}[\frac{p}{q}f]$ 加权修正。无偏，但 p/q 差异大时权重方差爆炸，所以实践中截断（TIS）或掩码（MIS）超阈值权重，用一点偏差换方差。在 LLM RL 里出现在三处：PPO ratio 本身（current/old）；异步训练修正陈旧样本（old 来自几个版本前）；训推不一致修正（rollout 引擎的 log-prob ≠ 训练引擎的 log-prob）。能主动把第三处说出来，直接进入 2025 热点。

### A9. DPO vs PPO（阿里/快手常问，简答即可）

**回答骨架**：DPO 把 RLHF 的 reward + RL 两步用闭式解合并成偏好对上的监督损失（隐式 reward = β·log(π/π_ref) 差），不需要 rollout、RM、critic，训练稳定便宜；代价是离线（受限于静态偏好数据分布）、泛化不如在线 RL、无法处理多步/工具交互。选型：有现成偏好对、求稳 → DPO；有可验证 reward、求上限、多轮 Agent → 在线 RL（GRPO/PPO）。verl 是在线 RL 框架，DPO 类离线算法不是它的主场（SFT trainer 是独立入口）。

---

## 三、B 组精讲：GRPO 家族变体（DAPO/GSPO/Dr.GRPO/CISPO/GFPO）

这是 2025 年起最热的算法对比题。记住主线：**每个变体都在修 GRPO 的一个具体失败模式**。

| 变体 | 修什么失败模式 | 核心手段 |
|---|---|---|
| DAPO（字节+清华） | 熵坍缩、无效组、长度噪声 | Clip-Higher 非对称裁剪 + 动态采样过滤全对全错 + token 级 loss + 超长软惩罚，去 KL |
| Dr.GRPO | std 归一化的难度偏差 + 序列均值的长度偏差 | 去掉除 std；用固定常数（最大长度）代替 \|o\| 做分母 |
| GSPO（Qwen） | token 级 IS 权重高方差（长 CoT、MoE 尤甚） | ratio 提升到序列级（长度归一的序列似然比），整序列 clip |
| CISPO（MiniMax） | clip 直接丢掉低概率关键 token（如转折词 "wait"）的梯度 | 不裁 token 更新、改为裁 IS 权重本身，保留所有 token 梯度 |
| GFPO（微软） | 可验证 RL 后回答长度膨胀 | 采样更多候选，按长度/token 效率过滤后再更新 |

### B1. DAPO 四件套 +"verl 用 DAPO 该改哪些地方"（字节原题）

**先讲四件套**：

1. **Clip-Higher**：把上界 ε 调大（如 0.28）、下界不变。动机是对称 clip 下低概率 token 涨概率的空间被压死，熵快速坍缩；放宽上界保护探索。
2. **Dynamic Sampling**：过滤全对/全错组并补采样，保证有效梯度（见 A3）。
3. **Token-level loss**：长序列里每 token 等权（token-mean），不再按序列先平均——长回答里的错误 token 不再被稀释。
4. **Overlong reward shaping**：接近 max length 时软惩罚代替硬截断判错，消除截断带来的噪声信号。另外 DAPO 在推理任务上移除 KL 约束（模型本来就要大幅偏离 SFT 起点）。

**再答"verl 里改哪些地方"（这才是这道题的真考点）**：不需要写新 Trainer，DAPO 在 verl 里是配置组合 + 少量组件：

- Clip-Higher → `actor.clip_ratio_low/clip_ratio_high` 非对称设置；
- token 级 loss → `actor.policy_loss.loss_agg_mode=token-mean`；
- 去 KL → `actor.use_kl_loss=False` + `algorithm.use_kl_in_reward=False`（省 ref policy）；
- Overlong shaping → reward 函数里对接近 `max_response_length` 的样本做线性软惩罚；
- Dynamic Sampling → V1 ReplayBuffer 的 group filter + refill（注意 reward 必须在 sampling 前可得，RM 需独立资源池）；
- 参考 [`docs/algo/dapo.md`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/docs/algo/dapo.md)。

### B2. GSPO 为什么"序列级"（百度/字节追问）

**回答骨架**：GRPO 的 ratio 是逐 token 的 $\pi_\theta(y_t|\cdot)/\pi_{old}(y_t|\cdot)$，但 reward/advantage 是序列级的——优化单元和信号单元错位。长序列上逐 token ratio 连乘方差极大；MoE 下同一 token 两次前向可能路由到不同 expert，token 级 ratio 噪声更大。GSPO 定义序列级 ratio $s_i = (\pi_\theta(y|x)/\pi_{old}(y|x))^{1/|y|}$（长度归一防爆炸），clip 作用在整条序列上。效果：被 clip 的 token 比例远高于 GRPO 却训得更稳（丢的是整条偏移序列而不是随机 token）；对 MoE RL 稳定性改善明显，也是 Qwen3 系公开使用的算法。

**verl 加分点**：`actor.policy_loss.loss_mode=gspo`（`core_algos.py` 注册 `gspo`），与 `adv_estimator=grpo` 组合使用——再次印证"estimator 与 policy loss 是两个正交维度"。

### B3. Dr.GRPO：std 归一化为什么有偏（百度/字节追问）

**回答骨架**：两处偏差。其一，除以组内 std：简单题和太难题的组内 std 小，除完优势被放大——模型在"已会/学不会"的题上浪费步长，中等难度题反而信号被相对压小（难度偏差）。其二，GRPO 按 $1/|o_i|$ 做序列内平均：答对时短回答每 token 梯度更大（鼓励短对）、答错时长回答稀释惩罚（鼓励长错），组合效果是错误回答越来越长（长度偏差）。Dr.GRPO 去掉除 std、用固定常数替代 $|o_i|$ 分母，实验显示能保持精度同时显著缩短输出。

**verl 加分点**：`algorithm.norm_adv_by_std_in_grpo=False` 一键得到"去 std 版 GRPO"；长度维度用 `loss_agg_mode` 控制（`seq-mean-token-sum-norm` 即固定分母思路）。

### B4. CISPO（MiniMax 场景高频）

**回答骨架**：MiniMax 发现 PPO/GRPO 的 clip 会让低概率但关键的转折 token（"wait"、"however" 这类反思词）一旦被裁就永远拿不到梯度——long-CoT 的反思能力起不来。CISPO 的做法：不 clip token 更新本身，而是把 IS 权重视作系数并对其做截断（clip IS weight），保证所有 token 都有梯度、极端权重被控制。配合他们发现的 FP32 lm_head 训推一致性修复，在 MiniMax-M1/M2 系列上支撑了大规模 Agent RL。verl 的 policy loss registry 里已注册 `cispo` 模式。

---

## 四、C 组精讲：verl 框架架构题

### C1. verl 是什么？HybridFlow 的 hybrid 体现在哪？

90 秒版本见[系列第 1 篇](/blog/verl-guide-overview/)。hybrid 双关：**hybrid controller**——算法控制流用 single-controller（driver 全局视角，改算法只改控制流），模型计算用 multi-controller（SPMD，各 rank 自治高效），Ray 做胶水；**hybrid engine**——训练与推理分时共享同一批 GPU，通过权重 reshard 而不是复制来切换角色。论文 EuroSys 2025，对比 DeepSpeed-Chat/OpenRLHF/NeMo-Aligner 吞吐提升 1.5–20 倍。

### C2. 训推共卡时显存怎么管？（高频）

答案是一台状态机，按 colocate 一轮的顺序讲：

1. rollout 结束 → `sleep()`：释放 KV cache（vLLM sleep level 2 连权重一起释放；LoRA/MTP/NPU 用 level 1）；
2. 训练态恢复：actor 参数/优化器状态从 CPU offload 加载回 GPU（若开启）；
3. 前向反向 + optimizer step；
4. `update_weights`：`resume(tags=["weights"])` → 训练引擎按 per-tensor 导出并写入推理引擎（FSDP 聚合分片→vLLM 布局，LoRA 可先 merge）→ actor 参数可再 offload → `resume(tags=["kv_cache"])` 重建 KV cache；
5. 进入下一轮 rollout。

关键点：权重在 GPU 内存中转换布局，不落盘；顺序错了就是 OOM（两边状态叠加）或用旧权重生成（版本错乱）。代码：[`ActorRolloutRefWorker.update_weights`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/verl/workers/engine_workers.py#L719-L805)。

### C3. 权重同步的方案与保证（高频）

- 共置：进程内 naive 拷贝（V1 colocate 强制）；
- 分离：CheckpointEngine 统一抽象——NCCL 广播（bucketed）、NIXL P2P、Mooncake/Kimi 引擎，以及 delta_sharded（bytewise 稀疏差分，只传变化的位置和值，首轮全量 seed）；
- 必须保证：完整性（checksum）、版本原子性（一个 server 不能混两个版本的分片）、同步与请求边界一致（in-flight 请求要么 drain 要么 abort+续跑）、失败可检测可回退。
- 面试常追问 abort vs drain：drain 等在途请求完成（慢但简单），abort + partial rollout 保留半成品下次续（快但要处理跨版本轨迹的 log-prob 归属）。

### C4. TransferQueue 解决什么问题？

V0 所有 DataProto 都经 driver 单点搬运，规模大了成瓶颈。V1 把数据面下沉：轨迹级 KV 存储（key=`{uid}_{session_id}_{index}`），driver 只持有 `KVBatchMeta`（partition+keys+tags 的轻量句柄），各阶段按 key 就近读写大张量。收益：轨迹独立完成（不等整批）、支持异步流水、自定义 sampler 有统一数据面。注意它不替代 controller——算法顺序仍由 Trainer 决定。

### C5. sync / colocate_async / separate_async 怎么选？

- sync：版本最干净，先跑正确性；
- colocate_async：GPU 不够但想把生成和训练流水起来，sample 后 abort+sleep，支持 partial rollout；
- separate_async：有独立推理卡，hybrid 与 standalone replicas 并存，`parameter_sync_step`（默认 4）+ replay buffer `max_off_policy_threshold`（默认 8，drop/wait）控制陈旧度；自 #7188 起也支持 decoupled PPO（不再强制 bypass）。
- 决策依据：rollout 占 wall-clock 的比例、长尾程度、是否能容忍 off-policy、有没有独立资源。汇报吞吐收益时必须同时报 staleness 和最终学习曲线。

---

## 五、D 组精讲：2025–2026 三大热点专题

### 专题一：训推不一致（Training-Inference Mismatch）——2025 最热

**是什么**：同一份权重，vLLM/SGLang 算出的 log-prob 与 FSDP/Megatron 算出的不相等（算子实现、kernel 融合、TP 切分、浮点累加顺序、精度策略都不同）。于是"on-policy"训练实际是 $\pi_{rollout} \neq \pi_{train}$ 的 off-policy 问题，梯度有系统性偏差，长序列/长训练下积累成崩溃（字节 2025 论文《When Speed Kills Stability》系统分析了这一现象）。

**为什么 RL 才在乎**：SFT 只用自己前向的概率；RL 的样本来自推理引擎、梯度来自训练引擎，两个分布的比值直接进 loss，误差被 $\exp(\sum \Delta\log p)$ 逐 token 放大。MoE 更敏感（路由不一致）。

**修法光谱**（从算法到工程）：

1. **Token 级 TIS**：每 token IS 权重 $\min(\pi_{train}/\pi_{rollout}, C)$——有偏，字节实验显示后期仍可能崩；
2. **Sequence 级 TIS/MIS**：序列级权重截断（Seq-TIS）或超阈值整条丢弃（MIS/掩码 IS）——理论上更优（MIS 丢弃是无偏的拒绝采样视角），实验最稳，是社区当前推荐默认；DeepSeek-V3.2 论文用的 off-policy sequence masking 同思路（偏移大且 advantage 为负的序列直接 mask）；
3. **拒绝采样（RS/IcePop 系）**：按 k1/k3 散度阈值过滤 token/序列；
4. **工程对齐（Truly On Policy）**：对齐两侧算子做到 bit 级一致（slime 框架已演示 SGLang vs FSDP KL=0），代价是吞吐；
5. **定点修复**：MiniMax 案例——lm_head 用 FP32 后训推相关性大幅改善；排查思路就是把两侧 log-prob 打出来做散点图，看分段/离群。

**verl 对应**：`algorithm.rollout_correction` 全家桶——`rollout_is: token|sequence`（TIS，阈值默认 2.0，支持 IcePop 上下界写法）、`rollout_rs`（`token_k1`/`seq_sum_k1`/`seq_mean_k3` 等）、decoupled（三策略，重算 old）vs bypass（两策略，old=rollout）。监控 `rollout_corr/*` 指标（KL、k3_kl、训推 PPL 差、χ²、IS 有效样本率 ESS、RS 掩蔽比例）。数学推导见 [`docs/algo/rollout_corr_math.md`](https://github.com/verl-project/verl/blob/09ac37258ea66b0cb69b2738eec3074ea4e7261c/docs/algo/rollout_corr_math.md)——面试前值得通读，它就是按 REINFORCE→PPO→Decoupled PPO 的顺序写的教科书式材料。工程对齐一侧，verl 2026/05 还发布了 vexact（zero-mismatch 的 HF rollout 路径），可作为"框架自身也在做 bit 级对齐"的论据。

**面试标准答案模板**：先定义（同权重不同引擎分布不等）→ 后果（on-policy 假设破坏、长序列累积、MoE 放大、崩溃案例）→ 修法（seq 级 TIS/MIS 优先，token 级有偏；极致走 bit 对齐；定点查关键层精度）→ 监控（训推 KL、ESS、ratio 分布、clip fraction）→ 框架落点（verl rollout_correction / slime TIS+MIS / swift 同类参数）。

### 专题二：异步 RL 与 staleness——系统向必考

**问题**：同步 RL 的 step 时间被最长回答决定（长尾），GPU 大量空转；Agent 场景工具延迟更放大这一点。

**方案光谱**（面试按这个演进顺序讲）：

1. **one-step off-policy**：生成第 N+1 批时训练第 N 批，固定一步陈旧，实现简单但不灵活；
2. **fully async / streaming**（AReaL、StreamRL、MiniMax Forge、verl 的 fully_async_policy 实验路径）：Rollouter 与 Trainer 完全解耦，样本经队列流式供给，`staleness_threshold` 控制版本差，**partial rollout** 在参数同步时中断在途生成、保存前缀下个版本续写；verl 实测 32–128 卡约 2× 提速；
3. **verl V1 separate_async**（当前主推）：hybrid + standalone replicas 并存，`parameter_sync_step` 批间同步 + replay buffer 按模型版本 drop/wait，CI 已从实验路径迁移至此。

**核心权衡**：吞吐 vs 数据新鲜度。陈旧样本破坏 on-policy 假设 → 需要 rollout correction（decoupled PPO 的三策略框架天然覆盖：rollout→old 的偏移用 IS 修，old→current 用 PPO clip 管）。评价异步方案永远要同时报 wall-clock 学习曲线和 staleness 分布，不能只报 tokens/s。

**追问预备**：partial rollout 的轨迹跨版本，log-prob 记谁的？（记生成每段 token 时实际使用的版本——所以轨迹要携带 per-segment version/log-prob 元数据）；权重同步时在途请求 abort 还是 drain？（见 C3）；staleness 阈值怎么定？（看 IS 权重分布/ESS 和最终曲线，不是拍脑袋）。

### 专题三：Agentic RL——2026 面试增量最大的板块

**核心考点一：工具 token 参与 loss 吗？**
不参与 policy loss，但保留在 attention context。工具返回是环境 observation 不是策略动作；训练它等于教模型伪造工具结果。实现上就是 `response_mask`：模型生成 token 记 1、工具/环境 token 记 0（verl `AgentLoopOutput` 的三件套 `prompt_ids/response_ids/response_mask`）。模型自己生成的 tool call token 必须参与——否则学不会调工具。

**核心考点二：为什么必须 token-in/token-out？**
多轮结束后拿 messages 重新 `apply_chat_template` 再 tokenize，得到的 token 序列可能与推理引擎实际采样的不同（模板空格、特殊 token、tool 格式差异），old/current log-prob 对不上，PPO ratio 失真——官方文档明确说这会让训练无法收敛。所以 verl 的 server 是 token-in/token-out API 而不是 chat completion API，AgentLoop 逐轮累积真实 token 和 mask。

**核心考点三：异步 Agent Loop 为什么必要？**
工具调用延迟成百上千毫秒，同步会让 GPU 等 IO。verl 用 asyncio 协程并发跑每条轨迹的 agent loop，LLM server 按最少请求负载均衡 + 多轮 sticky session（prefix cache 命中）。

**核心考点四：长程信用分配与 reward 设计。**
纯 outcome reward 在 50 步任务上信号太稀疏。业界做法（MiniMax M2.x 公开分享）：过程奖励（每步合法性/进度）+ 任务完成时间惩罚 + reward-to-go 降方差；轨迹过滤掉统计异常的长尾（防梯度爆炸）；多 domain 混训防遗忘。verl 侧的对应物：AgentLoop 输出逐 turn 结构、reward 可按 step 落点、GRPO 之外可选 token 级 estimator。

**核心考点五：环境工程。**
数十万沙箱环境的调度、幂等重试（训练恢复后 prompt 会重发）、防 reward hacking（模型伪造 observation、钻 verifier 漏洞）。回答时把"环境失败 ≠ 策略失败"（要分开计数、不能一律零分）说出来会很加分。

---

## 六、E 组：手撕代码准备

高频两道，写熟到 10 分钟内默出：

### E1. GRPO 组内优势（numpy/torch 均可）

```python
def grpo_advantage(rewards, uids, norm_by_std=True, eps=1e-6):
    # rewards: (N,) 序列级 reward; uids: (N,) 组标签
    import torch
    uniq, gidx = torch.unique(torch.as_tensor(uids), return_inverse=True)  # 稠密化组号
    G = len(uniq)
    cnt = torch.zeros(G).index_add_(0, gidx, torch.ones_like(rewards))
    mean = torch.zeros(G).index_add_(0, gidx, rewards) / cnt.clamp_min(1)
    adv = rewards - mean[gidx]
    if norm_by_std:
        var = torch.zeros(G).index_add_(0, gidx, adv * adv) / (cnt - 1).clamp_min(1)
        adv = adv / (var.sqrt()[gidx] + eps)
    return adv  # 再广播乘 response_mask 得 token 级
```

注意点（也是面试官可能挖的坑）：组号要稠密化（`return_inverse`）、单样本组的除零、Bessel 校正、最后广播到 token 乘 mask。——恰好对应 verl `as_torch_index/group_mean_std` 的真实 bug（PR #7150）。

### E2. PPO clipped loss（token 级）

```python
def ppo_loss(logp, old_logp, adv, mask, clip_low=0.2, clip_high=0.2):
    ratio = (logp - old_logp).exp()
    l1 = ratio * adv
    l2 = ratio.clamp(1 - clip_low, 1 + clip_high) * adv
    loss_mat = -torch.min(l1, l2)
    return (loss_mat * mask).sum() / mask.sum()  # token-mean 聚合
```

准备好被追问：为什么用 log 差再 exp（数值稳定）；clip 只在 advantage 反方向起作用吗（min 结构的含义：正优势限上行、负优势限下行）；dual-clip 是什么（负优势极端 ratio 再加一层 c·A 下界）；聚合分母换成 per-seq 会怎样（长度偏置，接 B3）。

再备一个 GAE 递推（从后往前 `delta + gamma*lam*last`）和 KL 三种估计量（k1=logr、k2=r²/2 近似、k3=r-logr-1 低方差无偏）就基本覆盖手撕面。

---

## 七、F 组：把自己的 PR 讲成故事（如适用）

如果你有 verl 贡献（[PR 拆解篇](/blog/verl-guide-pr-deep-dive/)有 #7150/#7151 的完整精讲），面试叙事链建议：

1. 用 C 组的语言介绍 verl 定位（30 秒）；
2. 引到你的 PR 所在链路："advantage 估计器注册表里同一算法有循环版和向量化版，框架隐含承诺等价"（#7150）/"reward loop 汇总逐样本 extra_info 进 batch"（#7151）；
3. 讲 bug 本质（契约违反/schema 假设）→ 方法论（等价实现互测、契约验证）→ 修复取舍（向参考实现对齐、并集+None 填充）→ 验证纪律（fail-before/pass-after、基线 diff）；
4. 收尾接热点：这类"静默改变优化目标"的 bug 与训推不一致同属一族——都不报错、只让曲线慢慢不对，所以我的排查习惯是先对数据分布和等价性做审计。

---

## 八、反问面试官（体现段位）

- 你们 rollout 和训练是共卡还是分离？权重同步走什么通道，多大规模、多久一次？
- 训推不一致你们怎么处理——算法修正还是引擎对齐？监控哪些指标？
- 异步的 staleness 阈值怎么定的？partial rollout 用了吗？
- reward 是规则、RM 还是混合？怎么防 hacking、怎么做 verifier 的回归测试？
- Agent 任务的环境集群怎么管理？失败重试对 reward 统计的影响怎么处理？

---

## 参考材料（公开来源）

- 真题来源：牛客网字节/阿里/快手/腾讯面经（2025–2026 校招、实习）、面试大师（百度 GRPO 变体题）。
- 训推不一致：字节《When Speed Kills Stability》相关分析、slime 框架 mismatch 博客（TIS/MIS/Truly On Policy）、ms-swift Training-Inference-Mismatch 文档、DeepSeek-V3.2 off-policy sequence masking。
- 异步 RL：verl `docs/advance/fully_async.md`、verl v0.7 release blog（checkpoint engine、server mode）、AReaL/StreamRL 论文、MiniMax Forge 系统分享。
- Agentic RL：verl `docs/advance/agent_loop.rst`、`docs/start/agentic_rl.rst`、MiniMax M2.1/M2.5 后训练分享（CISPO、FP32 lm_head、过程奖励）。
- 算法变体：DAPO/GSPO/Dr.GRPO/GFPO 论文与 verl `docs/algo/` 对应文档、`docs/algo/rollout_corr_math.md`。
