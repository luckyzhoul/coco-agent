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
import { workspaceManager } from '../workspace/WorkspaceManager';
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
  AGENT_EVENT_ERROR,
  AGENT_EVENT_MESSAGE_DELTA,
  AGENT_EVENT_THINKING_DELTA,
  AGENT_EVENT_TOOL_CALL_DELTA,
  AGENT_EVENT_MESSAGE_END,
  AGENT_EVENT_FILE_DELIVERY,
  AGENT_EVENT_TURN_END
} from '../../shared/ipc-channels';
import type {
  Message,
  ToolCall,
  AgentStatus,
  SessionInfo,
  MessagePart,
  TextPart,
  ThinkingPart,
  ToolCallPart,
  FileDeliveryPart,
  TurnSummary
} from '../../shared/types';
import * as fs from 'node:fs';
import {
  listSessions,
  createSessionMeta,
  updateSessionMeta,
  deleteSession as deleteSessionFromStore,
  appendMessage,
  deleteTrailingAssistantMessages,
  loadSessionMessages,
  generateSessionId,
  searchSessions,
  setSessionArchived,
  updateSessionWorkspace,
  type SessionSearchResult
} from './session-store';

export class AgentRuntime {
  private activeSession: AgentSession | null = null;
  private activeSessionId: string | null = null;
  private status: AgentStatus = { sessionId: null, state: 'idle' };
  private mainWindow: BrowserWindow | null = null;
  private messageCount: number = 0;
  private unsubscriber: (() => void) | null = null;

