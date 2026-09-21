# CocoAgent Phase 1 (MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal working desktop agent app — Electron + React UI, Pi SDK-powered chat, file tools, and session persistence.

**Architecture:** Electron main process hosts the Pi Agent SDK runtime. React renderer communicates via IPC (ContextBridge). Sessions persist as JSONL. All file operations scoped to a user-selected workspace directory.

**Tech Stack:** Electron 32, Vite 5, React 18, TypeScript 5, Tailwind CSS 3, shadcn/ui, Zustand, Pi Agent SDK (@earendil-works/pi-coding-agent), pnpm.

---

## File Structure Map

```
CocoAgent/
├── package.json                          # Root deps + scripts
├── pnpm-workspace.yaml                   # (single package for now)
├── tsconfig.json                         # Base TS config
├── tsconfig.node.json                    # Node/electron-main TS config
├── tsconfig.web.json                     # Renderer TS config
├── electron.vite.config.ts               # electron-vite build config
├── tailwind.config.js                    # Tailwind config (renderer)
├── postcss.config.js                     # PostCSS config
├── .gitignore
│
├── src/
│   ├── main/
│   │   ├── index.ts                      # Main process entry: create window, register IPC
│   │   ├── preload.ts                    # ContextBridge: expose safe APIs to renderer
│   │   ├── ipc/
│   │   │   └── index.ts                  # IPC handler registration (agent + workspace)
│   │   ├── agent/
│   │   │   ├── AgentRuntime.ts           # Pi SDK wrapper: session lifecycle + messaging
│   │   │   └── session-store.ts          # Session JSONL persistence helpers
│   │   └── workspace/
│   │       └── WorkspaceManager.ts       # Workspace directory selection + validation
│   │
│   ├── renderer/
│   │   ├── index.html                    # Renderer HTML entry
│   │   ├── main.tsx                      # React entry point
│   │   ├── App.tsx                       # Root component: layout + routing
│   │   ├── styles/
│   │   │   └── globals.css               # Tailwind + global styles
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── AppLayout.tsx         # Sidebar + main content layout
│   │   │   │   ├── Sidebar.tsx           # Session list + new session button
│   │   │   │   └── Titlebar.tsx          # Custom title bar
│   │   │   └── chat/
│   │   │       ├── ChatPanel.tsx         # Main chat view
│   │   │       ├── MessageList.tsx       # Scrollable message list
│   │   │       ├── MessageBubble.tsx     # Single message (user/assistant)
│   │   │       ├── ToolCallCard.tsx      # Tool call display card
│   │   │       └── ChatInput.tsx         # Message input + send button
│   │   ├── stores/
│   │   │   ├── useChatStore.ts           # Chat state (messages, active session)
│   │   │   └── useSessionStore.ts        # Session list state
│   │   └── hooks/
│   │       └── useIpcRenderer.ts         # Typed IPC hook
│   │
│   └── shared/
│       ├── types.ts                      # Shared types (Message, Session, ToolCall, etc.)
│       └── ipc-channels.ts               # IPC channel name constants
│
└── resources/
    └── icon.png                          # App icon (placeholder)
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`
- Create: `electron.vite.config.ts`, `tailwind.config.js`, `postcss.config.js`
- Create: `.gitignore`, `.gitattributes`

- [ ] **Step 1: Initialize package.json with all dependencies**

```json
{
  "name": "cocoagent",
  "version": "0.1.0",
  "description": "CocoAgent - Local desktop AI agent",
  "main": "out/main/index.js",
  "author": "zhouliang18",
  "license": "MIT",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "typecheck": "tsc --noEmit -p tsconfig.web.json && tsc --noEmit -p tsconfig.node.json",
    "lint": "eslint src --ext .ts,.tsx"
  },
  "dependencies": {
    "@earendil-works/pi-coding-agent": "^0.10.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "electron": "^32.0.0",
    "electron-vite": "^2.3.0",
    "postcss": "^8.4.39",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tailwindcss": "^3.4.6",
    "typescript": "^5.5.3",
    "vite": "^5.3.4"
  }
}
```

- [ ] **Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - '.'
```

- [ ] **Step 3: Create tsconfig.json (base)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"],
      "@renderer/*": ["src/renderer/*"],
      "@main/*": ["src/main/*"]
    }
  },
  "include": ["src/shared/**/*"]
}
```

- [ ] **Step 4: Create tsconfig.node.json (main process)**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "out/main",
    "types": ["node"]
  },
  "include": ["src/main/**/*", "src/shared/**/*"]
}
```

- [ ] **Step 5: Create tsconfig.web.json (renderer)**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"]
  },
  "include": ["src/renderer/**/*", "src/shared/**/*"]
}
```

- [ ] **Step 6: Create electron.vite.config.ts**

```typescript
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/main',
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'src/main/index.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload'
    }
  },
  renderer: {
    plugins: [react()],
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'src/renderer/index.html')
        }
      }
    },
    resolve: {
      alias: {
        '@shared': path.resolve(__dirname, 'src/shared'),
        '@renderer': path.resolve(__dirname, 'src/renderer')
      }
    }
  }
});
```

- [ ] **Step 7: Create tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/**/*.{js,ts,jsx,tsx,html}',
    './src/shared/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(240 10% 3.9%)',
        foreground: 'hsl(0 0% 98%)',
        card: 'hsl(240 6% 10%)',
        'card-foreground': 'hsl(0 0% 98%)',
        border: 'hsl(240 3.7% 15.9%)',
        input: 'hsl(240 3.7% 15.9%)',
        primary: 'hsl(240 5.9% 90%)',
        'primary-foreground': 'hsl(240 5.9% 10%)',
        secondary: 'hsl(240 3.7% 15.9%)',
        muted: 'hsl(240 3.7% 15.9%)',
        'muted-foreground': 'hsl(240 5% 64.9%)',
        accent: 'hsl(240 3.7% 15.9%)'
      },
      borderRadius: {
        lg: '0.5rem',
        md: 'calc(0.5rem - 2px)',
        sm: 'calc(0.5rem - 4px)'
      }
    }
  },
  plugins: [],
  darkMode: 'class'
};
```

- [ ] **Step 8: Create postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};
```

- [ ] **Step 9: Create .gitignore**

```
# Dependencies
node_modules/
.pnpm-store/

# Build output
out/
dist/
build/

# Electron
release/

# IDE
.vscode/
.idea/
*.swp
.DS_Store

# Logs
*.log
npm-debug.log*

# Env
.env
.env.local

# Agent data
.cocoagent/
sessions/
```

- [ ] **Step 10: Install dependencies**

Run: `pnpm install`
Expected: All packages install successfully, no peer dependency errors.

- [ ] **Step 11: Verify scaffolding builds**

