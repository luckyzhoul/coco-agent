# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目是什么

CocoAgent 是一个**本地桌面 AI 智能体**：Electron（主进程）+ React（渲染进程）+ Pi Agent SDK（`@earendil-works/pi-coding-agent`）驱动的完整 Agent Harness，能力包括文件操作、MCP 工具、Skills、记忆、浏览器/桌面自动化（Browser Use / Computer Use）、自动更新。打包产物为 AppImage/deb（Windows 为 nsis，macOS 为 dmg）。

## 常用命令

包管理器是 **pnpm**（有 `pnpm-workspace.yaml`）。网络受限环境二进制走国内镜像（见 `.npmrc`）。

```bash
pnpm dev          # 开发模式（electron-vite dev，热重载）
pnpm build        # 构建 main/preload/renderer 到 out/（用 electron-vite build，非 typecheck）
pnpm typecheck    # tsc --noEmit 检查 main（tsconfig.node.json）+ web（tsconfig.web.json）
pnpm test         # 单元测试：BM25 分词/排序 + Pi 模型配置解析（jiti + node 各跑一个脚本）
pnpm dist:linux   # 构建 + electron-builder 打 AppImage/deb（产物在 release/）
pnpm repair:electron  # pnpm 重链可能抹掉 electron 二进制，此脚本重跑其 postinstall
```

开发环境若要隔离数据：设 `COCO_HOME` 环境变量到自定义目录，否则开发默认写 `~/.coco-dev`。

## 架构

三个进程 + 一份共享层，全部 TypeScript：

- **`src/main/`** — Electron 主进程（Node），持有 Pi SDK 的 `AgentSession` 和所有业务单例。入口 `index.ts`，IPC 统一在 `ipc/index.ts` 注册。
- **`src/renderer/`** — React 渲染进程。Zustand 管理状态（`stores/`），通过 `window.electronAPI` 与主进程通信。
- **`src/main/preload.ts`** — ContextBridge 暴露 `electronAPI`（`contextIsolation: true`，`nodeIntegration: false`）。渲染进程**只能**通过这里定义的 `agent/settings/models/mcp/skills/browser/computer/app/update/toolApproval` 命名空间访问能力。
- **`src/shared/`** — 类型定义（`types.ts`）和 IPC 通道名常量（`ipc-channels.ts`），三个进程共用。

核心模块（`src/main/` 下，均为导出单例 `export const x = new X()`）：

- `paths.ts` — **所有路径的唯一来源**，见下方「关键约定」。
- `agent/AgentRuntime.ts` — 会话生命周期、消息流、把工具注入 Pi。`sendMessage`/`switchSession` 都会先 `resolveModelRuntime()` 再 `createAgentSession`。
- `models/` — `ModelManager`（增删改/测试）+ `PiModelConfig`（把配置物化成 Pi 认的模型文件）。
- `mcp/` — `McpManager`（配置生命周期）+ `McpServer`（stdio JSON-RPC 客户端）+ `McpToolBridge`（用 `defineTool` 包装 MCP 工具）。
- `skills/`、`memory/`、`browser/`、`computer/`、`approval/`、`update/`、`workspace/`、`settings/` — 各自领域，命名自解释。

所有 Agent 能力（编码工具、MCP 工具、记忆、浏览器、桌面）都是通过 Pi 的 **`defineTool`** 注册进 `createAgentSession({ customTools })` 的。新增能力 = 新建工具文件 → 挂到 `AgentRuntime.buildCustomTools()`。

## 关键约定与陷阱（改代码前必读）

1. **数据全在 `COCO_HOME` 下，绝不写 `app.getPath('userData')`**（`paths.ts` 模块加载时即 bootstrap）。目录树：`settings.json`、`sessions/`、`skills/`、`memory.json`、`recent-workspaces.json`、`runtime/pi-sdk/`。要新增持久化路径，在 `paths.ts` 加字段，别在业务模块里拼 `userData`。

2. **Pi SDK 只从 `models.json` + `auth.json` 发现模型，不读环境变量。** 这是「接入模型后 AI 无回复」事故的根因。`syncPiModelConfig()` 把我们的 `ModelConfig[]` 写成 `${COCO_HOME}/runtime/pi-sdk/{models,auth}.json`，且 `createAgentSession` 必须**显式传** `agentDir`（指向 pi-sdk 目录）+ `modelRuntime` + `model`。改模型相关逻辑时，务必让这两步同步。模型/凭证格式见 `scripts/test-model-config.mjs`（可作为参考和回归测试）。

3. **Pi SDK 是 ESM-only 且被完整打包进主进程。** `electron.vite.config.ts` 里 main 用 `externalizeDeps: false`，产物是 `out/main/index.js` + 一堆 `out/main/chunks/*.js`（含整个 SDK）。因此 packaged 的 `electron-builder.yml` 里 `files` 要 `!node_modules/**` 排除运行时依赖——不要加回 `node_modules`，否则体积翻倍。

4. **`PI_CODING_AGENT_DIR` 由 `paths.ts` 在进程内改写**（指向 pi-sdk 目录），用于兜住 SDK 内部无法透传 `agentDir` 的 `getAgentDir()` 调用（`bin/`、`tools/`）。不要依赖也不要去掉这个兜底。

5. **electron-builder 有个上游依赖声明 bug**：`app-builder-lib@26` 声明 `@electron/get: ^3.0.0` 却调用只存在于 ≥5 的 `ElectronDownloadCacheMode`。`pnpm-workspace.yaml` 里用 scoped override（`app-builder-lib>@electron/get: ^5`）修复；另 AppImage/deb 目标需要 `directories.app: '.'`。改打包配置时别动这两处。

6. **错误必须浮到 UI。** Agent 流式事件里 `message_end` 的 `stopReason: 'error'/'aborted'` 要手动检查并 `emit(AGENT_EVENT_ERROR, ...)`，否则用户只会看到空白回复。工具审批走 `approval/ApprovalManager`（危险工具发 `TOOL_APPROVAL_REQUEST` 给渲染进程弹窗）。

7. **中文/tokenization**：记忆搜索的 `memory/tokenizer.ts` 用 bigram 处理中文（无词库依赖），BM25 索引见 `memory/Bm25Index.ts`。改搜索相关代码时保持拉丁停用词 + CJK bigram 语义。