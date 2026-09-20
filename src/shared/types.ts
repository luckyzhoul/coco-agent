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