Run: `pnpm typecheck`
Expected: Type check passes with 0 errors (empty source tree is fine).

- [ ] **Step 12: Commit scaffolding**

```bash
git add package.json pnpm-workspace.yaml tsconfig.json tsconfig.node.json tsconfig.web.json electron.vite.config.ts tailwind.config.js postcss.config.js .gitignore
git commit -m "chore: scaffold electron + react + tailwind project"
```

---

## Task 2: Shared Types & IPC Channel Constants

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/ipc-channels.ts`

- [ ] **Step 1: Create shared types**

```typescript
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: 'pending' | 'running' | 'success' | 'error';
  output?: string;
  error?: string;
}

export interface SessionInfo {
  id: string;
  title: string;
  workspacePath: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface AgentStatus {
  sessionId: string | null;
  state: 'idle' | 'thinking' | 'tool_calling' | 'responding' | 'error';
  currentTool?: string;
}

export interface WorkspaceInfo {
  path: string;
  name: string;
}
```

- [ ] **Step 2: Create IPC channel constants**

```typescript
// Agent control channels (renderer -> main)
export const AGENT_SEND_MESSAGE = 'agent:sendMessage';
export const AGENT_ABORT = 'agent:abort';
export const AGENT_NEW_SESSION = 'agent:newSession';
export const AGENT_SWITCH_SESSION = 'agent:switchSession';
export const AGENT_DELETE_SESSION = 'agent:deleteSession';
export const AGENT_LIST_SESSIONS = 'agent:listSessions';
export const AGENT_GET_SESSION_MESSAGES = 'agent:getSessionMessages';
export const AGENT_GET_STATUS = 'agent:getStatus';

// Agent event channels (main -> renderer)
export const AGENT_EVENT_MESSAGE = 'agent:event:message';
export const AGENT_EVENT_TOOL_CALL = 'agent:event:toolCall';
export const AGENT_EVENT_TOOL_RESULT = 'agent:event:toolResult';
export const AGENT_EVENT_STATUS = 'agent:event:status';
export const AGENT_EVENT_ERROR = 'agent:event:error';

// Workspace channels
export const WORKSPACE_SELECT = 'workspace:select';
export const WORKSPACE_GET_CURRENT = 'workspace:getCurrent';
export const WORKSPACE_LIST_RECENT = 'workspace:listRecent';
```

- [ ] **Step 3: Commit shared types**

```bash
git add src/shared/types.ts src/shared/ipc-channels.ts
git commit -m "feat: add shared types and IPC channel constants"
```

---

## Task 3: Main Process - Window & Preload

**Files:**
- Create: `src/main/index.ts`
- Create: `src/main/preload.ts`

- [ ] **Step 1: Create main process entry**

```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { registerIpcHandlers } from './ipc';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: true,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  registerIpcHandlers(ipcMain, () => mainWindow);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

- [ ] **Step 2: Create preload script with ContextBridge**

```typescript
import { contextBridge, ipcRenderer } from 'electron';
import type { Message, SessionInfo, AgentStatus, WorkspaceInfo } from '../shared/types';
import {
  AGENT_SEND_MESSAGE,
  AGENT_ABORT,
  AGENT_NEW_SESSION,
  AGENT_SWITCH_SESSION,
  AGENT_DELETE_SESSION,
  AGENT_LIST_SESSIONS,
  AGENT_GET_SESSION_MESSAGES,
  AGENT_GET_STATUS,
  AGENT_EVENT_MESSAGE,
  AGENT_EVENT_TOOL_CALL,
  AGENT_EVENT_TOOL_RESULT,
  AGENT_EVENT_STATUS,
  AGENT_EVENT_ERROR,
  WORKSPACE_SELECT,
  WORKSPACE_GET_CURRENT,
  WORKSPACE_LIST_RECENT
} from '../shared/ipc-channels';

const electronAPI = {
  agent: {
    sendMessage: (content: string) =>
      ipcRenderer.invoke(AGENT_SEND_MESSAGE, content),
    abort: () => ipcRenderer.invoke(AGENT_ABORT),
    newSession: (workspacePath: string) =>
      ipcRenderer.invoke(AGENT_NEW_SESSION, workspacePath),
    switchSession: (sessionId: string) =>
      ipcRenderer.invoke(AGENT_SWITCH_SESSION, sessionId),
    deleteSession: (sessionId: string) =>
      ipcRenderer.invoke(AGENT_DELETE_SESSION, sessionId),
    listSessions: () =>
      ipcRenderer.invoke(AGENT_LIST_SESSIONS) as Promise<SessionInfo[]>,
    getSessionMessages: (sessionId: string) =>
      ipcRenderer.invoke(AGENT_GET_SESSION_MESSAGES, sessionId) as Promise<Message[]>,
    getStatus: () =>
      ipcRenderer.invoke(AGENT_GET_STATUS) as Promise<AgentStatus>
  },
  workspace: {
    select: () =>
      ipcRenderer.invoke(WORKSPACE_SELECT) as Promise<WorkspaceInfo | null>,
    getCurrent: () =>
      ipcRenderer.invoke(WORKSPACE_GET_CURRENT) as Promise<WorkspaceInfo | null>,
    listRecent: () =>
      ipcRenderer.invoke(WORKSPACE_LIST_RECENT) as Promise<WorkspaceInfo[]>
  },
  on: {
    agentMessage: (callback: (msg: Message) => void) => {
      const listener = (_: unknown, msg: Message) => callback(msg);
      ipcRenderer.on(AGENT_EVENT_MESSAGE, listener);
      return () => ipcRenderer.removeListener(AGENT_EVENT_MESSAGE, listener);
    },
    agentToolCall: (callback: (data: { toolCall: unknown; messageId: string }) => void) => {
      const listener = (_: unknown, data: unknown) =>
        callback(data as { toolCall: unknown; messageId: string });
      ipcRenderer.on(AGENT_EVENT_TOOL_CALL, listener);
      return () => ipcRenderer.removeListener(AGENT_EVENT_TOOL_CALL, listener);
    },
    agentToolResult: (callback: (data: { toolCallId: string; output: string; status: string }) => void) => {
      const listener = (_: unknown, data: unknown) =>
        callback(data as { toolCallId: string; output: string; status: string });
      ipcRenderer.on(AGENT_EVENT_TOOL_RESULT, listener);
      return () => ipcRenderer.removeListener(AGENT_EVENT_TOOL_RESULT, listener);
    },
    agentStatus: (callback: (status: AgentStatus) => void) => {
      const listener = (_: unknown, status: AgentStatus) => callback(status);
      ipcRenderer.on(AGENT_EVENT_STATUS, listener);
      return () => ipcRenderer.removeListener(AGENT_EVENT_STATUS, listener);
    },
    agentError: (callback: (error: string) => void) => {
      const listener = (_: unknown, error: string) => callback(error);
      ipcRenderer.on(AGENT_EVENT_ERROR, listener);
      return () => ipcRenderer.removeListener(AGENT_EVENT_ERROR, listener);
    }
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
```

- [ ] **Step 3: Create IPC registration stub**

```typescript
// src/main/ipc/index.ts
import type { IpcMain } from 'electron';
import type { BrowserWindow } from 'electron';

export function registerIpcHandlers(
  ipcMain: IpcMain,
  getMainWindow: () => BrowserWindow | null
): void {
  // IPC handlers will be registered here in subsequent tasks
  // Stub for now so the app boots
  console.log('[IPC] Handlers registered (stub)');
  void ipcMain;
  void getMainWindow;
}
```

- [ ] **Step 4: Create renderer HTML entry**

```html
<!-- src/renderer/index.html -->
<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CocoAgent</title>
  </head>
  <body class="bg-background text-foreground">
    <div id="root"></div>
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create renderer entry + global styles**

```tsx
// src/renderer/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

```css
/* src/renderer/styles/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-background text-foreground antialiased;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  #root {
    @apply h-screen w-screen overflow-hidden;
  }

  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    @apply bg-transparent;
  }

  ::-webkit-scrollbar-thumb {
    @apply bg-muted rounded-md;
  }

  ::-webkit-scrollbar-thumb:hover {
    @apply bg-muted-foreground/30;
  }
}
```

```tsx
// src/renderer/App.tsx
import React from 'react';

export default function App() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">CocoAgent</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify the app boots**

Run: `pnpm dev`
Expected: Electron window opens, shows "CocoAgent / Loading..." text, no console errors.
(Manually verify and close the window.)

- [ ] **Step 7: Commit main process + renderer shell**

```bash
git add src/main/index.ts src/main/preload.ts src/main/ipc/index.ts src/renderer/index.html src/renderer/main.tsx src/renderer/App.tsx src/renderer/styles/globals.css
git commit -m "feat: bootstrap electron main process and react renderer shell"
```

---

## Task 4: Workspace Manager

**Files:**
- Create: `src/main/workspace/WorkspaceManager.ts`
- Modify: `src/main/ipc/index.ts` — add workspace IPC handlers

- [ ] **Step 1: Implement WorkspaceManager**

```typescript
import { app, dialog } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { WorkspaceInfo } from '../../shared/types';

const RECENT_WORKSPACES_FILE = 'recent-workspaces.json';
const MAX_RECENT = 10;

export class WorkspaceManager {
  private currentWorkspace: WorkspaceInfo | null = null;
  private recentWorkspaces: WorkspaceInfo[] = [];
  private dataDir: string;

