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

export interface SkillInfo {
  name: string;
  description: string;
  path: string;
  source: 'built-in' | 'global' | 'project';
  loaded: boolean;
}

export interface AppSettings {
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
