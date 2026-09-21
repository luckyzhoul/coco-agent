# CocoAgent 本地桌面智能体 - 设计文档

**日期**：2026-09-20
**状态**：设计稿
**作者**：zhouliang18

---

## 1. 项目背景与目标

构建一个本地桌面智能体应用，类似 Claude Code / Pi Agent，能够操作本地文件，具备完整的 Agent Harness 能力（工具调用、Skills、MCP 集成、代码执行等）。

### 核心需求

- **产品形态**：本地桌面应用（Electron 打包）
- **核心交互**：聊天对话式，现代化 Web 风格 UI
- **技术栈**：Electron + React + TypeScript + Node.js
- **Agent Runtime**：基于 Pi Agent SDK，复用其工具、Skills、MCP 生态
- **文件操作**：仅限用户指定的工作目录
- **模型策略**：开发阶段用云端模型（DeepSeek OpenAI 兼容 / Ark Agent Plan），部署后切换到本地模型（Ollama）

### 核心能力

1. MCP 工具集成（Model Context Protocol）
2. Skills 技能系统
3. 代码执行 + 命令行工具
4. 记忆/知识库
5. Browser Use（浏览器自动化）
6. Computer Use（桌面自动化，后续阶段）

---

## 2. 整体架构

采用 Pi SDK 深度集成方案：直接在 Electron 主进程中运行 Pi Agent SDK，前端通过 IPC 与 Agent 会话通信。

```
┌──────────────────────────────────────────────────────────┐
│  Electron Renderer (React + TypeScript)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ ChatPanel│  │ Sidebar  │  │ Settings │  │ToolViewer│ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘ │
│       └──────────────┼──────────────┼──────────────┘    │
│                      │ IPC / ContextBridge              │
├──────────────────────┼───────────────────────────────────┤
│  Electron Main Process (Node.js)                        │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  AgentRuntime (Pi SDK 封装层)                     │   │
│  │  ┌─────────────────────────────────────────────┐ │   │
│  │  │  Pi AgentSessionRuntime                      │ │   │
│  │  │  - pi-ai (多模型 provider)                   │ │   │
│  │  │  - pi-agent-core (Agent 循环)               │ │   │
│  │  │  - pi-coding-agent (工具/Skills/扩展)       │ │   │
│  │  │  + MCP Extension + Skills + Browser Use     │ │   │
│  │  └─────────────────────────────────────────────┘ │   │
│  └──────────────────────┬───────────────────────────┘   │
│                         │                               │
│  ┌───────────┐  ┌───────▼───────┐  ┌────────────────┐  │
│  │ Workspace │  │  MCPManager   │  │  SkillManager  │  │
│  │  Manager  │  │  (MCP 服务管理)│  │  (技能管理)    │  │
│  └───────────┘  └───────────────┘  └────────────────┘  │
│                                                          │
│  ┌───────────┐  ┌───────────────┐  ┌────────────────┐  │
│  │  Model    │  │ MemoryService │  │  IPC Bridge    │  │
│  │  Manager  │  │ (MCP Server)  │  │  (事件转发)    │  │
│  └───────────┘  └───────────────┘  └────────────────┘  │
│                                                          │
│  ───────────────  本地资源  ─────────────────────────   │
│  文件系统 (工作目录) / MCP stdio 进程 / Ollama 本地模型   │
└──────────────────────────────────────────────────────────┘
```

### 核心数据流

1. 用户在渲染进程输入消息 → IPC `agent:sendMessage` → 主进程 AgentRuntime
2. Pi Agent 处理消息，调用工具（文件/MCP/代码执行等）→ 事件流式返回
3. 每个工具调用/状态变化通过 IPC 事件推送到渲染进程实时展示
4. 会话状态自动持久化到本地（JSONL，与 Pi 原生格式兼容）

---

## 3. Agent Runtime 设计

### 3.1 Pi SDK 集成