  constructor() {
    this.dataDir = path.join(app.getPath('userData'), 'cocoagent');
    this.ensureDataDir();
    this.loadRecentWorkspaces();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private getRecentFilePath(): string {
    return path.join(this.dataDir, RECENT_WORKSPACES_FILE);
  }

  private loadRecentWorkspaces(): void {
    try {
      const file = this.getRecentFilePath();
      if (fs.existsSync(file)) {
        const data = fs.readFileSync(file, 'utf-8');
        this.recentWorkspaces = JSON.parse(data);
      }
    } catch {
      this.recentWorkspaces = [];
    }
  }

  private saveRecentWorkspaces(): void {
    try {
      fs.writeFileSync(
        this.getRecentFilePath(),
        JSON.stringify(this.recentWorkspaces, null, 2)
      );
    } catch {
      // Non-fatal
    }
  }

  private validatePath(dirPath: string): boolean {
    try {
      const stat = fs.statSync(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  async selectDirectory(parentWindow: Electron.BrowserWindow | null): Promise<WorkspaceInfo | null> {
    const result = await dialog.showOpenDialog(parentWindow!, {
      title: 'Select Workspace Directory',
      properties: ['openDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const dirPath = result.filePaths[0];
    if (!this.validatePath(dirPath)) {
      throw new Error(`Invalid directory: ${dirPath}`);
    }

    const info: WorkspaceInfo = {
      path: dirPath,
      name: path.basename(dirPath) || dirPath
    };

    this.currentWorkspace = info;
    this.addToRecent(info);
    return info;
  }

  getCurrent(): WorkspaceInfo | null {
    return this.currentWorkspace;
  }

  setCurrent(workspace: WorkspaceInfo): void {
    if (!this.validatePath(workspace.path)) {
      throw new Error(`Invalid workspace path: ${workspace.path}`);
    }
    this.currentWorkspace = workspace;
    this.addToRecent(workspace);
  }

  listRecent(): WorkspaceInfo[] {
    return this.recentWorkspaces;
  }

  private addToRecent(workspace: WorkspaceInfo): void {
    this.recentWorkspaces = this.recentWorkspaces.filter(
      w => w.path !== workspace.path
    );
    this.recentWorkspaces.unshift(workspace);
    this.recentWorkspaces = this.recentWorkspaces.slice(0, MAX_RECENT);
    this.saveRecentWorkspaces();
  }
}

export const workspaceManager = new WorkspaceManager();
```

- [ ] **Step 2: Register workspace IPC handlers**

Update `src/main/ipc/index.ts`:

```typescript
import type { IpcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { workspaceManager } from '../workspace/WorkspaceManager';
import {
  WORKSPACE_SELECT,
  WORKSPACE_GET_CURRENT,
  WORKSPACE_LIST_RECENT
} from '../../shared/ipc-channels';

export function registerIpcHandlers(
  ipcMain: IpcMain,
  getMainWindow: () => BrowserWindow | null
): void {
  ipcMain.handle(WORKSPACE_SELECT, async () => {
    return workspaceManager.selectDirectory(getMainWindow());
  });

  ipcMain.handle(WORKSPACE_GET_CURRENT, () => {
    return workspaceManager.getCurrent();
  });

  ipcMain.handle(WORKSPACE_LIST_RECENT, () => {
    return workspaceManager.listRecent();
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: Passes with 0 errors.

- [ ] **Step 4: Commit workspace manager**

```bash
git add src/main/workspace/WorkspaceManager.ts src/main/ipc/index.ts
git commit -m "feat: add workspace manager with directory selection"
```

---

## Task 5: Agent Runtime (Pi SDK Integration)

**Files:**
- Create: `src/main/agent/AgentRuntime.ts`
- Create: `src/main/agent/session-store.ts`

- [ ] **Step 1: Verify Pi SDK package availability first**

Run: `pnpm ls @earendil-works/pi-coding-agent 2>&1 || echo "PACKAGE_NOT_FOUND"`

If the package is not found or has a different name, adjust imports. The plan uses `@earendil-works/pi-coding-agent` as the package name and assumes it exports `createAgentSession`, `createAgentSessionRuntime`, and `codingTools`. If the actual API differs, adapt the implementation to match.

- [ ] **Step 2: Create session store (JSONL persistence)**

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';
import type { Message, SessionInfo } from '../../shared/types';

function getDataDir(): string {
  const dir = path.join(app.getPath('userData'), 'cocoagent', 'sessions');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getSessionFilePath(sessionId: string): string {
  return path.join(getDataDir(), `${sessionId}.jsonl`);
}

function getMetaPath(): string {
  return path.join(getDataDir(), 'meta.json');
}

interface SessionMeta {
  id: string;
  title: string;
  workspacePath: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

function loadMeta(): SessionMeta[] {
  try {
    const file = getMetaPath();
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
  } catch {
    // Corrupted file, start fresh
  }
  return [];
}

function saveMeta(metas: SessionMeta[]): void {
  fs.writeFileSync(getMetaPath(), JSON.stringify(metas, null, 2));
}

export function listSessions(): SessionInfo[] {
  const metas = loadMeta();
  return metas
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(m => ({
      id: m.id,
      title: m.title,
      workspacePath: m.workspacePath,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      messageCount: m.messageCount
    }));
}

export function createSessionMeta(
  sessionId: string,
  workspacePath: string,
  title: string
): void {
  const metas = loadMeta();
  const now = Date.now();
  metas.push({
    id: sessionId,
    title,
    workspacePath,
    createdAt: now,
    updatedAt: now,
    messageCount: 0
  });
  saveMeta(metas);
}

export function updateSessionMeta(
  sessionId: string,
  updates: Partial<Pick<SessionMeta, 'title' | 'messageCount'>>
): void {
  const metas = loadMeta();
  const idx = metas.findIndex(m => m.id === sessionId);
  if (idx === -1) return;
  metas[idx] = { ...metas[idx], ...updates, updatedAt: Date.now() };
  saveMeta(metas);
}

export function deleteSession(sessionId: string): void {
  // Remove meta entry
  const metas = loadMeta().filter(m => m.id !== sessionId);
  saveMeta(metas);
  // Remove JSONL file
  const file = getSessionFilePath(sessionId);
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
}

export function appendMessage(sessionId: string, message: Message): void {
  const file = getSessionFilePath(sessionId);
  fs.appendFileSync(file, JSON.stringify(message) + '\n');
}

export function loadSessionMessages(sessionId: string): Message[] {
  const file = getSessionFilePath(sessionId);
  if (!fs.existsSync(file)) return [];

  const lines = fs.readFileSync(file, 'utf-8').trim().split('\n');
  const messages: Message[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      messages.push(JSON.parse(line));
    } catch {
      // Skip malformed lines
    }
  }
  return messages;
}

export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
```

- [ ] **Step 3: Create AgentRuntime wrapper**

```typescript
import type { BrowserWindow } from 'electron';
import {
  AGENT_EVENT_MESSAGE,
  AGENT_EVENT_TOOL_CALL,
  AGENT_EVENT_TOOL_RESULT,
  AGENT_EVENT_STATUS,
  AGENT_EVENT_ERROR
} from '../../shared/ipc-channels';
import type { Message, ToolCall, AgentStatus, SessionInfo } from '../../shared/types';
import {
  listSessions,
  createSessionMeta,
  updateSessionMeta,
  deleteSession,
  appendMessage,
  loadSessionMessages,
  generateSessionId
} from './session-store';

// Pi SDK imports - adapt based on actual package exports
// These are the expected exports; adjust if the actual API differs
import {
  createAgentSessionRuntime,
  codingTools
} from '@earendil-works/pi-coding-agent';

type PiSession = unknown;
type PiRuntime = unknown;

export class AgentRuntime {
  private runtime: PiRuntime | null = null;
  private activeSession: PiSession | null = null;
  private activeSessionId: string | null = null;
  private status: AgentStatus = { sessionId: null, state: 'idle' };
  private mainWindow: BrowserWindow | null = null;
  private messageCount: number = 0;

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  private emit(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  private setStatus(status: Partial<AgentStatus>): void {
    this.status = { ...this.status, ...status };
    this.emit(AGENT_EVENT_STATUS, this.status);
  }

  async init(): Promise<void> {
    if (this.runtime) return;
    this.runtime = createAgentSessionRuntime({
      // Base config - workspace is set per-session
      tools: codingTools
    }) as PiRuntime;
  }

  async newSession(workspacePath: string): Promise<string> {
    await this.init();

    const sessionId = generateSessionId();
    const title = `New Chat ${new Date().toLocaleTimeString()}`;

    // Create Pi agent session scoped to workspace
    const session = (this.runtime as any).newSession({
      cwd: workspacePath,
      tools: codingTools,
      systemPrompt:
        'You are CocoAgent, a helpful AI assistant that helps users with coding and file tasks. ' +
        'You have access to the files in the current workspace directory. ' +
        'Be concise and helpful. Always verify file paths before making changes.'
    }) as PiSession;

    this.activeSession = session;
    this.activeSessionId = sessionId;
    this.messageCount = 0;

    createSessionMeta(sessionId, workspacePath, title);
    this.setStatus({ sessionId, state: 'idle' });

    return sessionId;
  }

  async switchSession(sessionId: string): Promise<void> {
    await this.init();

    const sessions = listSessions();
    const meta = sessions.find(s => s.id === sessionId);
    if (!meta) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Recreate session from stored messages
    const messages = loadSessionMessages(sessionId);
    const session = (this.runtime as any).newSession({
      cwd: meta.workspacePath,
      tools: codingTools,
      initialMessages: messages.map(m => ({
        role: m.role,
        content: m.content
      }))
    }) as PiSession;

    this.activeSession = session;
    this.activeSessionId = sessionId;
    this.messageCount = meta.messageCount;
    this.setStatus({ sessionId, state: 'idle' });
  }

  deleteSession(sessionId: string): void {
    if (this.activeSessionId === sessionId) {
      this.activeSession = null;
      this.activeSessionId = null;
      this.setStatus({ sessionId: null, state: 'idle' });
    }
    deleteSession(sessionId);
  }

  listSessions(): SessionInfo[] {
    return listSessions();
  }

  getSessionMessages(sessionId: string): Message[] {
    return loadSessionMessages(sessionId);
  }

  getStatus(): AgentStatus {
    return this.status;
  }

  async sendMessage(content: string): Promise<void> {
    if (!this.activeSession || !this.activeSessionId) {
      throw new Error('No active session');
    }

    // Add user message
    const userMsg: Message = {
      id: `msg_${Date.now()}_u`,
      role: 'user',
      content,
      timestamp: Date.now()
    };
    appendMessage(this.activeSessionId, userMsg);
    this.emit(AGENT_EVENT_MESSAGE, userMsg);
    this.messageCount++;

    try {
      this.setStatus({ state: 'thinking' });

      // Stream assistant response
      const stream = (this.activeSession as any).sendMessage(content);

      let assistantContent = '';
      const activeToolCalls: Map<string, ToolCall> = new Map();

      for await (const event of stream) {
        switch (event.type) {
          case 'text':
          case 'content':
            assistantContent += event.text || event.content || '';
            this.setStatus({ state: 'responding' });
            break;

          case 'tool_call_start':
          case 'toolCall': {
            const toolId = event.id || `tool_${Date.now()}`;
            const toolCall: ToolCall = {
              id: toolId,
              name: event.name || event.toolName || 'unknown',
              input: event.input || event.arguments || {},
              status: 'running'
            };
            activeToolCalls.set(toolId, toolCall);
            this.setStatus({ state: 'tool_calling', currentTool: toolCall.name });
            this.emit(AGENT_EVENT_TOOL_CALL, {
              toolCall,
              messageId: this.activeSessionId
            });
            break;
          }

          case 'tool_call_end':
          case 'toolResult': {
            const toolId = event.id || event.toolCallId;
            const toolCall = activeToolCalls.get(toolId);
            if (toolCall) {
              toolCall.status = event.error ? 'error' : 'success';
              toolCall.output = event.output || event.result || '';
              toolCall.error = event.error || undefined;
              this.emit(AGENT_EVENT_TOOL_RESULT, {
                toolCallId: toolId,
                output: toolCall.output,
                status: toolCall.status
              });
            }
            break;
          }

          case 'error':
            this.emit(AGENT_EVENT_ERROR, event.error || event.message || 'Unknown error');
            this.setStatus({ state: 'error' });
            break;
        }
      }

      // Save final assistant message
      const toolCalls = Array.from(activeToolCalls.values());
      const assistantMsg: Message = {
        id: `msg_${Date.now()}_a`,
        role: 'assistant',
        content: assistantContent,
        timestamp: Date.now(),
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined
      };
      appendMessage(this.activeSessionId, assistantMsg);
      this.emit(AGENT_EVENT_MESSAGE, assistantMsg);
      this.messageCount += 2; // user + assistant

      // Update meta
      const sessions = listSessions();
      const meta = sessions.find(s => s.id === this.activeSessionId);
      if (meta) {
        const firstLine = assistantContent.trim().split('\n')[0].slice(0, 50);
        updateSessionMeta(this.activeSessionId!, {
          title: firstLine || meta.title,
          messageCount: this.messageCount
        });
      }

      this.setStatus({ state: 'idle', currentTool: undefined });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.emit(AGENT_EVENT_ERROR, errorMsg);
      this.setStatus({ state: 'error' });
    }
  }

  async abort(): Promise<void> {
    if (this.activeSession && typeof (this.activeSession as any).abort === 'function') {
      try {
        await (this.activeSession as any).abort();
      } catch {
        // Best effort
      }
    }
    this.setStatus({ state: 'idle', currentTool: undefined });
  }
}

export const agentRuntime = new AgentRuntime();
```

- [ ] **Step 4: Typecheck and note any API mismatches**

Run: `pnpm typecheck 2>&1`
Expected: May have type errors if Pi SDK exports differ. **Fix import paths and type names to match the actual Pi SDK API**, then re-run typecheck until it passes.

Key things to verify in the actual Pi SDK:
- Package name (`@earendil-works/pi-coding-agent` vs `@mariozechner/pi-coding-agent` vs `pi-coding-agent`)
- Function names (`createAgentSessionRuntime` vs `createAgentSession`)
- Event types (stream event shape)
- Tool exports (`codingTools` name and shape)

- [ ] **Step 5: Commit AgentRuntime**

```bash
git add src/main/agent/AgentRuntime.ts src/main/agent/session-store.ts
git commit -m "feat: implement AgentRuntime with Pi SDK integration and session persistence"
```

---

## Task 6: Agent IPC Handlers

**Files:**
- Modify: `src/main/ipc/index.ts` — register agent IPC handlers
- Modify: `src/main/index.ts` — pass main window to agentRuntime

- [ ] **Step 1: Update IPC registration with agent handlers**

```typescript
import type { IpcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { workspaceManager } from '../workspace/WorkspaceManager';
import { agentRuntime } from '../agent/AgentRuntime';
import {
  WORKSPACE_SELECT,
  WORKSPACE_GET_CURRENT,
  WORKSPACE_LIST_RECENT,
  AGENT_SEND_MESSAGE,
  AGENT_ABORT,
  AGENT_NEW_SESSION,
  AGENT_SWITCH_SESSION,
  AGENT_DELETE_SESSION,
  AGENT_LIST_SESSIONS,
  AGENT_GET_SESSION_MESSAGES,
  AGENT_GET_STATUS
} from '../../shared/ipc-channels';

export function registerIpcHandlers(
  ipcMain: IpcMain,
  getMainWindow: () => BrowserWindow | null
): void {
  // Workspace handlers
  ipcMain.handle(WORKSPACE_SELECT, async () => {
    return workspaceManager.selectDirectory(getMainWindow());
  });

  ipcMain.handle(WORKSPACE_GET_CURRENT, () => {
    return workspaceManager.getCurrent();
  });

  ipcMain.handle(WORKSPACE_LIST_RECENT, () => {
    return workspaceManager.listRecent();
  });

  // Agent handlers
  ipcMain.handle(AGENT_NEW_SESSION, async (_e, workspacePath: string) => {
    agentRuntime.setMainWindow(getMainWindow());
    return agentRuntime.newSession(workspacePath);
  });

  ipcMain.handle(AGENT_SWITCH_SESSION, async (_e, sessionId: string) => {
    agentRuntime.setMainWindow(getMainWindow());
    await agentRuntime.switchSession(sessionId);
  });

  ipcMain.handle(AGENT_DELETE_SESSION, (_e, sessionId: string) => {
    agentRuntime.deleteSession(sessionId);
  });

  ipcMain.handle(AGENT_LIST_SESSIONS, () => {
    return agentRuntime.listSessions();
  });

  ipcMain.handle(AGENT_GET_SESSION_MESSAGES, (_e, sessionId: string) => {
    return agentRuntime.getSessionMessages(sessionId);
  });

  ipcMain.handle(AGENT_GET_STATUS, () => {
    return agentRuntime.getStatus();
  });

  ipcMain.handle(AGENT_SEND_MESSAGE, async (_e, content: string) => {
    agentRuntime.setMainWindow(getMainWindow());
    await agentRuntime.sendMessage(content);
  });

  ipcMain.handle(AGENT_ABORT, async () => {
    await agentRuntime.abort();
  });
}
```

- [ ] **Step 2: Update main index to wire window reference**

Add after `mainWindow = new BrowserWindow({...})` line in `src/main/index.ts`:

```typescript
  // Pass window reference to agent runtime for event emission
  import('../agent/AgentRuntime').then(({ agentRuntime }) => {
    agentRuntime.setMainWindow(mainWindow);
  });
```

(Place this right after the `new BrowserWindow` block and before the `if (process.env.VITE_DEV_SERVER_URL)` check.)

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: Passes with 0 errors.

- [ ] **Step 4: Commit IPC handlers**

```bash
git add src/main/ipc/index.ts src/main/index.ts
git commit -m "feat: register agent IPC handlers for session management and messaging"
```

---

## Task 7: Renderer State Management

**Files:**
- Create: `src/renderer/stores/useChatStore.ts`
- Create: `src/renderer/stores/useSessionStore.ts`
- Create: `src/renderer/hooks/useIpcRenderer.ts`

- [ ] **Step 1: Install zustand**

Run: `pnpm add zustand`
Expected: Installs successfully.

- [ ] **Step 2: Create typed IPC hook**

```typescript
// src/renderer/hooks/useIpcRenderer.ts
import { useEffect, useRef } from 'react';
import type { ElectronAPI } from '../../main/preload';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export function useIpcRenderer(): ElectronAPI {
  return window.electronAPI;
}

// Helper hook for subscribing to agent events
export function useAgentEvent<K extends keyof ElectronAPI['on']>(
  eventName: K,
  callback: Parameters<ElectronAPI['on'][K]>[0]
): void {
  const ipc = useIpcRenderer();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const handler = ((...args: unknown[]) => {
      (callbackRef.current as (...args: unknown[]) => void)(...args);
    }) as Parameters<ElectronAPI['on'][K]>[0];

    const cleanup = (ipc.on[eventName] as (cb: any) => () => void)(handler);
    return cleanup;
  }, [eventName, ipc]);
}
```

- [ ] **Step 3: Create chat store**

```typescript
// src/renderer/stores/useChatStore.ts
import { create } from 'zustand';
import type { Message, AgentStatus, ToolCall } from '@shared/types';

interface ChatState {
  messages: Message[];
  status: AgentStatus;
  activeSessionId: string | null;
  isLoading: boolean;
  error: string | null;

  setActiveSession: (sessionId: string | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateToolCall: (messageId: string, toolCall: ToolCall) => void;
  updateToolResult: (toolCallId: string, output: string, status: string) => void;
  setStatus: (status: AgentStatus) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  status: { sessionId: null, state: 'idle' },
  activeSessionId: null,
  isLoading: false,
  error: null,

  setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),

  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message]
    })),

  updateToolCall: (messageId, toolCall) =>
    set((state) => {
      const messages = state.messages.map((msg) => {
        if (msg.id !== messageId && msg.role === 'assistant') {
          // Attach tool call to the last assistant message
          const existing = msg.toolCalls || [];
          return {
            ...msg,
            toolCalls: [...existing.filter((t) => t.id !== toolCall.id), toolCall]
          };
        }
        return msg;
      });

      // If no assistant message exists yet, create a placeholder
      const hasAssistant = messages.some((m) => m.role === 'assistant');
      if (!hasAssistant) {
        const placeholder: Message = {
          id: `msg_${Date.now()}_a_placeholder`,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          toolCalls: [toolCall]
        };
        return { messages: [...state.messages, placeholder] };
      }

      return { messages };
    }),

  updateToolResult: (toolCallId, output, status) =>
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (!msg.toolCalls) return msg;
        return {
          ...msg,
          toolCalls: msg.toolCalls.map((tc) =>
            tc.id === toolCallId
              ? { ...tc, output, status: status as ToolCall['status'] }
              : tc
          )
        };
      })
    })),

  setStatus: (status) => set({ status }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  clear: () =>
    set({
      messages: [],
      activeSessionId: null,
      isLoading: false,
      error: null
    })
}));
```

- [ ] **Step 4: Create session store**

```typescript
// src/renderer/stores/useSessionStore.ts
import { create } from 'zustand';
import type { SessionInfo, WorkspaceInfo } from '@shared/types';

interface SessionState {
  sessions: SessionInfo[];
  currentWorkspace: WorkspaceInfo | null;
  recentWorkspaces: WorkspaceInfo[];
  isLoading: boolean;

  setSessions: (sessions: SessionInfo[]) => void;
  setCurrentWorkspace: (ws: WorkspaceInfo | null) => void;
  setRecentWorkspaces: (workspaces: WorkspaceInfo[]) => void;
  setLoading: (loading: boolean) => void;

  addSession: (session: SessionInfo) => void;
  removeSession: (sessionId: string) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessions: [],
  currentWorkspace: null,
  recentWorkspaces: [],
  isLoading: false,

  setSessions: (sessions) => set({ sessions }),
  setCurrentWorkspace: (ws) => set({ currentWorkspace: ws }),
  setRecentWorkspaces: (workspaces) => set({ recentWorkspaces: workspaces }),
  setLoading: (loading) => set({ isLoading: loading }),

  addSession: (session) =>
    set((state) => ({
      sessions: [session, ...state.sessions.filter((s) => s.id !== session.id)]
    })),

  removeSession: (sessionId) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== sessionId)
    }))
}));
```

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: Passes with 0 errors.

- [ ] **Step 6: Commit state management**

```bash
git add src/renderer/stores/useChatStore.ts src/renderer/stores/useSessionStore.ts src/renderer/hooks/useIpcRenderer.ts package.json
git commit -m "feat: add zustand stores and typed IPC hooks for renderer"
```

---

## Task 8: Chat UI Components

**Files:**
- Create: `src/renderer/components/chat/ChatPanel.tsx`
- Create: `src/renderer/components/chat/MessageList.tsx`
- Create: `src/renderer/components/chat/MessageBubble.tsx`
- Create: `src/renderer/components/chat/ToolCallCard.tsx`
- Create: `src/renderer/components/chat/ChatInput.tsx`

- [ ] **Step 1: Create ToolCallCard component**

```tsx
// src/renderer/components/chat/ToolCallCard.tsx
import React, { useState } from 'react';
import type { ToolCall } from '@shared/types';

