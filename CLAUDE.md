# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目是什么

CocoAgent 是一个**本地桌面 AI 智能体**：Electron（主进程）+ React（渲染进程）+ Pi Agent SDK（`@earendil-works/pi-coding-agent`）驱动的完整 Agent Harness，能力包括文件操作、MCP 工具、Skills、多 Agent/人格、分层记忆、浏览器/桌面自动化（Browser Use / Computer Use）、路径级安全、自动更新。打包产物为 AppImage/deb（Windows 为 nsis，macOS 为 dmg）。

## 常用命令

包管理器是 **pnpm**（有 `pnpm-workspace.yaml`）。网络受限环境二进制走国内镜像（见 `.npmrc`）。

```bash
pnpm dev          # 开发模式（electron-vite dev，热重载）
pnpm build        # 构建 main/preload/renderer 到 out/（用 electron-vite build，非 typecheck）
pnpm typecheck    # tsc --noEmit 检查 main（tsconfig.node.json）+ web（tsconfig.web.json）
pnpm test         # 纯逻辑单元测试（jiti/node 跑 scripts/test-*.ts|mjs），均不依赖 Electron
pnpm dist:linux   # 构建 + electron-builder 打 AppImage/deb（产物在 release/）
pnpm repair:electron  # pnpm 重链可能抹掉 electron 二进制，此脚本重跑其 postinstall
```

开发环境若要隔离数据：设 `COCO_HOME` 环境变量到自定义目录，否则开发默认写 `~/.coco-dev`。

## 架构

三个进程 + 一份共享层，全部 TypeScript：

- **`src/main/`** — Electron 主进程（Node），持有 Pi SDK 的 `AgentSession` 和所有业务单例。入口 `index.ts`，IPC 统一在 `ipc/index.ts` 注册。
- **`src/renderer/`** — React 渲染进程。Zustand 管理状态（`stores/`），通过 `window.electronAPI` 与主进程通信。
- **`src/main/preload.ts`** — ContextBridge 暴露 `electronAPI`（`contextIsolation: true`，`nodeIntegration: false`）。渲染进程**只能**通过这里定义的命名空间（`agent/agents/security/settings/models/mcp/skills/browser/computer/app/update/toolApproval`）访问能力。改 preload 后记得同步 `shared/ipc-channels.ts` 与类型。
- **`src/shared/`** — 类型定义（`types.ts`）和 IPC 通道名常量（`ipc-channels.ts`），三个进程共用。

核心模块（`src/main/` 下，均为导出单例 `export const x = new X()`）：

- `paths.ts` — **所有路径的唯一来源**，模块加载时 bootstrap（建目录 + 改写 `PI_CODING_AGENT_DIR`），见「关键约定」。
- `db.ts` — **唯一 SQLite 数据库**（`node:sqlite`，WAL），五张表：settings/sessions/messages/memories/recent_workspaces/agents。所有持久化走这里，不再有 JSON 文件。
- `agent/AgentRuntime.ts` — 会话生命周期、消息流、工具/人格/安全注入。`newSession`/`switchSession` → `resolveModelRuntime()` + `buildResourceLoader()` + `buildCustomTools()` → `createAgentSession`。
- `agents/` — `AgentManager`（多 Agent 注册表 + 活跃 Agent）+ `persona.ts`（persona.md 读写与 system-prompt 文本生成）+ `frontmatter.ts`（纯解析，可单测）。
- `security/` — `pathPolicy.ts`（纯策略核，可单测）+ `PathGuard.ts`（状态壳：级别持久化、workspace root、symlink 解析）。
- `models/` — `ModelManager`（增删改/测试）+ `PiModelConfig`（物化 models.json/auth.json）+ `chatClient.ts`（一次性补全，复用于模型测试与记忆编译）。
- `memory/` — `MemoryService`（Agent 隔离、tier 分层、BM25+embedding 混合检索）+ `tiering.ts`（纯分层算法）+ `compiler.ts`（`memory_compile` 蒸馏工具）+ `tokenizer.ts`/`Bm25Index.ts`。
- `mcp/`、`skills/`、`browser/`、`computer/`、`approval/`、`update/`、`workspace/`、`settings/` — 各自领域，命名自解释。

