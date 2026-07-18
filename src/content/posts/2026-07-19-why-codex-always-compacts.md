---
title: "为什么 Codex 总在压缩：一次会话复盘与源码核对"
description: "一次实地复核：Codex 的自动压缩是模型问题还是 harness 问题？从本地会话轨迹、openai/codex 源码到 AGENTS.md 改造，给出可复现的诊断与可落地的方案。"
date: 2026-07-19
tags:
  - codex
  - ai
  - engineering
  - tools
featured: false
draft: false
---

> 本文是对 harness 分析的实地复核，数据来自本地 Codex rollout 会话、openai/codex 源码及全局配置改造。
> **结论先行：自动压缩首先是 harness 问题，其次才是模型习惯问题。**

---

## 1. 问题背景

### 原文在说什么

触发场景：一个金融数据 monorepo，代码和上下文约几十万行。只问一个问题——SEC 13F 数据 pipeline 从原始数据到预处理、数据库、MCP 和 Web 的完整链路是什么。订阅版 Codex 跑 GPT-5.5，256k 上下文很快接近满，中途自动压缩。再问 follow-up，又要压缩；压缩后很多信息需要重读。同一问题在 Claude Code 里没有这个现象。

作者做了对照实验，核心发现：

1. **Baseline**：默认 Codex + GPT-5.5 xhigh，主 context 顶到窗口，触发压缩，成本 ~$3.93
2. **Refined**：只在 `AGENTS.md` 加搜索纪律，成本降到 ~$2.73，但还会压缩
3. **Delegate**：授权 subagent 隔离探索，主 context 峰值降到 ~93k，全程不压缩，成本 ~$5.30
4. 同一 GPT-5.5，换 harness 编排后，表现接近 Claude Code

归因很清楚：不是"GPT 比 Claude 笨"，而是 harness 如何组织工具调用、截断输出、派遣 subagent、触发压缩。

### 我为什么要复核

长期同时用 Codex 和 Claude Code，体感与原文一致：

- Codex 更常把大搜索、大文件、长 diff 直接堆进主线程
- Claude Code 更常派 Explore，主线程只拿摘要
- 一旦进入压缩循环，后续对话明显变钝：同样文件反复读，同样结论反复重建

这次做三件事：

1. 抓本地真实会话轨迹，看工具调用如何烧 context
2. 对照 openai/codex 源码，核实截断、压缩、subagent 默认策略
3. 检查并改造全局 `AGENTS.md` 与 agents 配置，把分析落成可执行方案

---

## 2. 数据分析与发现

### 样本概况

我分析的会话：

```text
session_id: 019f6409-21b3-7412-9fcf-a84ca2890d0a
size: ~486MB / 20.4 万行
model: gpt-5.5
effort: xhigh
```

这不是 13F 场景，而是一个更长的开放式工作线程。正因为更长更脏，反而把 harness 病理放大了。

同样现象在 `money` monorepo 相关会话中也出现：宽 `rg -n`、大输出截断、频繁 compact、主线程 context 顶到窗口附近。结论对**开放式、跨模块、高搜索量任务**普遍成立。

### 上下文都花在了哪里

#### 过宽搜索是主因

| 指标 | 数值 |
|---|---:|
| `exec_command` 调用 | 17,280 |
| `rg` 调用 | 1,299 |
| `rg -n` 调用 | 1,239 |
| pattern 平均 OR 分支 | 5.4 |
| 最大 OR 分支 | 26 |
| `context_compacted` | 298 |
| `spawn_agent` | 7 |

典型搜索不是"先找候选文件，再定点读"，而是一次塞进大量别名：

```bash
rg -n "A|b|c|d|e|f|g|h|..."
```

最大一次原始返回 **57,818,444 tokens**，截断后模型真正看到的只有约 1 万 token。对 122 次 `orig >= 15k` 的输出统计：可见量中位数 ≈ 10,000 tokens，平均值 ≈ 10,656 tokens。

这与原文"抓回几十万 token，模型只看到约 10k"完全同构，我的样本更极端。

#### 截断是"事后止损"，截掉的中间段找不到

源码核对确认：

