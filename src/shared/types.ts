export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: 'pending' | 'running' | 'success' | 'error';
  output?: string;
  error?: string;
  description?: string;
  inputPreview?: string;
  category?: 'file_write' | 'file_read' | 'bash' | 'search' | 'mcp' | 'browser' | 'computer' | 'other';
}

// ===== Message parts: 分段式消息模型 =====

interface BasePart {
  id: string;
  index: number;
}

export interface TextPart extends BasePart {
  type: 'text';
  content: string;
  streaming?: boolean;
}

export interface ThinkingPart extends BasePart {
  type: 'thinking';
  content: string;
  state: 'generating' | 'done';
}

export interface ToolCallPart extends BasePart {
  type: 'tool_call';
  toolCall: ToolCall;
}

export interface FileDeliveryPart extends BasePart {
  type: 'file_delivery';
  filePath: string;
  fileName: string;
  action: 'create' | 'edit';
  fileSize?: number;
  language?: string;
  preview?: string;
}

export interface SummaryPart extends BasePart {
  type: 'summary';
  summary: TurnSummary;
}

export type MessagePart = TextPart | ThinkingPart | ToolCallPart | FileDeliveryPart | SummaryPart;

export interface TurnSummary {
  agentName: string;
  toolCount: number;
  thinkingCount: number;
  durationMs?: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  /** user/system 消息用 content（纯文本）；assistant 优先用 parts */
  content?: string;
  timestamp: number;
  /** assistant 消息的分段内容（文字、思考、工具调用、文件交付等） */
  parts?: MessagePart[];
  /** 兼容旧数据，新代码优先使用 parts；从 parts 中提取 */
  toolCalls?: ToolCall[];
  /** 一轮 agent 的汇总信息 */
  turnSummary?: TurnSummary;
}

export interface AgentInfo {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export interface SessionInfo {
  id: string;
  title: string;
  workspacePath: string;
  agentId: string | null;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  archived: boolean;
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

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  mtime: number;
}

export interface FileReadResult {
  path: string;
  /** Text content; empty when `binary` is true. */
  content: string;
  binary: boolean;
  /** True when the file exceeded the preview size limit and was not read. */
  tooLarge: boolean;
  mtime: number;
}

export interface FileWriteResult {
  path: string;
  mtime: number;
}

// Model & Provider types
export type ModelProvider = 'openai-compatible' | 'anthropic' | 'ollama' | 'ark';

export interface ModelConfig {
  id: string;
  name: string;
  provider: ModelProvider;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  thinkingLevel?: 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  isDefault?: boolean;
  /** Optional embedding model for semantic memory search (OpenAI-compatible /embeddings). */
  embeddingModel?: string;
}

export interface MCPConfig {
  id: string;
  name: string;
  type: 'stdio' | 'sse' | 'streamable-http';
  command?: string;
  args?: string[];
  url?: string;
  enabled: boolean;
  env?: Record<string, string>;
}

export interface ModelTestResult {
  ok: boolean;
  /** Human-readable summary, safe to show in the UI. */
  message: string;
  /** The model's reply when the request succeeded. */
  reply?: string;
  latencyMs?: number;
}

export interface SkillInfo {
  name: string;
  description: string;
  path: string;
  source: 'built-in' | 'global' | 'project';
  loaded: boolean;
}

export type SecurityLevel = 'readonly' | 'workspace' | 'full';

export interface AppSettings {
  // Security
  /** Path-level policy: readonly drops write-capable tools from sessions. */
  securityLevel: SecurityLevel;

  // Agents
  activeAgentId: string | null;

  // Project space
  /** Where new sessions live by default. `~` is expanded. */
  defaultWorkspacePath: string;
  /** Last project space in use, restored on launch. */
  lastWorkspacePath: string;

  // Models
  models: ModelConfig[];
  activeModelId: string | null;

  // MCP
  mcpServers: MCPConfig[];

  // Appearance
  theme: 'dark' | 'light' | 'system';
  fontSize: number;

  // Behavior
  autoApproveTools: boolean;
  defaultThinkingLevel: string;

  // Skill registry (remote catalog JSON URL)
  skillRegistryUrl: string;

  // Auto-update (generic feed URL; empty = use the bundled GitHub feed)
  updateFeedUrl: string;
}

export interface ToolApprovalRequest {
  id: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  description: string;
  isDangerous: boolean;
}

export type ToolApprovalDecision = 'approve' | 'deny' | 'approve_all';

export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'up-to-date'
  | 'downloading'
  | 'downloaded'
  | 'error'
  | 'unavailable';

export interface UpdateStatus {
  state: UpdateState;
  currentVersion: string;
  packaged: boolean;
  feedConfigured: boolean;
  feedUrl?: string;
  version?: string;
  percent?: number;
  message?: string;
}
