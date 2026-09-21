import type { BrowserWindow } from 'electron';
import {
  createAgentSession,
  createCodingTools,
  SessionManager,
  SettingsManager,
  type AgentSession,
  type AgentSessionEvent
} from '@earendil-works/pi-coding-agent';
import { modelManager } from '../models/ModelManager';
import { mcpManager } from '../mcp/McpManager';
import { buildMcpTools } from '../mcp/McpToolBridge';
import { memoryService } from '../memory/MemoryService';
import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
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
  deleteSession as deleteSessionFromStore,
  appendMessage,
  loadSessionMessages,
  generateSessionId
} from './session-store';

export class AgentRuntime {
  private activeSession: AgentSession | null = null;
  private activeSessionId: string | null = null;
  private status: AgentStatus = { sessionId: null, state: 'idle' };
  private mainWindow: BrowserWindow | null = null;
  private messageCount: number = 0;
  private currentAssistantContent: string = '';
  private activeToolCalls: Map<string, ToolCall> = new Map();
  private unsubscriber: (() => void) | null = null;

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

  private applyModelEnvVars(): void {
    const envVars = modelManager.getModelEnvVars();
    for (const [key, value] of Object.entries(envVars)) {
      if (value) {
        process.env[key] = value;
      }
    }
  }

  private async loadMcpTools(): Promise<ToolDefinition[]> {
    const tools: ToolDefinition[] = [];
    const mcpConfigs = mcpManager.list();

    for (const config of mcpConfigs) {
      if (!config.enabled) continue;

      try {
        let server = mcpManager.getServer(config.id);

        if (!server || !server.running) {
          await mcpManager.start(config.id);
          server = mcpManager.getServer(config.id);
        }

        if (server) {
          const mcpTools = server.getTools();
          const piTools = buildMcpTools(server, config.id, mcpTools);
          tools.push(...piTools);
        }
      } catch (err) {
        console.error(`Failed to load MCP tools for ${config.name}:`, err);
      }
    }

    return tools;
  }

  async newSession(workspacePath: string): Promise<string> {
    // Clean up previous session
    if (this.unsubscriber) {
      this.unsubscriber();
      this.unsubscriber = null;
    }

    const sessionId = generateSessionId();
    const title = `New Chat ${new Date().toLocaleTimeString()}`;

    // Apply active model configuration via environment variables
    this.applyModelEnvVars();

    const piSettingsManager = SettingsManager.inMemory({
      compaction: { enabled: false }
    });

    const codingTools = createCodingTools(workspacePath);

    // Load MCP tools from enabled servers
    const mcpTools = await this.loadMcpTools();
    const memoryTools = memoryService.buildTools();
    const allCustomTools = [...codingTools, ...mcpTools, ...memoryTools];

    const { session } = await createAgentSession({
      cwd: workspacePath,
      customTools: allCustomTools as any[],
      sessionManager: SessionManager.inMemory(),
      settingsManager: piSettingsManager
    });

    this.activeSession = session;
    this.activeSessionId = sessionId;
    this.messageCount = 0;
    this.currentAssistantContent = '';
    this.activeToolCalls.clear();

    this.unsubscriber = session.subscribe((event: AgentSessionEvent) => {
      this.handleSessionEvent(event);
    });

    createSessionMeta(sessionId, workspacePath, title);
    this.setStatus({ sessionId, state: 'idle' });

    return sessionId;
  }

  async switchSession(sessionId: string): Promise<void> {
    const sessions = listSessions();
    const meta = sessions.find(s => s.id === sessionId);
    if (!meta) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Clean up previous session
    if (this.unsubscriber) {
      this.unsubscriber();
      this.unsubscriber = null;
    }

    // Apply active model configuration via environment variables
    this.applyModelEnvVars();

    const piSettingsManager = SettingsManager.inMemory({
      compaction: { enabled: false }
    });

    const codingTools = createCodingTools(meta.workspacePath);

    // Load MCP tools from enabled servers
    const mcpTools = await this.loadMcpTools();
    const memoryTools = memoryService.buildTools();
    const allCustomTools = [...codingTools, ...mcpTools, ...memoryTools];

    const { session } = await createAgentSession({
      cwd: meta.workspacePath,
      customTools: allCustomTools as any[],
      sessionManager: SessionManager.inMemory(),
      settingsManager: piSettingsManager
    });

    this.activeSession = session;
    this.activeSessionId = sessionId;
    this.messageCount = meta.messageCount;
    this.currentAssistantContent = '';
    this.activeToolCalls.clear();

    this.unsubscriber = session.subscribe((event: AgentSessionEvent) => {
      this.handleSessionEvent(event);
    });

    this.setStatus({ sessionId, state: 'idle' });
  }