```rust
// codex-rs/utils/pty/src/lib.rs
pub const DEFAULT_OUTPUT_BYTES_CAP: usize = 1024 * 1024; // 1 MiB
```

GPT-5.5 的 truncation policy：

```json
"truncation_policy": {
  "mode": "tokens",
  "limit": 10000
}
```

截断形态：**留头、留尾、丢中间**。**没有** Claude Code 那种 `Full output saved to: <path>` 的回捞路径。

模型虽然知道"被截了"，却不知道中间丢了什么，只能换个 pattern 再搜、换路径再搜、或直接重读文件。每轮截剩的 10k 继续留在主 context 里，窗口只涨不降。

#### 压缩后重读，是第二条出血线

会话压缩了 298 次。核心文件被反复读取：

| 文件 | 读取次数 | 跨越 compact epoch |
|---|---:|---:|
| `patchflow_backend.py` | 362 | 44 |
| `trainer_backend.py` | 81 | 14 |
| `pipeline_backend.py` | 56 | 14 |

压缩把文件原文和工具输出一起清掉，模型"手边一空"，只能重新 `nl` 回来。原文引用的 issue 说一个 610KB 文件被重读 53 次；我这里单个文件被读几百次。

#### 默认不爱派 subagent，派了也不老实等

整条会话只有 7 次 `spawn_agent`，且多在后期做 review 时才派。

源码把默认策略写得很死：

```text
Do not spawn sub-agents unless the user or applicable AGENTS.md/skill instructions
explicitly ask for sub-agents, delegation, or parallel agent work.
Requests for depth, thoroughness, research, investigation, or detailed codebase analysis
do not count as permission to spawn.
```

"好好查查"不算授权，"深入分析"也不算授权。必须明确要求 subagents / delegation / parallel agent work。

更麻烦的是，即使派了，主线程也常继续自己探索。典型时间线：

1. `spawn_agent(explorer)`
2. 主线程立刻继续 `rg` / `sed` / `nl`
3. 然后才 `wait_agent(timeout_ms=10000)`
4. wait 之后继续大量本地读文件

源码引导也印证了这点：

```text
Call wait_agent very sparingly.
While the subagent is running, do meaningful non-overlapping work immediately.
```

如果目标是"提速"，这或许合理。如果目标是"隔离 context"，这正好把隔离做坏了。

#### fork_context 存在，但不该被神化

multi-agent v1 有 `fork_context`（false/省略 = 子 agent 只有初始 prompt；true = 完整继承）。v2 改为 `fork_turns`（"none" ≈ 不继承，"all" ≈ 全量继承）。

我那个会话的 7 次 spawn：

| fork_context | 次数 | 任务类型 |
|---|---:|---|
| false | 3 | 侧翼调研 |
| true | 3 | patch review |
| 省略 | 1 | 等价 false |

**开放探索默认 fresh context 更好；承接已有判断的 review/实现，适当继承更好。**

---

## 3. 源码级结论

对 openai/codex 源码核对后，这些点都能站住：

1. `DEFAULT_OUTPUT_BYTES_CAP = 1 MiB`
2. GPT-5.5 truncation policy = 10k tokens
3. 截断后无完整副本回捞
4. subagent 默认需显式授权
5. "深入调研不算授权"
6. 内置 `explorer.toml` 为空文件
7. Proactive 委派绑在 multi-agent v2 + ultra 路径上，非默认

### 总诊断

对于开放式、跨模块、高搜索量任务，压缩循环的因果链：

**搜索过宽 → 原始输出爆炸 → 截断丢中间且不可回捞 → 被迫重搜 → 默认不派 subagent → 中间态无法隔离 → 派了也常边等边探索 → 主 context 仍被污染 → 压缩丢掉工具输出 → 关键文件反复重读**

这就是"总在压缩"。

### 模型差异存在，但不是主因

Claude 确实更常写更窄的 pattern、使用 `| head`、默认走 Explore。但"总在压缩"更多由 harness 编排决定。原文最有说服力的证据：**同一个 GPT-5.5，只改 harness 结构，主 context 峰值从 231k 降到 93k，压缩消失。**