  // Streaming state for the current assistant turn
  private currentMessageId: string | null = null;
  private currentParts: MessagePart[] = [];
  private partIndexCounter: number = 0;
  private currentTextPartIndex: number = -1;
  private currentThinkingPartIndex: number = -1;
  private pendingTextDelta: string = '';
  private pendingThinkingDelta: string = '';
  private deltaFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly FLUSH_INTERVAL_MS = 50;
  private turnStartTime: number = 0;
  private turnToolCount: number = 0;
  private turnThinkingCount: number = 0;
  // Backward compat: accumulate all tool calls for the current message
  private activeToolCalls: Map<string, ToolCall> = new Map();

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
    const next = { ...this.status, ...status };
    if (
      next.state === this.status.state &&
      next.currentTool === this.status.currentTool &&
      next.sessionId === this.status.sessionId
    ) {
      return;
    }
    this.status = next;
    this.emit(AGENT_EVENT_STATUS, this.status);
  }

  private nextPartIndex(): number {
    return this.partIndexCounter++;
  }

  private scheduleDeltaFlush(): void {
    if (this.deltaFlushTimer) return;
    this.deltaFlushTimer = setTimeout(() => {
      this.flushDeltas();
      this.deltaFlushTimer = null;
    }, this.FLUSH_INTERVAL_MS);
  }

  private flushDeltas(): void {
    const msgId = this.currentMessageId;
    if (!msgId) return;

    if (this.pendingTextDelta && this.currentTextPartIndex >= 0) {
      const part = this.currentParts[this.currentTextPartIndex] as TextPart;
      if (part && part.type === 'text') {
        part.content += this.pendingTextDelta;
        this.emit(AGENT_EVENT_MESSAGE_DELTA, {
          messageId: msgId,
          partIndex: this.currentTextPartIndex,
          delta: this.pendingTextDelta
        });
      }
      this.pendingTextDelta = '';
    }

    if (this.pendingThinkingDelta && this.currentThinkingPartIndex >= 0) {
      const part = this.currentParts[this.currentThinkingPartIndex] as ThinkingPart;
      if (part && part.type === 'thinking') {
        part.content += this.pendingThinkingDelta;
        this.emit(AGENT_EVENT_THINKING_DELTA, {
          messageId: msgId,
          partIndex: this.currentThinkingPartIndex,
          delta: this.pendingThinkingDelta
        });
      }
      this.pendingThinkingDelta = '';
    }
  }

  private ensureTextPart(): void {
    if (this.currentTextPartIndex >= 0) return;
    const idx = this.nextPartIndex();
    const part: TextPart = {
      id: `text_${Date.now()}_${idx}`,
      type: 'text',
      index: idx,
      content: '',
      streaming: true
    };
    this.currentParts.push(part);
    this.currentTextPartIndex = idx;
  }

  private endTextPart(): void {
    if (this.currentTextPartIndex < 0) return;
    const part = this.currentParts[this.currentTextPartIndex] as TextPart;
    if (part) part.streaming = false;
    this.currentTextPartIndex = -1;
  }

  private startThinkingPart(): void {
    if (this.currentThinkingPartIndex >= 0) return;
    this.endTextPart();
    const idx = this.nextPartIndex();
    const part: ThinkingPart = {
      id: `think_${Date.now()}_${idx}`,
      type: 'thinking',
      index: idx,
      content: '',
      state: 'generating'
    };
    this.currentParts.push(part);
    this.currentThinkingPartIndex = idx;
    this.turnThinkingCount++;
    // Notify renderer immediately so it can show "思考中..."
    if (this.currentMessageId) {
      this.emit(AGENT_EVENT_THINKING_DELTA, {
        messageId: this.currentMessageId,
        partIndex: idx,
        delta: '',
        state: 'generating' as const
      });
    }
  }

  private endThinkingPart(): void {
    if (this.currentThinkingPartIndex < 0) return;
    this.flushDeltas();
    const part = this.currentParts[this.currentThinkingPartIndex] as ThinkingPart;
    if (part) {
      part.state = 'done';
      if (this.currentMessageId) {
        this.emit(AGENT_EVENT_THINKING_DELTA, {
          messageId: this.currentMessageId,
          partIndex: this.currentThinkingPartIndex,
          delta: '',
          state: 'done' as const
        });
      }
    }
    this.currentThinkingPartIndex = -1;
  }

  private addToolCallPart(toolCall: ToolCall): number {
    this.endTextPart();
    this.endThinkingPart();
    const idx = this.nextPartIndex();
    const part: ToolCallPart = {
      id: `tool_${Date.now()}_${idx}`,
      type: 'tool_call',
      index: idx,
      toolCall
    };
    this.currentParts.push(part);
    this.turnToolCount++;
    if (this.currentMessageId) {
      this.emit(AGENT_EVENT_TOOL_CALL_DELTA, {
        messageId: this.currentMessageId,
        partIndex: idx,
        toolCall
      });
    }
    return idx;
  }

  private updateToolCallPartStatus(toolCallId: string, updates: Partial<ToolCall>): void {
    const part = this.currentParts.find(
      (p): p is ToolCallPart => p.type === 'tool_call' && p.toolCall.id === toolCallId
    );
    if (!part) return;
    part.toolCall = { ...part.toolCall, ...updates };
    if (this.currentMessageId) {
      this.emit(AGENT_EVENT_TOOL_CALL_DELTA, {
        messageId: this.currentMessageId,
        partIndex: part.index,
        updates
      });
    }
  }

  private addFileDeliveryPartIfApplicable(toolCall: ToolCall): void {
    if (toolCall.status !== 'success') return;

    let filePath: string | undefined;
    let action: 'create' | 'edit' = 'create';

    const name = toolCall.name.toLowerCase();
    const input = toolCall.input as Record<string, unknown>;

    // Pi built-in write/edit tools
    if (name.includes('write') || name.includes('create_file')) {
      filePath = typeof input.path === 'string' ? input.path :
                 typeof input.file_path === 'string' ? input.file_path : undefined;
      action = 'create';
    } else if (name.includes('edit') || name.includes('apply_diff') || name.includes('patch')) {
      filePath = typeof input.path === 'string' ? input.path :
                 typeof input.file_path === 'string' ? input.file_path : undefined;
      action = 'edit';
    }

    if (!filePath) return;

    // Resolve relative to workspace (best-effort)
    let fileSize: number | undefined;
    try {
      const stat = fs.statSync(filePath);
      if (stat.isFile()) fileSize = stat.size;
    } catch {
      // file might not exist yet or path is relative; skip size
    }

    const fileName = filePath.split(/[\\/]/).pop() || filePath;
    const idx = this.nextPartIndex();
    const part: FileDeliveryPart = {
      id: `file_${Date.now()}_${idx}`,
      type: 'file_delivery',
      index: idx,
      filePath,
      fileName,
      action,
      fileSize
    };
    this.currentParts.push(part);

    if (this.currentMessageId) {
      this.emit(AGENT_EVENT_FILE_DELIVERY, {
        messageId: this.currentMessageId,
        partIndex: idx,
        file: {
          filePath: part.filePath,
          fileName: part.fileName,
          action: part.action,
          fileSize: part.fileSize
        }
      });
    }
  }

  private resetTurnState(): void {
    if (this.deltaFlushTimer) {
      clearTimeout(this.deltaFlushTimer);
      this.deltaFlushTimer = null;
    }
    this.currentMessageId = null;
    this.currentParts = [];
    this.partIndexCounter = 0;
    this.currentTextPartIndex = -1;
    this.currentThinkingPartIndex = -1;
    this.pendingTextDelta = '';
    this.pendingThinkingDelta = '';
    this.activeToolCalls.clear();
    this.turnToolCount = 0;
    this.turnThinkingCount = 0;
  }

  private buildCurrentMessage(): Message {
    // Make sure all streaming flags are off
    const parts: MessagePart[] = this.currentParts.map((p) => {
      if (p.type === 'text') return { ...p, streaming: false } as TextPart;
      if (p.type === 'thinking') return { ...p, state: 'done' as const } as ThinkingPart;
      return p;
    });
    const plainContent = parts
      .filter((p) => p.type === 'text')
      .map((p) => (p as TextPart).content)
      .join('\n\n');
    const toolCalls = parts
      .filter((p) => p.type === 'tool_call')
      .map((p) => (p as ToolCallPart).toolCall);
    return {
      id: `msg_${Date.now()}_a_${Math.random().toString(36).slice(2, 8)}`,
      role: 'assistant',
      content: plainContent,
      timestamp: Date.now(),
      parts,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined
    };
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
        '还没有配置模型。请到「设置 → 模型」里添加一个。'
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
      const detail = modelRuntime.getError() || '未知原因';
      this.emit(
        AGENT_EVENT_ERROR,
        `模型「${active.name}」（${active.model}）在 Pi 运行时中不可用：${detail}。` +
          `请检查「设置 → 模型」里的接口地址与 API Key。`
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
    const title = `新对话 ${new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })}`;

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
      excludeTools: this.securityExclusions(),
      sessionManager: SessionManager.inMemory(),
      settingsManager: piSettingsManager,
      resourceLoader,
      modelRuntime: runtime?.modelRuntime,
      model: runtime?.model
    });

    this.activeSession = session;
    this.activeSessionId = sessionId;
    this.messageCount = 0;
    this.resetTurnState();

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

  /** Rebuilds the Pi session for `sessionId`; returns the session's metadata
   * so the renderer can mirror its bound project space. */
  async switchSession(sessionId: string): Promise<SessionInfo> {
    const sessions = listSessions();
    const meta = sessions.find(s => s.id === sessionId);
    if (!meta) {
      throw new Error(`找不到会话：${sessionId}`);
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

    // Switching a conversation switches its project space everywhere: the app's
    // current space, the space panel, and the directory new sessions inherit.
    if (meta.workspacePath) {
      try {
        workspaceManager.setCurrent({
          path: meta.workspacePath,
          name: path.basename(meta.workspacePath) || meta.workspacePath
        });
      } catch {
        // The folder may have been moved or deleted; the session still opens.
      }
    }

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
    this.resetTurnState();

    this.unsubscriber = session.subscribe((event: AgentSessionEvent) => {
      this.handleSessionEvent(event);
    });

    this.setStatus({ sessionId, state: 'idle' });
    return meta;
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

  setSessionArchived(sessionId: string, archived: boolean): void {
    setSessionArchived(sessionId, archived);
  }

  /**
   * Move the active session to a different project space.
   *
   * The session's binding is the source of truth for cwd and PathGuard, so
   * rebinding means updating the stored path and rebuilding the Pi session.
   */
  async rebindWorkspace(workspacePath: string): Promise<SessionInfo | null> {
    if (!this.activeSessionId) return null;
    updateSessionWorkspace(this.activeSessionId, workspacePath);
    return this.switchSession(this.activeSessionId);
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
      throw new Error('当前没有活动会话');
    }

    // Reset assistant state for new turn
    this.resetTurnState();
    this.turnStartTime = Date.now();

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

  /**
   * 重新生成最后一条回复：把 Pi 会话树回退到最后一条用户消息之前，
   * 清掉应用库里的旧回复，然后用同一段用户输入重新 prompt。
   */
  async regenerateLast(): Promise<void> {
    if (!this.activeSession || !this.activeSessionId) {
      throw new Error('当前没有活动会话');
    }
    if (this.status.state !== 'idle' && this.status.state !== 'error') {
      throw new Error('正在生成中，无法重新生成');
    }

    // Find the last user entry along the active branch of the Pi session tree
    const branch = this.activeSession.sessionManager.getBranch();
    const lastUserEntry = [...branch]
      .reverse()
      .find((e) => e.type === 'message' && e.message?.role === 'user');
    if (!lastUserEntry) {
      throw new Error('没有可重新生成的消息');
    }

    // Rewind context to just before that user message; Pi hands the text back
    const nav = await this.activeSession.navigateTree(lastUserEntry.id);
    if (nav.cancelled) return;
    const content = (nav.editorText || '').trim();
    if (!content) {
      throw new Error('没有可重新生成的消息');
    }

    // Drop the old reply from the app DB and re-run
    deleteTrailingAssistantMessages(this.activeSessionId);

    this.resetTurnState();
    this.turnStartTime = Date.now();
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
  }

  private handleSessionEvent(event: AgentSessionEvent): void {
    if (!this.activeSessionId) return;

    switch (event.type) {
      case 'agent_start':
        this.turnStartTime = Date.now();
        // Create a single placeholder for the entire agent turn
        this.currentMessageId = `msg_${Date.now()}_a`;
        this.currentParts = [];
        this.partIndexCounter = 0;
        this.currentTextPartIndex = -1;
        this.currentThinkingPartIndex = -1;
        this.pendingTextDelta = '';
        this.pendingThinkingDelta = '';
        this.turnToolCount = 0;
        this.turnThinkingCount = 0;
        this.activeToolCalls.clear();
        {
          const placeholder: Message = {
            id: this.currentMessageId,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            parts: []
          };
          this.emit(AGENT_EVENT_MESSAGE, placeholder);
        }
        break;

      case 'turn_start':
        break;

      case 'message_start': {
        this.setStatus({ state: 'thinking' });
        // Reset per-message text/thinking tracking, but keep parts and partIndexCounter
        // so all steps of an agent turn stream into one continuous message.
        this.currentTextPartIndex = -1;
        this.currentThinkingPartIndex = -1;
        break;
      }

      case 'message_update': {
        const ae = event.assistantMessageEvent;
        switch (ae.type) {
          case 'thinking_start':
            this.startThinkingPart();
            break;
          case 'thinking_delta':
            if (this.currentThinkingPartIndex < 0) this.startThinkingPart();
            this.pendingThinkingDelta += ae.delta;
            this.scheduleDeltaFlush();
            break;
          case 'thinking_end':
            this.endThinkingPart();
            break;
          case 'text_delta':
            // End any active thinking before showing text
            if (this.currentThinkingPartIndex >= 0) this.endThinkingPart();
            this.ensureTextPart();
            this.pendingTextDelta += ae.delta;
            this.setStatus({ state: 'responding' });
            this.scheduleDeltaFlush();
            break;
          case 'toolcall_start':
            // End text/thinking before tool call
            this.endTextPart();
            this.endThinkingPart();
            break;
          case 'toolcall_delta':
            // Incremental tool-call args; we wait for tool_execution_start for full args
            break;
          case 'toolcall_end':
            // Tool call generated by model; actual execution starts later
            break;
          case 'start':
          case 'text_start':
          case 'text_end':
          case 'done':
          case 'error':
            break;
        }
        break;
      }

      case 'message_end': {
        const msg = event.message as { stopReason?: string; errorMessage?: string };
        if (msg.stopReason === 'error' || msg.stopReason === 'aborted') {
          const detail =
            msg.errorMessage ||
            (msg.stopReason === 'aborted' ? '生成已中止。' : '模型返回了错误。');
          this.emit(AGENT_EVENT_ERROR, detail);
          this.setStatus({ state: msg.stopReason === 'aborted' ? 'idle' : 'error' });
          this.resetTurnState();
          break;
        }

        // Flush any pending deltas and finalize streaming parts
        this.flushDeltas();
        this.endTextPart();
        this.endThinkingPart();

        // Persist to DB (each message_end = one row; history loader merges them)
        const assistantMsg = this.buildCurrentMessage();
        appendMessage(this.activeSessionId, assistantMsg);
        this.messageCount++;

        // Notify renderer to finalize streaming state
        if (this.currentMessageId) {
          this.emit(AGENT_EVENT_MESSAGE_END, { messageId: this.currentMessageId });
        }

        // Update session meta from the first non-empty text
        const firstText = (assistantMsg.parts || [])
          .find((p): p is TextPart => p.type === 'text' && p.content.trim().length > 0);
        if (firstText) {
          const firstLine = firstText.content.trim().split('\n')[0].slice(0, 50);
          const sessions = listSessions();
          const meta = sessions.find(s => s.id === this.activeSessionId);
          if (meta && firstLine) {
            updateSessionMeta(this.activeSessionId, {
              title: firstLine || meta.title,
              messageCount: this.messageCount
            });
          }
        }

        this.activeToolCalls.clear();
        break;
      }

      case 'tool_execution_start': {
        const toolCall: ToolCall = {
          id: event.toolCallId,
          name: event.toolName,
          input: event.args || {},
          status: 'running'
        };
        // Category hint for nicer UI rendering
        const name = event.toolName.toLowerCase();
        if (name.includes('bash') || name.includes('shell')) {
          toolCall.category = 'bash';
          toolCall.inputPreview = typeof event.args?.command === 'string'
            ? event.args.command.slice(0, 80)
            : undefined;
        } else if (name.includes('write') || name.includes('edit') || name.includes('create')) {
          toolCall.category = 'file_write';
        } else if (name.includes('read') || name.includes('view') || name.includes('cat')) {
          toolCall.category = 'file_read';
        } else if (name.includes('search') || name.includes('grep') || name.includes('find')) {
          toolCall.category = 'search';
        } else if (name.includes('browser') || name.includes('navigate')) {
          toolCall.category = 'browser';
        } else if (name.includes('computer') || name.includes('click') || name.includes('type')) {
          toolCall.category = 'computer';
        } else {
          toolCall.category = 'other';
        }

        this.activeToolCalls.set(event.toolCallId, toolCall);
        this.setStatus({ state: 'tool_calling', currentTool: event.toolName });

        // Ensure we have a message placeholder (should exist from message_start,
        // but belt-and-suspenders for edge cases)
        if (!this.currentMessageId) {
          this.currentMessageId = `msg_${Date.now()}_a`;
          this.emit(AGENT_EVENT_MESSAGE, {
            id: this.currentMessageId,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            parts: []
          });
        }

        this.addToolCallPart(toolCall);
        // Keep the legacy tool_call event for backward compat
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
          this.updateToolCallPartStatus(event.toolCallId, {
            status: toolCall.status,
            output: toolCall.output,
            error: toolCall.error
          });
          // Add file delivery card for write/edit tools
          this.addFileDeliveryPartIfApplicable(toolCall);
          // Legacy event for backward compat
          this.emit(AGENT_EVENT_TOOL_RESULT, {
            toolCallId: event.toolCallId,
            output: toolCall.output,
            status: toolCall.status
          });
        }
        break;
      }

      case 'turn_end':
        break;

      case 'agent_end': {
        const willRetry = 'willRetry' in event ? event.willRetry : false;
        // Insert a summary part into the stream if there were any tools/thinking
        if (
          this.currentMessageId &&
          (this.turnToolCount > 0 || this.turnThinkingCount > 0)
        ) {
          const summary: TurnSummary = {
            agentName: agentManager.getActive()?.name || 'CocoAgent',
            toolCount: this.turnToolCount,
            thinkingCount: this.turnThinkingCount,
            durationMs: Date.now() - this.turnStartTime
          };
          const idx = this.nextPartIndex();
          const summaryPart: import('../../shared/types').SummaryPart = {
            id: `summary_${Date.now()}_${idx}`,
            type: 'summary',
            index: idx,
            summary
          };
          this.currentParts.push(summaryPart);
          this.emit(AGENT_EVENT_TURN_END, {
            messageId: this.currentMessageId,
            partIndex: idx,
            summary
          });
        }
        if (!willRetry) {
          this.setStatus({ state: 'idle', currentTool: undefined });
          this.resetTurnState();
        }
        break;
      }

      case 'compaction_end':
        if ('errorMessage' in event && event.errorMessage) {
          this.emit(AGENT_EVENT_ERROR, event.errorMessage);
          this.setStatus({ state: 'error' });
        }
        break;

      default:
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
