---
title: "Coding Agent 源码解剖：Pi、Codex、DeepSeek Harness 与 Claude Code"
description: "固定到 2026-08-29 可核查的源码与发布物，系统比较四种 Coding Agent，并以截至 2026-08-30 的公开证据整理国内大厂 Agent 面试指南。"
lang: zh-CN
featured: true
draft: false
---

这套专题不按“谁的内置工具更多”排名，而是追问一个更稳定的问题：**每个 Agent 把控制权放在哪里？** Pi 把控制权交给 provider 与宿主扩展；Codex 交给 app-server、Session、安全 orchestrator 与共享多代理控制面；DeepSeek Harness 交给 Cordis effect composition 和 durable event surface；Claude Code 2.1.88 则围绕共享 `query()` 循环叠加完整产品能力。

专题先用固定版本和证据等级建立边界，再逐仓解释四个实现，从 Loop 与工具、安全与扩展、上下文与子代理、接口与可观测性四条横线比较。第 11 篇把这些源码机制映射到 2025–2026 国内大厂公开面经，提供公司画像、答题框架、P0/P1 题单和 14 天准备路线。源码能证明机制和不变量，不能直接推出模型完成率、延迟、成本或 benchmark 排名；公开面经也不能外推为公司统一题库。

## 证据边界

- Pi、OpenAI Codex 与 DeepSeek Harness 的源码链接固定到 2026-08-29 审阅 commit，避免主分支更新后行号漂移。
- Claude Code 的详细实现基于官方 npm 2.1.88 source map 中 1,902 个应用源码条目；本地恢复树完成 1,902/1,902 字节一致校验。
- Claude Code 2.1.251 已改为轻量 npm wrapper + 平台原生二进制，所以最新版只用于校准公开包装和类型契约，不能把 2.1.88 的内部实现外推过去。
- 本博客不托管 Claude Code 恢复源码、source map、npm tarball 或原生二进制；正文只保留非点击式源码坐标、公开哈希和官方发布物链接。

## 交互式代码地图

四份地图都是独立、self-contained 的 HTML。它们用于浏览模块关系、目录体量、符号与功能切面，不嵌入源码正文。

| Agent | 地图 | 结构焦点 |
|---|---|---|
| Pi | [打开交互地图](/maps/coding-agent-source/pi/) | 生产 CLI 与 durable/server 双线 |
| OpenAI Codex | [打开交互地图](/maps/coding-agent-source/codex/) | app-server、core、store 与 security crates |
| DeepSeek Harness | [打开交互地图](/maps/coding-agent-source/deepseek-harness/) | Cordis 与 package families |
| Claude Code 2.1.88 | [打开交互地图](/maps/coding-agent-source/claude-code/) | query loop 支撑目录与产品子系统 |

建议从第 1 篇开始顺序阅读；每篇末尾的系列目录会自动给出上一篇、下一篇和完整章节列表。