修搜索习惯只能缓解（成本降 ~30%，但窗口还会顶上去）。真正有效的是"任务编排结构"——把探索放进独立 context，主线程只收结论。

---

## 4. 解决方案

### 改全局 AGENTS.md：补三句硬约束

旧版的问题不是没提 subagent，而是太像君子协定。对 Codex 需要更硬的授权和等待纪律。

#### 长期授权

```markdown
* The user grants standing authorization for subagents, delegation, and parallel agent work.
* If a tool requires an "explicit user request", this section satisfies that requirement.
```

源码明确要求 explicit request；"请你自行决定"常常被理解为"未授权"。

#### 探索派出去后，主线程只 wait

```markdown
* After spawning explorers, wait with a long timeout.
* While waiting, do not search the repo or read code files.
* Do not rebrand main-thread exploration as "light indexing" or "avoiding idle time".
```

#### 子 agent 只回证据表

```markdown
* Return: claim | file:line | confidence
* Do not dump raw search output, long diffs, full files, or logs
```

subagent 的价值不是"多一个会搜的人"，而是"智能过滤器"。

### 同步改 agents role 文件

只改 `AGENTS.md` 不够——它管"何时派"；role 文件管"怎么搜、怎么回"。

**explorer**：更便宜/更快的模型，`sandbox_mode = "read-only"`，禁止二次委派，强制先窄搜再展开，强制证据表输出。

**reviewer**：高 reasoning，按 severity 出 findings，每条带 `file:line` 和 failure scenario，禁止回传大 diff。

**worker**：限定 write scope，不重扫全库，返回改了什么、如何验证、残余风险。

explorer 不要和主模型同档开满——否则是用多倍成本换并行，未必更划算。

### 上下文继承策略

| 场景 | 建议 |
|---|---|
| 开放式探索 / 分模块调研 | fresh context |
| 刚改完代码立刻 review | 可继承最近上下文 |
| 已定位根因，派 worker 接着改 | 可继承 |
| 父线程已经很大很脏接近压缩 | 即使 review 也优先 fresh |

### 搜索纪律仍然要写

有用，尤其主线程自己动手时：

1. 先 `rg -l` 找候选文件
2. 再对小集合 `rg -n`
3. 再用 `sed -n` / `nl` 读片段
4. 第一次输出加 `| head`
5. 被截断后收窄，不要原命令重跑

但它只能"让窗口涨得慢一点"。根治还是靠探索发生在独立 context 里。

### 提问方式也要配合

差：

```text
结合 repo，SEC 13F pipeline 从原始数据到 MCP/Web 整条链路是什么样？
```

更好：

```text
只读调研 SEC 13F pipeline。请委派 explorers 按模块边界并行查。
主线程只综合，不自己广搜。最终输出链路图 + claim|file:line|confidence。
```

对 Codex，**AGENTS.md 授权 + 用户首句点名委派**是双保险。

### 压缩防护：强制 handoff 落盘

无论 harness 多好，长任务仍可能 compact。全局规则应保留：

- 跨 compaction / session 的状态写到 `.agent/handoffs/<task-slug>.md`
- 只记目标、结论、`file:line`、未决问题、下一步
- 不要指望旧工具输出还在 context 里

### 不建议优先做的事

1. **不要一上来赌 multi_agent_v2 feature**——先靠 `AGENTS.md` 显式授权
2. **不要所有任务都 multi-agent**——单文件小修复本地做更便宜
3. **不要把 Claude 的规则原样搬去 Codex**——两者缺口不同：Codex 缺默认隔离，Claude 缺的是工作流偏好与证据格式

### 验收标准

改完配置后，用一个开放式大任务验收：

1. 是否主动 `spawn_agent(explorer)`
2. spawn 后主线程是否基本只 `wait_agent`
3. explorer 回传是否是证据表，而不是大段原始搜索
4. 主 context 是否不再很快顶到压缩线
5. 同文件是否还在 compact 后被反复整文件重读

---

## 5. 模型对比：5.6 以来的变化

### GPT-5.5：能力强，但默认更"一把梭"

