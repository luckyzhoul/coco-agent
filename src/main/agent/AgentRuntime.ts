import type { BrowserWindow } from 'electron';
import * as path from 'node:path';
import {
  createAgentSession,
  createCodingTools,
  DefaultResourceLoader,
  ModelRuntime,
  SessionManager,
  SettingsManager,
  type AgentSession,
  type AgentSessionEvent
} from '@earendil-works/pi-coding-agent';
import { modelManager } from '../models/ModelManager';
import { providerIdFor, syncPiModelConfig } from '../models/PiModelConfig';
import { agentManager } from '../agents/AgentManager';
import { agentSkillsDir, buildPersonaPrompt } from '../agents/persona';
import { pathGuard } from '../security/PathGuard';
import { excludedToolsFor } from '../security/pathPolicy';
import { mcpManager } from '../mcp/McpManager';
import { buildMcpTools } from '../mcp/McpToolBridge';
import { memoryService } from '../memory/MemoryService';
import { approvalManager } from '../approval/ApprovalManager';
import { PI_RUNTIME_DIR } from '../paths';
import { buildBrowserTools } from '../browser/browserTools';
import { buildComputerTools } from '../computer/computerTools';
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
  generateSessionId,
  searchSessions,
  type SessionSearchResult
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
    approvalManager.setMainWindow(window);
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

  /**
   * Materialise model settings into the Pi runtime directory and resolve the
   * active model. Returns undefined when no usable model is configured, which
   * the caller surfaces to the user instead of failing silently.
   */
  private async resolveModelRuntime(): Promise<{
    modelRuntime: ModelRuntime;
    model: NonNullable<Parameters<typeof createAgentSession>[0]>['model'];
  } | undefined> {
    const models = modelManager.list();
    const active = modelManager.getActive();

    if (!active) {
      this.emit(
        AGENT_EVENT_ERROR,
        'No model configured. Open Settings → Models and add one.'
      );
      return undefined;
    }

    syncPiModelConfig(models, active.id);

    const modelRuntime = await ModelRuntime.create({
      authPath: path.join(PI_RUNTIME_DIR, 'auth.json'),
      modelsPath: path.join(PI_RUNTIME_DIR, 'models.json')
    });

    const providerId = providerIdFor(active);
    const model = modelRuntime.getModel(providerId, active.model);

    if (!model) {
      const detail = modelRuntime.getError() || 'unknown reason';
      this.emit(
        AGENT_EVENT_ERROR,
        `Model "${active.name}" (${active.model}) is not available in the Pi runtime: ${detail}. ` +
          `Check the base URL and API key in Settings → Models.`
      );
      return undefined;
    }

    return { modelRuntime, model };
  }

  private async buildCustomTools(workspacePath: string): Promise<ToolDefinition[]> {
    const codingTools = createCodingTools(workspacePath);
    const mcpTools = await this.loadMcpTools();
    const memoryTools = memoryService.buildTools();
    const browserTools = buildBrowserTools(approvalManager);
    const computerTools = buildComputerTools(approvalManager);

    return [
      ...codingTools,
      ...mcpTools,
      ...memoryTools,
      ...browserTools,
      ...computerTools
    ] as unknown as ToolDefinition[];
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
          const piTools = buildMcpTools(server, config.id, mcpTools, approvalManager);
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

    // PathGuard's write root follows the session's workspace.
    pathGuard.setWorkspaceRoot(workspacePath);

    // Memories are agent-scoped; make sure the active agent's are loaded.
    memoryService.load(agentManager.getActiveId());

    const piSettingsManager = SettingsManager.inMemory({
      compaction: { enabled: false }
    });
    const resourceLoader = await this.buildResourceLoader(workspacePath, piSettingsManager);

    const allCustomTools = await this.buildCustomTools(workspacePath);

    // Materialise our model settings into models.json/auth.json and resolve the
    // active model explicitly. Pi has no other way of learning about models.
    const runtime = await this.resolveModelRuntime();
    const { session } = await createAgentSession({
      cwd: workspacePath,
      agentDir: PI_RUNTIME_DIR,
      customTools: allCustomTools as any[],
      sessionManager: SessionManager.inMemory(),
      settingsManager: piSettingsManager,
      resourceLoader,
      modelRuntime: runtime?.modelRuntime,
      model: runtime?.model
    });

    this.activeSession = session;
    this.activeSessionId = sessionId;
    this.messageCount = 0;
    this.currentAssistantContent = '';
    this.activeToolCalls.clear();

    this.unsubscriber = session.subscribe((event: AgentSessionEvent) => {
      this.handleSessionEvent(event);
    });

    createSessionMeta(sessionId, workspacePath, title, agentManager.getActiveId());
    this.setStatus({ sessionId, state: 'idle' });

    return sessionId;
  }

  /**
   * Build the Pi resource loader for the active agent.
   *
   * The persona is injected via appendSystemPrompt and the agent's own skills
   * dir via additionalSkillPaths, so switching agents changes both voice and
   * available skills. Note: when a custom loader is passed, the SDK no longer
   * calls reload() itself — we must do it.
   */
  private async buildResourceLoader(
    workspacePath: string,
    piSettingsManager: SettingsManager
  ): Promise<DefaultResourceLoader> {
    const agentId = agentManager.getActiveId();

    const loader = new DefaultResourceLoader({
      cwd: workspacePath,
      agentDir: PI_RUNTIME_DIR,
      settingsManager: piSettingsManager,
      appendSystemPrompt: buildPersonaPrompt(agentId),
      additionalSkillPaths: [agentSkillsDir(agentId)]
    });

    await loader.reload();
    return loader;
  }

  /**
   * Tools to withhold from the session at the current security level.
   *
   * This is the real enforcement of `readonly`: Pi runs its built-in file
   * tools in-process, so rather than intercepting calls we never hand the
   * model write/edit/bash in the first place.
   */
  private securityExclusions(): string[] {
    return excludedToolsFor(pathGuard.level);
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

    // Apply active model configuration
    const piSettingsManager = SettingsManager.inMemory({
      compaction: { enabled: false }
    });

    // A session belongs to an agent; switching to it should switch the persona too.
    if (meta.agentId && meta.agentId !== agentManager.getActiveId()) {
      try {
        agentManager.setActive(meta.agentId);
      } catch {
        // Agent may have been deleted; keep the current one.
      }
    }
    memoryService.load(agentManager.getActiveId());

    pathGuard.setWorkspaceRoot(meta.workspacePath);

    const resourceLoader = await this.buildResourceLoader(meta.workspacePath, piSettingsManager);
    const allCustomTools = await this.buildCustomTools(meta.workspacePath);

    const runtime = await this.resolveModelRuntime();
    const { session } = await createAgentSession({
      cwd: meta.workspacePath,
      agentDir: PI_RUNTIME_DIR,
      customTools: allCustomTools as any[],
      excludeTools: this.securityExclusions(),
      sessionManager: SessionManager.inMemory(),
      settingsManager: piSettingsManager,
      resourceLoader,
      modelRuntime: runtime?.modelRuntime,
      model: runtime?.model
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

  searchSessions(query: string): SessionSearchResult[] {
    return searchSessions(query);
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
        // An assistant message can still end in a provider error or an abort;
        // without this check the user just sees silence.
        const msg = event.message as { stopReason?: string; errorMessage?: string };
        if (msg.stopReason === 'error' || msg.stopReason === 'aborted') {
          const detail =
            msg.errorMessage ||
            (msg.stopReason === 'aborted' ? 'Generation aborted.' : 'Model returned an error.');
          this.emit(AGENT_EVENT_ERROR, detail);
          this.setStatus({ state: msg.stopReason === 'aborted' ? 'idle' : 'error' });
          break;
        }

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