| Pi SDK 模块 | 用途 |
|-------------|------|
| `createAgentSessionRuntime()` | 会话管理（创建/切换/分叉/导入） |
| `createAgentSession()` | 单个会话的 Agent 循环 |
| `codingTools` / `readOnlyTools` | 内置文件/命令行工具集 |
| `DefaultResourceLoader` | Skills/扩展/配置 自动发现 |
| `pi-mcp-extension` | MCP 服务器集成 |
| `pi-agent-browser-native` | Browser Use 能力 |

### 3.2 AgentRuntime 封装层

在 Pi SDK 之上封装一层，对接 Electron IPC：

```typescript
class AgentRuntime {
  private runtime: AgentSessionRuntime;

  // 会话管理
  async newSession(workspace: string, options?: SessionOptions): string;
  async switchSession(sessionId: string): void;
  async deleteSession(sessionId: string): void;
  async listSessions(): SessionInfo[];

  // 消息交互
  async sendMessage(content: string, options?: SendOptions): void;
  async abort(): void;

  // 事件订阅（转发到渲染进程）
  on(event: 'message' | 'tool_call' | 'tool_result' | 'status' | 'error',
     callback: (data: any) => void): void;
}
```

### 3.3 权限控制

- **文件操作范围**：通过 Pi SDK 的工作目录参数限制，Agent 只能访问当前 workspace 内的文件
- **工具白名单**：启动时配置可用工具列表，危险工具（如 `bash`）可设置为需要用户确认
- **MCP 工具审批**：新增 MCP 工具时，首次使用需要用户确认
- **Computer Use**：完全由用户触发，需要明确授权后 Agent 才能控制鼠标键盘

### 3.4 模型配置

开发阶段支持：
- **DeepSeek**：OpenAI 兼容 API
- **Ark Agent Plan**：字节跳动火山引擎模型服务
- 其他 OpenAI 兼容 API

部署阶段：
- **Ollama**：本地模型服务（Pi SDK 原生支持），连接 `localhost:11434`

模型配置统一通过 `ModelManager` 管理，支持在设置页热切换（新会话生效）。

---

## 4. MCP & Skills 系统设计

### 4.1 MCP 管理 (MCPManager)

基于 Pi SDK 的 MCP 扩展，增加 UI 配置和管理能力。

**功能模块**：

| 模块 | 说明 |
|------|------|
| 配置管理 | 全局 MCP 配置 (`${COCO_HOME}/mcp.json`) + 工作区配置 (`${workspace}/.coco/mcp.json`) |
| 服务生命周期 | stdio 模式（本地进程）、SSE/HTTP 模式（远程）、健康检查 + 自动重连 |
| 日志收集 | MCP 服务日志收集，便于调试 |
| UI 集成 | 设置页增删改查、工具发现列表、工具调用可视化 |

**预置 MCP 服务器**（开箱即用）：
- `memory` - 记忆/知识库 MCP 服务（见 4.3 节）
- `browser` - 浏览器操作（通过 pi-agent-browser-native）
- `computer-use` - 桌面自动化（Phase 4）

### 4.2 Skills 管理 (SkillManager)

基于 Pi SDK 的 Skills 发现机制，增加可视化管理。

**技能发现位置**：
- 全局：`${COCO_HOME}/skills/`
- 工作区：`${workspace}/.coco/skills/`
- 内置：随应用打包的核心技能

**功能**：
- 已加载技能列表（侧边栏展示）
- 技能详情查看（描述、使用示例）
- 对话中相关技能自动建议
- 技能市场（Phase 4：浏览/搜索/安装/更新）

### 4.3 记忆/知识库服务

设计为独立的 MCP 服务（`memory-mcp`），通过 MCP 协议被 Agent 调用，同时可被其他模块复用。

```
Memory MCP Server
├── 存储层
│   ├── 向量数据库：LanceDB（轻量级本地方案）
│   └── 元数据存储：SQLite
│
├── 核心能力 (MCP Tools)
│   ├── memory.add()      - 添加记忆片段
│   ├── memory.search()   - 语义搜索
│   ├── memory.list()     - 列出记忆
│   └── memory.delete()   - 删除记忆
│
└── 自动记忆
    ├── 会话结束后自动提取关键信息
    ├── 工作区文件索引（代码文档化）
    └── 用户手动标记重要内容
```