所有 Agent 能力（编码工具、MCP 工具、记忆、浏览器、桌面）都是通过 Pi 的 **`defineTool`** 注册进 `createAgentSession({ customTools })` 的。新增能力 = 新建工具文件 → 挂到 `AgentRuntime.buildCustomTools()`。纯逻辑（分词、分层、frontmatter、路径策略）都拆在无 Electron 依赖的模块里，用 `scripts/test-*.ts` 覆盖。

## 关键约定与陷阱（改代码前必读）

1. **数据全在 `COCO_HOME` 下的 `coco.db`（SQLite/WAL）+ `agents/` + `skills/` + `runtime/pi-sdk/`，绝不写 `app.getPath('userData')`。**（`paths.ts` 是唯一路径源，模块加载即 bootstrap）。要新增持久化，优先在 `db.ts` 加表；文件类资产在 `paths.ts` 加字段。数据库迁移不写增量脚本——开发期数据可弃，直接改 schema。

2. **Pi SDK 只从 `models.json` + `auth.json` 发现模型，不读环境变量。** 这是「接入模型后 AI 无回复」事故的根因。`syncPiModelConfig()` 把 `ModelConfig[]` 写成 `${COCO_HOME}/runtime/pi-sdk/{models,auth}.json`，且 `createAgentSession` 必须**显式传** `agentDir` + `modelRuntime` + `model`。改模型逻辑时两步必须同步。格式见 `scripts/test-model-config.mjs`。

3. **自定义 resourceLoader 时 SDK 不再自动 `reload()`，必须自己调**（`AgentRuntime.buildResourceLoader`）。人格经 `appendSystemPrompt` 注入、Agent 技能经 `additionalSkillPaths` 注入——都挂在这一个 loader 上。

4. **Pi SDK 是 ESM-only 且被完整打包进主进程**（`externalizeDeps: false`）。packaged 的 `electron-builder.yml` 里 `files` 要 `!node_modules/**`——不要加回，否则体积翻倍。

5. **`PI_CODING_AGENT_DIR` 由 `paths.ts` 在进程内改写**（指向 pi-sdk 目录），兜住 SDK 内部无法透传 `agentDir` 的 `getAgentDir()` 调用。不要依赖也不要去掉。

6. **electron-builder 上游 bug**：`app-builder-lib@26` 声明 `@electron/get: ^3.0.0` 却用 ≥5 才有的 `ElectronDownloadCacheMode`。`pnpm-workspace.yaml` 的 scoped override 修复；AppImage/deb 需要 `directories.app: '.'`。别动这两处。

7. **错误必须浮到 UI。** `message_end` 的 `stopReason: 'error'/'aborted'` 要手动检查并 `emit(AGENT_EVENT_ERROR, ...)`，否则用户只看到空白。工具审批走 `approval/ApprovalManager`（危险工具弹窗）。

8. **安全级别是「不装配工具」而非「拦截调用」**：Pi 的 read/write/edit/bash 在 SDK 内部执行，应用层包不住。`readonly` 级别通过 `createAgentSession({ excludeTools })` 直接不交给模型写工具（`security/pathPolicy.ts` 的 `excludedToolsFor`）。已知边界：`workspace` 级别下 bash 仍可越界，OS 级沙盒未实现（UI 有标注）。

9. **记忆按 Agent 隔离**：`MemoryService.load(agentId)` 在切 Agent/切会话时必须重新调用。tier 加权只在一处应用（`applyTierWeights`），`searchLexical` 返回原始分——混合检索里别二次加权。`memory_compile` 取**最旧的** recent（老化淘汰语义）。

10. **中文/tokenization**：`memory/tokenizer.ts` 用 CJK bigram（无词库依赖）。改搜索相关代码时保持拉丁停用词 + bigram 语义，并跑 `scripts/test-bm25.ts`。

11. **Agent 即文件夹**：`${COCO_HOME}/agents/<id>/{persona.md, skills/}`，DB 只存注册表。备份 = 拷目录。删 Agent 级联删其 sessions/memories，且至少保留一个、`main` 不可删。
