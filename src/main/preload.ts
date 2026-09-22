import { contextBridge, ipcRenderer } from 'electron';
import type {
  Message,
  SessionInfo,
  AgentInfo,
  AgentStatus,
  WorkspaceInfo,
  AppSettings,
  ModelConfig,
  SecurityLevel,
  ModelTestResult,
  MCPConfig,
  SkillInfo,
  FileEntry,
  FileReadResult,
  FileWriteResult,
  ToolCall,
  TurnSummary
} from '../shared/types';
import {
  AGENT_SEND_MESSAGE,
  AGENT_ABORT,
  AGENT_NEW_SESSION,
  AGENT_SWITCH_SESSION,
  AGENT_DELETE_SESSION,
  AGENT_LIST_SESSIONS,
  AGENT_GET_SESSION_MESSAGES,
  AGENT_GET_STATUS,
  AGENT_SEARCH_SESSIONS,
  AGENT_PIN_SESSION,
  AGENT_REBIND_WORKSPACE,
  AGENT_EVENT_MESSAGE,
  AGENT_EVENT_TOOL_CALL,
  AGENT_EVENT_TOOL_RESULT,
  AGENT_EVENT_STATUS,
  AGENT_EVENT_ERROR,
  AGENT_EVENT_MESSAGE_DELTA,
  AGENT_EVENT_THINKING_DELTA,
  AGENT_EVENT_TOOL_CALL_DELTA,
  AGENT_EVENT_MESSAGE_END,
  AGENT_EVENT_FILE_DELIVERY,
  AGENT_EVENT_TURN_END,
  WORKSPACE_SELECT,
  WORKSPACE_GET_CURRENT,
  WORKSPACE_LIST_RECENT,
  WORKSPACE_GET_DEFAULT,
  WORKSPACE_SET_DEFAULT,
  WORKSPACE_SET_CURRENT,
  WORKSPACE_LIST_FILES,
  WORKSPACE_READ_FILE,
  WORKSPACE_WRITE_FILE,
  WORKSPACE_OPEN_IN_OS,
  SETTINGS_GET,
  SETTINGS_SET,
  SETTINGS_RESET,
  MODELS_LIST,
  MODELS_ADD,
  MODELS_UPDATE,
  MODELS_DELETE,
  MODELS_SET_ACTIVE,
  MODELS_GET_ACTIVE,
  MODELS_TEST,
  MCP_LIST,
  MCP_ADD,
  MCP_UPDATE,
  MCP_DELETE,
  MCP_START,
  MCP_STOP,
  MCP_RESTART,
  MCP_GET_STATUS,
  MCP_LIST_TOOLS,
  MCP_EVENT_STATUS_CHANGED,
  SKILLS_LIST,
  SKILLS_GET_DETAIL,
  SKILLS_RELOAD,
  SKILLS_INSTALL,
  SKILLS_UNINSTALL,
  SKILLS_GET_CONTENT,
  SKILLS_OPEN_DIR,
  SKILLS_INSTALL_FROM_SOURCE,
  SKILLS_FETCH_CATALOG,
  SKILLS_INSTALL_FROM_CATALOG,
  TOOL_APPROVAL_REQUEST,
  TOOL_APPROVAL_RESPONSE,
  TOOL_APPROVAL_SET_AUTO,
  BROWSER_GET_STATUS,
  BROWSER_SET_VISIBLE,
  BROWSER_CLOSE,
  COMPUTER_GET_SCREEN_INFO,
  APP_GET_PATHS,
  APP_OPEN_HOME,
  AGENTS_LIST,
  SECURITY_GET,
  SECURITY_SET_LEVEL,
  SECURITY_CHECK,
  AGENTS_CREATE,
  AGENTS_UPDATE,
  AGENTS_DELETE,
  AGENTS_GET_ACTIVE,
  AGENTS_SET_ACTIVE,
  AGENTS_GET_PERSONA,
  AGENTS_SET_PERSONA,
  AGENT_SKILLS_LIST,
  AGENT_SKILLS_ENABLE,
  AGENT_SKILLS_DISABLE,
  UPDATE_GET_STATUS,
  UPDATE_CHECK,
  UPDATE_DOWNLOAD,
  UPDATE_QUIT_AND_INSTALL,
  UPDATE_SET_FEED,
  UPDATE_EVENT,
  WINDOW_MINIMIZE,
  WINDOW_TOGGLE_MAXIMIZE,
  WINDOW_CLOSE,
  WINDOW_IS_MAXIMIZED
} from '../shared/ipc-channels';
import type {
  ToolApprovalRequest,
  ToolApprovalDecision,
  UpdateStatus
} from '../shared/types';

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
      ipcRenderer.invoke(AGENT_GET_STATUS) as Promise<AgentStatus>,
    searchSessions: (query: string) =>
      ipcRenderer.invoke(AGENT_SEARCH_SESSIONS, query) as Promise<
        { session: SessionInfo; matches: { messageId: string; role: string; snippet: string }[] }[]
      >,
    setPinned: (sessionId: string, pinned: boolean) =>
      ipcRenderer.invoke(AGENT_PIN_SESSION, sessionId, pinned) as Promise<SessionInfo[]>,
    rebindWorkspace: (workspacePath: string) =>
      ipcRenderer.invoke(AGENT_REBIND_WORKSPACE, workspacePath) as Promise<SessionInfo | null>
  },
  workspace: {
    select: () =>
      ipcRenderer.invoke(WORKSPACE_SELECT) as Promise<WorkspaceInfo | null>,
    getCurrent: () =>
      ipcRenderer.invoke(WORKSPACE_GET_CURRENT) as Promise<WorkspaceInfo | null>,
    listRecent: () =>
      ipcRenderer.invoke(WORKSPACE_LIST_RECENT) as Promise<WorkspaceInfo[]>,
    getDefault: () =>
      ipcRenderer.invoke(WORKSPACE_GET_DEFAULT) as Promise<WorkspaceInfo>,
    setDefault: (path: string) =>
      ipcRenderer.invoke(WORKSPACE_SET_DEFAULT, path) as Promise<WorkspaceInfo>,
    setCurrent: (path: string) =>
      ipcRenderer.invoke(WORKSPACE_SET_CURRENT, path) as Promise<WorkspaceInfo>,
    listFiles: (dirPath: string) =>
      ipcRenderer.invoke(WORKSPACE_LIST_FILES, dirPath) as Promise<FileEntry[]>,
    readFile: (filePath: string) =>
      ipcRenderer.invoke(WORKSPACE_READ_FILE, filePath) as Promise<FileReadResult>,
    writeFile: (filePath: string, content: string, expectedMtime?: number) =>
      ipcRenderer.invoke(WORKSPACE_WRITE_FILE, filePath, content, expectedMtime) as Promise<FileWriteResult>,
    openInOS: (targetPath: string) =>
      ipcRenderer.invoke(WORKSPACE_OPEN_IN_OS, targetPath) as Promise<void>
  },
  settings: {
    get: () => ipcRenderer.invoke(SETTINGS_GET) as Promise<AppSettings>,
    set: (partial: Partial<AppSettings>) =>
      ipcRenderer.invoke(SETTINGS_SET, partial) as Promise<AppSettings>,
    reset: () => ipcRenderer.invoke(SETTINGS_RESET) as Promise<AppSettings>
  },
  models: {
    list: () => ipcRenderer.invoke(MODELS_LIST) as Promise<ModelConfig[]>,
    add: (model: ModelConfig) =>
      ipcRenderer.invoke(MODELS_ADD, model) as Promise<ModelConfig[]>,
    update: (id: string, updates: Partial<ModelConfig>) =>
      ipcRenderer.invoke(MODELS_UPDATE, id, updates) as Promise<ModelConfig[]>,
    delete: (id: string) =>
      ipcRenderer.invoke(MODELS_DELETE, id) as Promise<ModelConfig[]>,
    setActive: (id: string) => ipcRenderer.invoke(MODELS_SET_ACTIVE, id),
    getActive: () => ipcRenderer.invoke(MODELS_GET_ACTIVE) as Promise<ModelConfig | null>,
    test: (id: string) => ipcRenderer.invoke(MODELS_TEST, id) as Promise<ModelTestResult>
  },
  mcp: {
    list: () => ipcRenderer.invoke(MCP_LIST) as Promise<MCPConfig[]>,
    add: (server: MCPConfig) =>
      ipcRenderer.invoke(MCP_ADD, server) as Promise<MCPConfig[]>,
    update: (id: string, updates: Partial<MCPConfig>) =>
      ipcRenderer.invoke(MCP_UPDATE, id, updates) as Promise<MCPConfig[]>,
    delete: (id: string) =>
      ipcRenderer.invoke(MCP_DELETE, id) as Promise<MCPConfig[]>,
    start: (id: string) => ipcRenderer.invoke(MCP_START, id),
    stop: (id: string) => ipcRenderer.invoke(MCP_STOP, id),
    restart: (id: string) => ipcRenderer.invoke(MCP_RESTART, id),
    getStatus: (id: string) =>
      ipcRenderer.invoke(MCP_GET_STATUS, id) as Promise<{ running: boolean; error?: string }>,
    listTools: (id: string) =>
      ipcRenderer.invoke(MCP_LIST_TOOLS, id) as Promise<unknown[]>
  },
  skills: {
    list: () => ipcRenderer.invoke(SKILLS_LIST) as Promise<SkillInfo[]>,
    getDetail: (name: string) =>
      ipcRenderer.invoke(SKILLS_GET_DETAIL, name) as Promise<SkillInfo | null>,
    reload: () => ipcRenderer.invoke(SKILLS_RELOAD) as Promise<SkillInfo[]>,
    getContent: (name: string) =>
      ipcRenderer.invoke(SKILLS_GET_CONTENT, name) as Promise<string | null>,
    openDir: () => ipcRenderer.invoke(SKILLS_OPEN_DIR) as Promise<string>,
    install: () =>
      ipcRenderer.invoke(SKILLS_INSTALL) as Promise<
        { installed: SkillInfo; skills: SkillInfo[] } | null
      >,
    uninstall: (name: string) =>
      ipcRenderer.invoke(SKILLS_UNINSTALL, name) as Promise<SkillInfo[]>,
    installFromSource: (source: string) =>
      ipcRenderer.invoke(SKILLS_INSTALL_FROM_SOURCE, source) as Promise<{
        installed: SkillInfo;
        skills: SkillInfo[];
      }>,
    fetchCatalog: (registryUrl: string) =>
      ipcRenderer.invoke(SKILLS_FETCH_CATALOG, registryUrl) as Promise<{
        name: string;
        skills: {
          name: string;
          description: string;
          source: string;
          version?: string;
          author?: string;
        }[];
      }>,
    installFromCatalog: (source: string) =>
      ipcRenderer.invoke(SKILLS_INSTALL_FROM_CATALOG, source) as Promise<{
        installed: SkillInfo;
        skills: SkillInfo[];
      }>
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
    },
    agentMessageDelta: (callback: (data: { messageId: string; partIndex: number; delta: string }) => void) => {
      const listener = (_: unknown, data: unknown) =>
        callback(data as { messageId: string; partIndex: number; delta: string });
      ipcRenderer.on(AGENT_EVENT_MESSAGE_DELTA, listener);
      return () => ipcRenderer.removeListener(AGENT_EVENT_MESSAGE_DELTA, listener);
    },
    agentThinkingDelta: (callback: (data: { messageId: string; partIndex: number; delta: string; state?: 'generating' | 'done' }) => void) => {
      const listener = (_: unknown, data: unknown) =>
        callback(data as { messageId: string; partIndex: number; delta: string; state?: 'generating' | 'done' });
      ipcRenderer.on(AGENT_EVENT_THINKING_DELTA, listener);
      return () => ipcRenderer.removeListener(AGENT_EVENT_THINKING_DELTA, listener);
    },
    agentToolCallDelta: (callback: (data: { messageId: string; partIndex: number; toolCall?: ToolCall; updates?: Partial<ToolCall> }) => void) => {
      const listener = (_: unknown, data: unknown) =>
        callback(data as { messageId: string; partIndex: number; toolCall?: ToolCall; updates?: Partial<ToolCall> });
      ipcRenderer.on(AGENT_EVENT_TOOL_CALL_DELTA, listener);
      return () => ipcRenderer.removeListener(AGENT_EVENT_TOOL_CALL_DELTA, listener);
    },
    agentMessageEnd: (callback: (data: { messageId: string }) => void) => {
      const listener = (_: unknown, data: unknown) =>
        callback(data as { messageId: string });
      ipcRenderer.on(AGENT_EVENT_MESSAGE_END, listener);
      return () => ipcRenderer.removeListener(AGENT_EVENT_MESSAGE_END, listener);
    },
    agentFileDelivery: (callback: (data: { messageId: string; partIndex: number; file: { filePath: string; fileName: string; action: 'create' | 'edit'; fileSize?: number } }) => void) => {
      const listener = (_: unknown, data: unknown) =>
        callback(data as { messageId: string; partIndex: number; file: { filePath: string; fileName: string; action: 'create' | 'edit'; fileSize?: number } });
      ipcRenderer.on(AGENT_EVENT_FILE_DELIVERY, listener);
      return () => ipcRenderer.removeListener(AGENT_EVENT_FILE_DELIVERY, listener);
    },
    agentTurnEnd: (callback: (data: { messageId: string; partIndex: number; summary: TurnSummary }) => void) => {
      const listener = (_: unknown, data: unknown) =>
        callback(data as { messageId: string; partIndex: number; summary: TurnSummary });
      ipcRenderer.on(AGENT_EVENT_TURN_END, listener);
      return () => ipcRenderer.removeListener(AGENT_EVENT_TURN_END, listener);
    },
    mcpStatusChanged: (callback: (data: { id: string; running: boolean; error?: string }) => void) => {
      const listener = (_: unknown, data: unknown) =>
        callback(data as { id: string; running: boolean; error?: string });
      ipcRenderer.on(MCP_EVENT_STATUS_CHANGED, listener);
      return () => ipcRenderer.removeListener(MCP_EVENT_STATUS_CHANGED, listener);
    },
    toolApprovalRequest: (callback: (request: ToolApprovalRequest) => void) => {
      const listener = (_: unknown, request: ToolApprovalRequest) => callback(request);
      ipcRenderer.on(TOOL_APPROVAL_REQUEST, listener);
      return () => ipcRenderer.removeListener(TOOL_APPROVAL_REQUEST, listener);
    },
    updateStatus: (callback: (status: UpdateStatus) => void) => {
      const listener = (_: unknown, status: UpdateStatus) => callback(status);
      ipcRenderer.on(UPDATE_EVENT, listener);
      return () => ipcRenderer.removeListener(UPDATE_EVENT, listener);
    }
  },
  toolApproval: {
    respond: (id: string, decision: ToolApprovalDecision) =>
      ipcRenderer.invoke(TOOL_APPROVAL_RESPONSE, id, decision),
    setAutoApprove: (enabled: boolean) =>
      ipcRenderer.invoke(TOOL_APPROVAL_SET_AUTO, enabled)
  },
  browser: {
    getStatus: () =>
      ipcRenderer.invoke(BROWSER_GET_STATUS) as Promise<{ open: boolean; visible: boolean; url: string }>,
    setVisible: (visible: boolean) => ipcRenderer.invoke(BROWSER_SET_VISIBLE, visible),
    close: () => ipcRenderer.invoke(BROWSER_CLOSE)
  },
  security: {
    get: () =>
      ipcRenderer.invoke(SECURITY_GET) as Promise<{
        level: SecurityLevel;
        levels: SecurityLevel[];
        workspaceRoot: string | null;
      }>,
    setLevel: (level: SecurityLevel) =>
      ipcRenderer.invoke(SECURITY_SET_LEVEL, level) as Promise<SecurityLevel>,
    check: (path: string, op: 'read' | 'write') =>
      ipcRenderer.invoke(SECURITY_CHECK, path, op) as Promise<{
        allowed: boolean;
        zone: string;
        reason?: string;
      }>
  },
  agents: {
    list: () => ipcRenderer.invoke(AGENTS_LIST) as Promise<AgentInfo[]>,
    create: (input: { name: string; description?: string; persona?: string }) =>
      ipcRenderer.invoke(AGENTS_CREATE, input) as Promise<AgentInfo>,
    update: (id: string, updates: { name?: string; description?: string }) =>
      ipcRenderer.invoke(AGENTS_UPDATE, id, updates) as Promise<AgentInfo>,
    delete: (id: string) =>
      ipcRenderer.invoke(AGENTS_DELETE, id) as Promise<AgentInfo[]>,
    getActive: () => ipcRenderer.invoke(AGENTS_GET_ACTIVE) as Promise<AgentInfo>,
    setActive: (id: string) =>
      ipcRenderer.invoke(AGENTS_SET_ACTIVE, id) as Promise<AgentInfo>,
    getPersona: (id: string) =>
      ipcRenderer.invoke(AGENTS_GET_PERSONA, id) as Promise<string>,
    setPersona: (id: string, body: string) =>
      ipcRenderer.invoke(AGENTS_SET_PERSONA, id, body) as Promise<void>
  },
  agentSkills: {
    list: (agentId: string) =>
      ipcRenderer.invoke(AGENT_SKILLS_LIST, agentId) as Promise<Array<SkillInfo & { enabled: boolean }>>,
    enable: (agentId: string, skillName: string) =>
      ipcRenderer.invoke(AGENT_SKILLS_ENABLE, agentId, skillName) as Promise<void>,
    disable: (agentId: string, skillName: string) =>
      ipcRenderer.invoke(AGENT_SKILLS_DISABLE, agentId, skillName) as Promise<void>
  },
  app: {
    getPaths: () =>
      ipcRenderer.invoke(APP_GET_PATHS) as Promise<{
        home: string;
        piRuntime: string;
        dbFile: string;
        skillsDir: string;
        homeOverridden: boolean;
      }>,
    openHome: () => ipcRenderer.invoke(APP_OPEN_HOME) as Promise<string>
  },
  update: {
    getStatus: () => ipcRenderer.invoke(UPDATE_GET_STATUS) as Promise<UpdateStatus>,
    check: () => ipcRenderer.invoke(UPDATE_CHECK) as Promise<UpdateStatus>,
    download: () => ipcRenderer.invoke(UPDATE_DOWNLOAD) as Promise<UpdateStatus>,
    quitAndInstall: () => ipcRenderer.invoke(UPDATE_QUIT_AND_INSTALL),
    setFeed: (url: string) => ipcRenderer.invoke(UPDATE_SET_FEED, url)
  },
  computer: {
    getScreenInfo: () =>
      ipcRenderer.invoke(COMPUTER_GET_SCREEN_INFO) as Promise<{ width: number; height: number; scaleFactor: number }>
  },
  window: {
    minimize: () => ipcRenderer.invoke(WINDOW_MINIMIZE),
    toggleMaximize: () => ipcRenderer.invoke(WINDOW_TOGGLE_MAXIMIZE) as Promise<boolean>,
    close: () => ipcRenderer.invoke(WINDOW_CLOSE),
    isMaximized: () => ipcRenderer.invoke(WINDOW_IS_MAXIMIZED) as Promise<boolean>
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