  deleteSession(sessionId: string): void {
    if (this.activeSessionId === sessionId) {
      if (this.unsubscriber) {
        this.unsubscriber();
        this.unsubscriber = null;
      }
      this.activeSession = null;
      this.activeSessionId = null;
      this.setStatus({ sessionId: null, state: 'idle' });
    }
    deleteSessionFromStore(sessionId);
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

    // Reset assistant state for new turn
    this.currentAssistantContent = '';
    this.activeToolCalls.clear();

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
      await this.activeSession.prompt(content);
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

  private handleSessionEvent(event: AgentSessionEvent): void {
    if (!this.activeSessionId) return;

    switch (event.type) {
      case 'message_start':
        this.setStatus({ state: 'thinking' });
        this.currentAssistantContent = '';
        break;

      case 'message_update': {
        const assistantEvent = event.assistantMessageEvent;
        if (assistantEvent.type === 'text_delta') {
          this.currentAssistantContent += assistantEvent.delta;
          this.setStatus({ state: 'responding' });
        }
        break;
      }

      case 'message_end': {
        const content = this.currentAssistantContent;
        const toolCalls = Array.from(this.activeToolCalls.values());
        const assistantMsg: Message = {
          id: `msg_${Date.now()}_a`,
          role: 'assistant',
          content,
          timestamp: Date.now(),
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined
        };
        appendMessage(this.activeSessionId, assistantMsg);
        this.emit(AGENT_EVENT_MESSAGE, assistantMsg);
        this.messageCount++;

        // Update session meta
        const sessions = listSessions();
        const meta = sessions.find(s => s.id === this.activeSessionId);
        if (meta) {
          const firstLine = content.trim().split('\n')[0].slice(0, 50);
          updateSessionMeta(this.activeSessionId, {
            title: firstLine || meta.title,
            messageCount: this.messageCount
          });
        }

        this.setStatus({ state: 'idle', currentTool: undefined });
        break;
      }

      case 'tool_execution_start': {
        const toolCall: ToolCall = {
          id: event.toolCallId,
          name: event.toolName,
          input: event.args || {},
          status: 'running'
        };
        this.activeToolCalls.set(event.toolCallId, toolCall);
        this.setStatus({ state: 'tool_calling', currentTool: event.toolName });
        this.emit(AGENT_EVENT_TOOL_CALL, {
          toolCall,
          messageId: this.activeSessionId
        });
        break;
      }

      case 'tool_execution_end': {
        const toolCall = this.activeToolCalls.get(event.toolCallId);
        if (toolCall) {
          toolCall.status = event.isError ? 'error' : 'success';
          toolCall.output = this.formatToolResult(event.result);
          if (event.isError && event.result?.error) {
            toolCall.error = String(event.result.error);
          }
          this.emit(AGENT_EVENT_TOOL_RESULT, {
            toolCallId: event.toolCallId,
            output: toolCall.output,
            status: toolCall.status
          });
        }
        break;
      }

      case 'compaction_end':
        if ('errorMessage' in event && event.errorMessage) {
          this.emit(AGENT_EVENT_ERROR, event.errorMessage);
          this.setStatus({ state: 'error' });
        }
        break;

      case 'agent_end':
        if ('willRetry' in event && event.willRetry === false) {
          // Agent finished without retrying - check for error state via message
        }
        break;
    }
  }

  private formatToolResult(result: unknown): string {
    if (result == null) return '';
    if (typeof result === 'string') return result;
    if (typeof result === 'object') {
      // Check for common result shapes
      const r = result as Record<string, unknown>;
      if (typeof r.content === 'string') return r.content;
      if (Array.isArray(r.content) && r.content.length > 0) {
        return r.content.map((c: any) => c.text || c.content || '').join('\n');
      }
      try {
        return JSON.stringify(result, null, 2);
      } catch {
        return String(result);
      }
    }
    return String(result);
  }
}

export const agentRuntime = new AgentRuntime();