interface ToolCallCardProps {
  toolCall: ToolCall;
}

const statusColors: Record<ToolCall['status'], string> = {
  pending: 'text-muted-foreground',
  running: 'text-blue-400',
  success: 'text-green-400',
  error: 'text-red-400'
};

const statusIcons: Record<ToolCall['status'], string> = {
  pending: '⏳',
  running: '⚙️',
  success: '✓',
  error: '✕'
};

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);

  const hasOutput = toolCall.output && toolCall.output.length > 0;

  return (
    <div className="my-2 rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent/50 transition-colors"
      >
        <span className={statusColors[toolCall.status]}>
          {statusIcons[toolCall.status]}
        </span>
        <span className="font-mono text-xs text-muted-foreground">tool</span>
        <span className="font-medium">{toolCall.name}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border px-3 py-2">
          <div className="mb-2">
            <span className="text-xs text-muted-foreground">Input:</span>
            <pre className="mt-1 max-h-32 overflow-auto rounded bg-background p-2 text-xs font-mono">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>

          {hasOutput && (
            <div>
              <span className="text-xs text-muted-foreground">Output:</span>
              <pre className="mt-1 max-h-64 overflow-auto rounded bg-background p-2 text-xs font-mono whitespace-pre-wrap">
                {toolCall.output}
              </pre>
            </div>
          )}

          {toolCall.error && (
            <div className="text-red-400 text-sm">
              Error: {toolCall.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create MessageBubble component**

```tsx
// src/renderer/components/chat/MessageBubble.tsx
import React from 'react';
import type { Message } from '@shared/types';
import { ToolCallCard } from './ToolCallCard';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-card text-card-foreground border border-border'
        }`}
      >
        {!isUser && (
          <div className="mb-1 text-xs font-semibold text-muted-foreground">
            CocoAgent
          </div>
        )}

        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {message.content || (
            <span className="text-muted-foreground italic">
              {message.toolCalls && message.toolCalls.length > 0
                ? 'Processing...'
                : ''}
            </span>
          )}
        </div>

        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.toolCalls.map((tc) => (
              <ToolCallCard key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create MessageList component**

```tsx
// src/renderer/components/chat/MessageList.tsx
import React, { useEffect, useRef } from 'react';
import type { Message } from '@shared/types';
import { MessageBubble } from './MessageBubble';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Welcome to CocoAgent</h2>
          <p className="text-muted-foreground text-sm">
            Select a workspace and start a conversation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-card border border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="animate-pulse">●</span>
                <span className="text-sm text-muted-foreground">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create ChatInput component**

```tsx
// src/renderer/components/chat/ChatInput.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useIpcRenderer } from '../../hooks/useIpcRenderer';
import { useChatStore } from '../../stores/useChatStore';

export function ChatInput() {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ipc = useIpcRenderer();

  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const status = useChatStore((s) => s.status);
  const setLoading = useChatStore((s) => s.setLoading);
  const setError = useChatStore((s) => s.setError);

  const isBusy = status.state !== 'idle' && status.state !== 'error';
  const canSend = input.trim().length > 0 && activeSessionId && !isBusy;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSend = async () => {
    if (!canSend) return;

    const content = input.trim();
    setInput('');
    setLoading(true);
    setError(null);

    try {
      await ipc.agent.sendMessage(content);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAbort = async () => {
    try {
      await ipc.agent.abort();
    } catch {
      // Best effort
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-border bg-background p-4">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-2 rounded-lg border border-input bg-card">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={activeSessionId ? 'Type a message...' : 'Start a new session first'}
            disabled={!activeSessionId}
            rows={1}
            className="flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
          />
          {isBusy ? (
            <button
              onClick={handleAbort}
              className="mb-2 mr-2 rounded-md bg-red-500/20 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/30 transition-colors"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="mb-2 mr-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              Send
            </button>
          )}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create ChatPanel component**

```tsx
// src/renderer/components/chat/ChatPanel.tsx
import React, { useEffect } from 'react';
import { useChatStore } from '../../stores/useChatStore';
import { useAgentEvent, useIpcRenderer } from '../../hooks/useIpcRenderer';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import type { Message, AgentStatus, ToolCall } from '@shared/types';

export function ChatPanel() {
  const ipc = useIpcRenderer();
  const messages = useChatStore((s) => s.messages);
  const status = useChatStore((s) => s.status);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const addMessage = useChatStore((s) => s.addMessage);
  const setStatus = useChatStore((s) => s.setStatus);
  const setError = useChatStore((s) => s.setError);
  const setMessages = useChatStore((s) => s.setMessages);
  const isLoading = useChatStore((s) => s.isLoading);

  // Load messages when session changes
  useEffect(() => {
    if (activeSessionId) {
      ipc.agent.getSessionMessages(activeSessionId).then((msgs) => {
        setMessages(msgs);
      });
      ipc.agent.getStatus().then((s) => setStatus(s));
    }
  }, [activeSessionId, ipc, setMessages, setStatus]);

  // Listen for new messages
  useAgentEvent('agentMessage', (msg: Message) => {
    addMessage(msg);
  });

  // Listen for status changes
  useAgentEvent('agentStatus', (s: AgentStatus) => {
    setStatus(s);
  });

  // Listen for errors
  useAgentEvent('agentError', (error: string) => {
    setError(error);
  });

  // Listen for tool calls
  useAgentEvent('agentToolCall', (data: { toolCall: ToolCall; messageId: string }) => {
    // Tool calls come through message events primarily,
    // this is a fallback for standalone tool call events
    void data;
  });

  useAgentEvent(
    'agentToolResult',
    (data: { toolCallId: string; output: string; status: string }) => {
      void data;
    }
  );

  const isThinking =
    status.state === 'thinking' ||
    status.state === 'tool_calling' ||
    status.state === 'responding';

  return (
    <div className="flex h-full flex-col">
      <MessageList messages={messages} isLoading={isLoading || isLoading} />
      <ChatInput />
    </div>
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: Passes with 0 errors.

- [ ] **Step 7: Commit chat components**

```bash
git add src/renderer/components/chat/ChatPanel.tsx src/renderer/components/chat/MessageList.tsx src/renderer/components/chat/MessageBubble.tsx src/renderer/components/chat/ToolCallCard.tsx src/renderer/components/chat/ChatInput.tsx
git commit -m "feat: implement chat UI components (panel, messages, input, tool cards)"
```

---

## Task 9: Layout & Sidebar Components

**Files:**
- Create: `src/renderer/components/layout/AppLayout.tsx`
- Create: `src/renderer/components/layout/Sidebar.tsx`
- Create: `src/renderer/components/layout/Titlebar.tsx`
- Modify: `src/renderer/App.tsx` — wire up full layout

- [ ] **Step 1: Create Titlebar component**

```tsx
// src/renderer/components/layout/Titlebar.tsx
import React from 'react';

export function Titlebar() {
  return (
    <div
      className="h-9 border-b border-border bg-background flex items-center px-3"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="text-xs font-medium text-muted-foreground">
        CocoAgent
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create Sidebar component**

```tsx
// src/renderer/components/layout/Sidebar.tsx
import React, { useEffect, useState } from 'react';
import { useIpcRenderer } from '../../hooks/useIpcRenderer';
import { useSessionStore } from '../../stores/useSessionStore';
import { useChatStore } from '../../stores/useChatStore';
import type { SessionInfo } from '@shared/types';

export function Sidebar() {
  const ipc = useIpcRenderer();
  const sessions = useSessionStore((s) => s.sessions);
  const currentWorkspace = useSessionStore((s) => s.currentWorkspace);
  const setSessions = useSessionStore((s) => s.setSessions);
  const setCurrentWorkspace = useSessionStore((s) => s.setCurrentWorkspace);
  const setRecentWorkspaces = useSessionStore((s) => s.setRecentWorkspaces);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const setActiveSession = useChatStore((s) => s.setActiveSession);
  const setMessages = useChatStore((s) => s.setMessages);

  const [isCreating, setIsCreating] = useState(false);

  // Load sessions on mount
  useEffect(() => {
    ipc.agent.listSessions().then((s) => setSessions(s));
    ipc.workspace.getCurrent().then((ws) => setCurrentWorkspace(ws));
    ipc.workspace.listRecent().then((ws) => setRecentWorkspaces(ws));
  }, [ipc, setSessions, setCurrentWorkspace, setRecentWorkspaces]);

  const handleNewSession = async () => {
    let workspace = currentWorkspace;

    if (!workspace) {
      const selected = await ipc.workspace.select();
      if (!selected) return;
      workspace = selected;
      setCurrentWorkspace(selected);
    }

    setIsCreating(true);
    try {
      const sessionId = await ipc.agent.newSession(workspace.path);
      setActiveSession(sessionId);
      setMessages([]);

      // Refresh session list
      const updated = await ipc.agent.listSessions();
      setSessions(updated);
    } catch (err) {
      console.error('Failed to create session:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSwitchSession = async (session: SessionInfo) => {
    if (session.id === activeSessionId) return;

    try {
      await ipc.agent.switchSession(session.id);
      setActiveSession(session.id);
      const msgs = await ipc.agent.getSessionMessages(session.id);
      setMessages(msgs);
    } catch (err) {
      console.error('Failed to switch session:', err);
    }
  };

  const handleSelectWorkspace = async () => {
    const selected = await ipc.workspace.select();
    if (selected) {
      setCurrentWorkspace(selected);
    }
  };

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString();
  };

  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-card">
      {/* Workspace selector */}
      <div className="border-b border-border p-3">
        <button
          onClick={handleSelectWorkspace}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
        >
          <span>📁</span>
          <span className="truncate flex-1 text-left">
            {currentWorkspace?.name || 'Select workspace'}
          </span>
          <span className="text-muted-foreground">⋯</span>
        </button>
      </div>

      {/* New session button */}
      <div className="p-3">
        <button
          onClick={handleNewSession}
          disabled={isCreating}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <span>+</span>
          New Chat
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        <div className="mb-2 px-2 text-xs font-medium text-muted-foreground">
          Sessions
        </div>
        <div className="space-y-1">
          {sessions.length === 0 ? (
            <div className="px-2 py-4 text-center text-xs text-muted-foreground">
              No sessions yet
            </div>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => handleSwitchSession(session)}
                className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                  session.id === activeSessionId
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                }`}
              >
                <div className="truncate font-medium">{session.title}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {formatTime(session.updatedAt)} · {session.messageCount} msgs
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create AppLayout component**

```tsx
// src/renderer/components/layout/AppLayout.tsx
import React from 'react';
import { Titlebar } from './Titlebar';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex h-full flex-col">
      <Titlebar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update App.tsx with full layout**

```tsx
// src/renderer/App.tsx
import React from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { ChatPanel } from './components/chat/ChatPanel';

export default function App() {
  return (
    <AppLayout>
      <ChatPanel />
    </AppLayout>
  );
}
```

- [ ] **Step 5: Typecheck + build**

Run: `pnpm typecheck`
Expected: Passes with 0 errors.

Run: `pnpm build`
Expected: Builds successfully (main, preload, renderer).

- [ ] **Step 6: Commit layout components**

```bash
git add src/renderer/components/layout/AppLayout.tsx src/renderer/components/layout/Sidebar.tsx src/renderer/components/layout/Titlebar.tsx src/renderer/App.tsx
git commit -m "feat: implement app layout with sidebar, titlebar, and session management"
```

---

## Task 10: End-to-End Verification

- [ ] **Step 1: Start dev server**

Run: `pnpm dev`
Expected: Electron window opens, app renders with sidebar + empty chat panel.

- [ ] **Step 2: Select a workspace**

Click "Select workspace" in sidebar → choose a directory → confirm dialog closes and workspace name shows.

- [ ] **Step 3: Create a new session**

Click "New Chat" button.
Expected: New session appears in sidebar list.

- [ ] **Step 4: Send a test message**

Type "Hello, who are you?" in the input and press Enter.
Expected:
- User message appears in chat
- "Thinking..." indicator shows
- Assistant response appears (streaming or full message)
- Session list updates with message count

- [ ] **Step 5: Test file tool**

Type "What files are in this directory?" (or equivalent based on available tools).
Expected: Agent uses a file listing tool, shows a tool call card, returns the result.

- [ ] **Step 6: Test session persistence**

Close the app, then run `pnpm dev` again.
Expected: Previous sessions appear in the sidebar list. Clicking one loads the history.

- [ ] **Step 7: Test abort**

Send a long message, click "Stop" while agent is responding.
Expected: Agent stops generating, status returns to idle.

- [ ] **Step 8: Run typecheck one final time**

Run: `pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 9: Commit final verification fixes (if any)**

```bash
git add -A
git commit -m "fix: e2e verification fixes"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Electron + React + TypeScript + Tailwind → Tasks 1, 3
- [x] Pi SDK Agent Runtime → Task 5
- [x] IPC communication (ContextBridge) → Tasks 2, 3, 6
- [x] Chat UI (modern web style) → Task 8
- [x] File tools (via Pi SDK codingTools) → Task 5
- [x] Session persistence (JSONL) → Task 5 (session-store.ts)
- [x] Workspace management → Task 4
- [x] Sidebar with session list → Task 9

**Placeholder scan:**
- No TBD/TODO placeholders
- All code steps have actual code
- All commands are explicit
- Pi SDK API noted as needing validation (step 5-4)

**Type consistency:**
- `Message`, `ToolCall`, `SessionInfo`, `AgentStatus`, `WorkspaceInfo` defined in `src/shared/types.ts` and used consistently
- IPC channel constants in `src/shared/ipc-channels.ts` used in both main and renderer
- Store state shapes match the shared types