---

## 5. 前端 UI 设计

### 5.1 整体布局

```
┌──────────────────────────────────────────────────────────┐
│  自定义标题栏  [← →]  当前工作区名              [ ⚙️ ]   │
├──────────────┬───────────────────────────────────────────┤
│              │                                           │
│  会话列表    │           Chat Panel                      │
│              │                                           │
│  📁 工作区   │   ┌─────────────────────────────────┐    │
│  └ 项目A     │   │  消息流（用户/助手/工具调用）   │    │
│    今日会话  │   │                                 │    │
│  + 新会话    │   │  ┌─ 工具调用卡片 ────────────┐  │    │
│              │   │  │  mcp:github / search      │  │    │
│  🧩 技能     │   │  │  ▸ 展开查看结果           │  │    │
│  └ 已加载 N  │   │  └──────────────────────────┘  │    │
│              │   │                                 │    │
│  🔌 MCP      │   │  （流式输出，实时更新）        │    │
│  └ 已连接 M  │   │                                 │    │
│              │   └─────────────────────────────────┘    │
│              │                                           │
│              │   [输入框：多行 + 附件 + /快捷命令]       │
│              │   [⏹ 中断]  [💾 保存]  [⌨️  快捷键]     │
└──────────────┴───────────────────────────────────────────┘
```

### 5.2 核心组件

| 组件 | 说明 |
|------|------|
| **ChatPanel** | 聊天主界面，Markdown 渲染、代码高亮、流式输出 |
| **ToolCallCard** | 工具调用卡片，可展开查看详情，支持 diff 视图 |
| **SessionList** | 会话列表，支持搜索、分组、删除、重命名 |
| **WorkspaceSelector** | 工作区选择器，切换工作目录 |
| **SettingsPanel** | 设置面板（模型/MCP/Skills/快捷键） |
| **SkillDetailModal** | 技能详情弹窗 |

### 5.3 关键交互

1. **流式消息展示**：Agent 回复逐字流式渲染，工具调用实时展示状态
2. **工具调用可视化**：工具调用以卡片形式嵌入消息流，可展开查看详情
3. **多工作区切换**：侧边栏顶部切换工作目录，每个工作区有独立的会话和配置
4. **快捷命令**：输入框输入 `/` 触发快捷命令菜单
5. **中断机制**：Agent 运行中随时可中断，已完成的工具调用结果保留

### 5.4 技术选型

| 类别 | 方案 | 理由 |
|------|------|------|
| 构建工具 | electron-vite | Vite + Electron 一体化，开发体验好 |
| UI 组件库 | shadcn/ui + Tailwind CSS | 现代化、可定制、轻量 |
| 状态管理 | Zustand | 简单轻量，适合中小型应用 |
| Markdown 渲染 | react-markdown + remark-gfm | 支持 GFM 语法 |
| 代码高亮 | shiki | 高质量语法高亮，多主题 |
| 图标 | lucide-react | 现代简洁图标库 |
| 包管理 | pnpm | 快速、节省磁盘空间 |

---

## 6. 工程化设计

### 6.1 项目结构

```
CocoAgent/
├── package.json              # 根配置
├── electron.vite.config.ts   # Electron + Vite 构建配置
│
├── src/
│   ├── main/                 # 主进程 (Node.js)
│   │   ├── index.ts          # 主进程入口
│   │   ├── preload.ts        # Preload 脚本 (ContextBridge)
│   │   ├── agent/            # Agent Runtime 封装
│   │   │   ├── AgentRuntime.ts
│   │   │   ├── SessionManager.ts
│   │   │   └── ToolGateway.ts
│   │   ├── mcp/              # MCP 管理
│   │   │   └── MCPManager.ts
│   │   ├── skills/           # Skills 管理
│   │   │   └── SkillManager.ts
│   │   ├── workspace/        # 工作区管理
│   │   │   └── WorkspaceManager.ts
│   │   ├── models/           # 模型配置管理
│   │   │   └── ModelManager.ts
│   │   ├── memory/           # 记忆服务 (MCP Server)
│   │   │   └── index.ts
│   │   └── ipc/              # IPC 通道注册
│   │       └── index.ts
│   │
│   ├── renderer/             # 渲染进程 (React)
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── chat/         # 聊天相关组件
│   │   │   ├── sidebar/      # 侧边栏
│   │   │   ├── settings/     # 设置面板
│   │   │   └── common/       # 通用组件
│   │   ├── hooks/            # 自定义 Hooks
│   │   ├── stores/           # Zustand stores
│   │   ├── types/            # TypeScript 类型
│   │   └── styles/           # 全局样式
│   │
│   └── shared/               # 主进程 & 渲染进程共享
│       ├── types.ts
│       ├── constants.ts
│       └── ipc-channels.ts
│
├── resources/                # 打包资源（图标等）
├── scripts/                  # 构建脚本
└── docs/                     # 文档
```