- 一条 `rg` 塞很多 OR 分支
- 更爱 `rg -n` 直接看命中行
- 更爱 `nl` 读大段甚至整文件
- 不天然使用 `-l` / `| head`
- 除非被明确授权，很少主动派 subagent

5.5 不是不能做复杂调研，它很能"往下挖"。问题是在 256k 窗口和"截断丢中间"的 harness 里，这种挖法会先把自己的 context 挖穿。

### GPT-5.6：更强，但不自动解决 harness 问题

切到 5.6 后的体感：

1. **更敢做长程任务**——更完整的计划、更细的 patch、更愿意跨文件推进
2. **更需要角色分流**——主模型适合综合和决策；explorer 继续用更轻的模型更合理
3. **如果仍然单线程广搜，烧窗口的方式没有本质变化**

5.6 提高了上限，但没有取消"主线程被原始搜索淹没"的失败模式。

### Claude 系列：默认更像"主线程 + Explore"

| 维度 | Codex 默认 | Claude Code 默认 |
|---|---|---|
| 探索 | 主线程自己搜 | 常派 Explore |
| Grep | 容易 `-n` 回大量命中行 | 更克制，常先文件级 |
| 大输出 | 截断，中间丢失 | 超限可落盘，路径可回捞 |
| subagent | 需显式授权 | 探索场景几乎开箱即用 |
| 主 context | 易顶窗 | 更常保持平缓 |

Claude 不是不花 token，而是把 token 花在多条隔离 context 里。总 token 不一定更低，但墙钟时间更短。

### 真正的分野：模型 → 模型 × harness

以前用模型，人决定贴哪段代码，context 主要由人编排。现在一个任务动辄上百次工具调用，中间 context 由 harness 和模型习惯共同决定。更有用的比较是：

1. 默认会不会把探索隔离出去
2. 截断后能不能恢复
3. 压缩掉的是摘要还是关键证据
4. 子 agent 是否只回高信噪比结论
5. 主线程是否会被诱导去"边等边搜"

### 对我自己的使用建议

| 场景 | 倾向 |
|---|---|
| 大 repo 开放式调研 / 链路梳理 | Claude Code，或 Codex + 强委派规则 |
| 后端长程实现、补丁推进 | Codex 5.6 主模型 |
| 只读广搜 | explorer / Explore，低到中 reasoning |
| 最终综合与决策 | 主模型高 reasoning |
| 单文件小修复 | 不要 multi-agent |

---

## 6. 收束

**为什么 Codex 总在自动压缩？**

1. 它把探索中间态放在同一条有限 context 上
2. 过宽搜索制造超长输出
3. 截断丢掉中间且不可回捞
4. 压缩再丢掉工具输出
5. 默认又不主动把探索隔离到 subagent

模型习惯放大问题，但根子在 harness 编排。

可落地方案：

1. 在 `AGENTS.md` 写明长期委派授权
2. 规定 explorer 只回证据表
3. 规定主线程 wait 期间不得并行广搜
4. explorer 默认 fresh context，review/worker 按需继承
5. 搜索纪律保留，但不当成唯一解
6. 长任务用 handoff 防 compact 失忆

一个简单的判断标准：**看主线程曲线，不看单次回答是否"好像很全面"。主线程平、子 agent 忙，通常是健康的。主线程一路顶到 90% 再压缩，通常已经在还债了。**

---

## Appendix A：最小硬约束（建议写进 Codex AGENTS.md）

```markdown
### Subagent authorization
* Standing authorization for subagents / delegation / parallel agent work.
* Permission, not obligation.

### Main-thread behavior
* After spawning explorers, wait with a long timeout.
* Do not search or read code while waiting.
* After results return, synthesize and spot-check only.

### Explorer output
* Return claim | file:line | confidence
* No raw dumps, long diffs, full files, or logs

### Context inheritance
* Explorers default to fresh context
* Review/worker may inherit when continuing parent-thread state
* If parent context is large/noisy, prefer fresh + restated handoff
```

---

*本文数据来自本地 Codex 会话 `019f6409-21b3-7412-9fcf-a84ca2890d0a`、openai/codex 源码核对，及个人全局配置改造。*