### 6.2 IPC 通道设计

| 通道前缀 | 用途 |
|----------|------|
| `agent:*` | Agent 会话相关（sendMessage, abort, newSession, listSessions...） |
| `agent:event:*` | Agent 事件推送（message, tool_call, tool_result, status, error） |
| `workspace:*` | 工作区管理（list, setCurrent, add, remove） |
| `mcp:*` | MCP 配置管理（list, add, remove, restart, getStatus） |
| `skills:*` | Skills 管理（list, getDetail, install, uninstall） |
| `settings:*` | 全局设置（get, set, reset） |
| `models:*` | 模型配置（listProviders, getCurrent, setProvider） |

---

## 7. 开发路线

分四个阶段迭代开发，每个阶段产出可用版本。

### Phase 1：最小可用版本 (MVP)

**目标**：能够聊天、操作文件、会话持久化

- [ ] 项目脚手架：Electron + React + TypeScript + Tailwind CSS
- [ ] Agent Runtime 集成：Pi SDK 基础会话 + 消息流式传输
- [ ] 基础聊天 UI：消息列表 + 输入框 + 流式输出
- [ ] 文件工具：读/写/编辑/搜索（Pi SDK 内置 codingTools）
- [ ] 会话持久化：JSONL 存储 + 会话列表
- [ ] 工作目录选择：基础单工作区

### Phase 2：核心能力增强

**目标**：MCP + Skills + 多模型配置

- [ ] MCP 集成：配置管理 + 工具调用可视化
- [ ] Skills 系统：技能发现 + 加载 + UI 展示
- [ ] 工作区管理：多工作区切换
- [ ] 模型配置：DeepSeek / OpenAI 兼容 / Ark / Ollama 切换
- [ ] 设置面板：模型/MCP/Skills/通用设置
- [ ] 侧边栏完整功能：会话列表 + 技能 + MCP 状态

### Phase 3：高级能力

**目标**：记忆 + 浏览器 + 审批机制

- [ ] 代码执行 + 命令行工具增强
- [ ] 记忆/知识库服务（MCP Server + 向量库）
- [ ] Browser Use 集成（pi-agent-browser-native）
- [ ] 工具调用审批机制（危险操作二次确认）
- [ ] 快捷键系统
- [ ] 搜索/过滤历史会话

### Phase 4：Computer Use & 打磨

**目标**：桌面自动化 + 产品化

- [ ] Computer Use 能力（桌面自动化）
- [ ] 技能市场（浏览/安装/更新）
- [ ] 性能优化 + 打包发布
- [ ] 自动更新机制
- [ ] 主题切换（浅色/深色）
- [ ] 国际化（中/英）

---

## 8. 验证方式

### 单元测试
- AgentRuntime 封装层
- MCPManager 配置管理
- ModelManager 模型配置
- WorkspaceManager 工作区管理

### 集成测试
- Agent 完整对话流程（端到端）
- MCP 服务器启动/工具调用/关闭
- 会话创建/切换/持久化

### 手动验证
- 启动 Electron 应用，完成一轮完整对话
- 接入 2-3 个真实 MCP 服务器验证集成效果
- 测试文件操作是否被正确限制在工作目录内
- 测试云端模型 → 本地模型切换是否正常工作
