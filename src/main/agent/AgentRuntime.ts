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
import { projectSkillsDir } from '../skills/projectSkills';
import { pathGuard } from '../security/PathGuard';
import { guardFileWrite, guardedBashOperations, guardedPowerShellOperations } from '../security/writeGuard';
import { workspaceManager } from '../workspace/WorkspaceManager';
import { mcpManager } from '../mcp/McpManager';
import { buildMcpTools } from '../mcp/McpToolBridge';
import { toolGate } from '../security/enforceToolGate';
import { memoryService } from '../memory/MemoryService';
import { approvalManager } from '../approval/ApprovalManager';
import { settingsManager } from '../settings/SettingsManager';
import { benignCompactionNotice, buildCompactionSettings } from './compaction';
import { toPiMessages, estimateTextTokens, estimatePiMessagesTokens } from './sessionRestore';
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
  AGENT_EVENT_TURN_END,
  AGENT_EVENT_COMPACTION,
  AGENT_EVENT_SESSION_TITLE
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
  TurnSummary,
  Attachment,
  SlashCommandInfo
} from '../../shared/types';
import * as fs from 'node:fs';
import { deriveFallbackTitle, generateTitle, isPlaceholderTitle } from './title';
import {
  listSessions,
  createSessionMeta,
  updateSessionMeta,
  setSessionDeleted,
  purgeSession,
  emptyTrash,
  listTrashedSessions,
  appendMessage,
  deleteTrailingAssistantMessages,
  loadSessionMessages,
  generateSessionId,
  searchSessions,
  setSessionArchived,
  updateSessionWorkspace,
  findMostRecentEmptySession,
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
  // 正在生成标题的会话，避免同一会话并发触发多次。
  private titleJobs = new Set<string>();

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
    // Coding tools are created with guarded filesystem/shell operations (see
    // security/writeGuard): the path policy is enforced at call time in every
    // mode — including readonly, whose mutations simply fail with an
    // explanatory error (tools stay assembled, which keeps the prompt cache
    // stable and lets mode switches apply to the running session instantly).
    const codingTools = createCodingTools(workspacePath, {
      write: {
        operations: {
          writeFile: async (abs, content) => {
            await guardFileWrite('write', { path: abs, content: `${content.slice(0, 120)}…` }, abs);
            await fs.promises.writeFile(abs, content, 'utf8');
          },
          mkdir: async (dir) => {
            await guardFileWrite('write', { path: dir }, dir, `Agent 请求创建目录：${dir}`);
            await fs.promises.mkdir(dir, { recursive: true });
          }
        }
      },
      edit: {
        operations: {
          readFile: (abs) => fs.promises.readFile(abs),
          writeFile: async (abs, content) => {
            await guardFileWrite('edit', { path: abs }, abs);
            await fs.promises.writeFile(abs, content, 'utf8');
          },
          access: async (abs) => {
            await fs.promises.access(abs, fs.constants.W_OK);
          }
        }
      },
      bash: { operations: guardedBashOperations() },
      powershell: { operations: guardedPowerShellOperations() }
    });
    const mcpTools = await this.loadMcpTools();
    const memoryTools = memoryService.buildTools();
    const browserTools = buildBrowserTools(toolGate);
    const computerTools = buildComputerTools(toolGate);

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
          const piTools = buildMcpTools(server, config.id, mcpTools, toolGate);
          tools.push(...piTools);
        }
      } catch (err) {
        console.error(`Failed to load MCP tools for ${config.name}:`, err);
      }
    }

    return tools;
  }

  async newSession(workspacePath: string): Promise<string> {
    const activeAgentId = agentManager.getActiveId();
    const emptySession = findMostRecentEmptySession(activeAgentId, workspacePath);
    if (emptySession) {
      await this.switchSession(emptySession.id);
      return emptySession.id;
    }

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

    const appSettings = settingsManager.get();

    // Materialise our model settings into models.json/auth.json and resolve the
    // active model explicitly. Pi has no other way of learning about models.
    const runtime = await this.resolveModelRuntime();

    // Compaction budgets scale with the model's context window (SDK defaults
    // assume a large one and would overflow small local models).
    const piSettingsManager = SettingsManager.inMemory({
      compaction: buildCompactionSettings(runtime?.model?.contextWindow),
      defaultThinkingLevel: (appSettings.defaultThinkingLevel || 'medium') as any
    });
    const resourceLoader = await this.buildResourceLoader(workspacePath, piSettingsManager);

    const allCustomTools = await this.buildCustomTools(workspacePath);

    const { session } = await createAgentSession({
      cwd: workspacePath,
      agentDir: PI_RUNTIME_DIR,
      customTools: allCustomTools as any[],
      sessionManager: SessionManager.inMemory(),
      settingsManager: piSettingsManager,
      resourceLoader,
      modelRuntime: runtime?.modelRuntime,
      model: runtime?.model,
      thinkingLevel: (appSettings.defaultThinkingLevel || 'medium') as any
    });

    this.activeSession = session;
    this.activeSessionId = sessionId;
    this.messageCount = 0;
    this.resetTurnState();
    approvalManager.resetApprovals();

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

    // Project-space skills (<space>/.coco/skills) apply to every agent while
    // the session is bound to that space. They are listed first because Pi
    // resolves same-name skills first-wins across the paths in this array —
    // a workspace skill must override an agent's enabled global copy.
    const additionalSkillPaths = [agentSkillsDir(agentId)];
    const workspaceSkillsDir = projectSkillsDir(workspacePath);
    if (fs.existsSync(workspaceSkillsDir)) {
      additionalSkillPaths.unshift(workspaceSkillsDir);
    }

    const loader = new DefaultResourceLoader({
      cwd: workspacePath,
      agentDir: PI_RUNTIME_DIR,
      settingsManager: piSettingsManager,
      appendSystemPrompt: buildPersonaPrompt(agentId),
      additionalSkillPaths
    });

    await loader.reload();
    return loader;
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
    const appSettings = settingsManager.get();

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

    const runtime = await this.resolveModelRuntime();

    // Compaction budgets scale with the model's context window (SDK defaults
    // assume a large one and would overflow small local models).
    const piSettingsManager = SettingsManager.inMemory({
      compaction: buildCompactionSettings(runtime?.model?.contextWindow),
      defaultThinkingLevel: (appSettings.defaultThinkingLevel || 'medium') as any
    });
    const resourceLoader = await this.buildResourceLoader(meta.workspacePath, piSettingsManager);
    const allCustomTools = await this.buildCustomTools(meta.workspacePath);

    const { session } = await createAgentSession({
      cwd: meta.workspacePath,
      agentDir: PI_RUNTIME_DIR,
      customTools: allCustomTools as any[],
      sessionManager: SessionManager.inMemory(),
      settingsManager: piSettingsManager,
      resourceLoader,
      modelRuntime: runtime?.modelRuntime,
      model: runtime?.model,
      thinkingLevel: (appSettings.defaultThinkingLevel || 'medium') as any
    });

    this.activeSession = session;
    this.activeSessionId = sessionId;
    this.messageCount = meta.messageCount;
    this.resetTurnState();
    approvalManager.resetApprovals();

    // 把 SQLite 里的历史消息回放进 Pi 会话：否则切到历史对话后模型失忆、
    // 用量圆环归零、手动压缩报「会话较短」。回放后再同步一次 agent 状态，
    // 让 getContextUsage 在下一次 prompt 前就能读到正确值。
    const modelInfo = runtime?.model
      ? { api: String(runtime.model.api), provider: String(runtime.model.provider), id: String(runtime.model.id) }
      : null;
    const piHistory = toPiMessages(loadSessionMessages(sessionId), modelInfo);
    if (piHistory.length > 0) {
      for (const m of piHistory) {
        session.sessionManager.appendMessage(m as any);
      }
      session.agent.state.messages = session.sessionManager.buildSessionContext().messages as any;
      // 老会话（usage 列上线前入库）没有真实用量：按 CJK 感知估算回填，
      // 避免 getContextUsage 退回 SDK 的 chars/4 估算（中文被低估约 4 倍）。
      this.backfillReplayedUsage(session, allCustomTools);
    }

    this.unsubscriber = session.subscribe((event: AgentSessionEvent) => {
      this.handleSessionEvent(event);
    });

    this.setStatus({ sessionId, state: 'idle' });
    return meta;
  }

  /**
   * 给没有真实 usage 的回放会话回填估算用量（仅内存，不写 DB）。
   *
   * getContextUsage 依赖最后一条 assistant 的 usage.totalTokens；usage 列上线前
   * 入库的老会话该值全 0，SDK 会退回 chars/4 文本估算——中文被低估约 4 倍，且
   * 完全漏掉 system prompt 与工具定义的真实开销。这里对整段上下文（含 system
   * prompt + 工具 schema）做 CJK 感知估算，挂到回放后的最后一条 assistant 上。
   * 会话内一旦产生新回复，真实 usage 会覆盖它。
   */
  private backfillReplayedUsage(session: AgentSession, tools: ToolDefinition[]): void {
    const messages = session.agent.state.messages as Array<{ role: string; usage?: Record<string, number>; stopReason?: string }>;
    // 只要历史里存在任一条有效 usage，SDK 就会优先用它，无需回填
    const hasRealUsage = [...messages]
      .reverse()
      .some(
        (m) =>
          m.role === 'assistant' &&
          m.stopReason !== 'aborted' &&
          m.stopReason !== 'error' &&
          m.usage &&
          (m.usage.totalTokens ??
            (m.usage.input ?? 0) + (m.usage.output ?? 0) +
            (m.usage.cacheRead ?? 0) + (m.usage.cacheWrite ?? 0)) > 0
      );
    if (hasRealUsage) return;

    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!lastAssistant) return;

    const toolText = tools
      .map((t) =>
        [t.name, t.description, t.promptSnippet ?? '', (t.promptGuidelines ?? []).join('\n'), JSON.stringify(t.parameters ?? {})].join('\n')
      )
      .join('\n');
    const total =
      estimatePiMessagesTokens(session.agent.state.messages as never) +
      estimateTextTokens(session.systemPrompt + '\n' + toolText);
    if (total <= 0) return;

    lastAssistant.usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: total };
  }

  /** 侧边栏删除 = 移入回收站（软删除），可在设置的回收站中恢复。 */
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
    setSessionDeleted(sessionId, true);
  }

  restoreSession(sessionId: string): void {
    setSessionDeleted(sessionId, false);
  }

  /** 彻底删除（硬删），仅回收站使用。 */
  purgeSession(sessionId: string): void {
    if (this.activeSessionId === sessionId) {
      // 被软删除的会话不会是活跃会话，这里兜底防止悬挂引用。
      if (this.unsubscriber) {
        this.unsubscriber();
        this.unsubscriber = null;
      }
      this.activeSession = null;
      this.activeSessionId = null;
      this.setStatus({ sessionId: null, state: 'idle' });
    }
    purgeSession(sessionId);
  }

  emptyTrash(): void {
    emptyTrash();
  }

  listTrashedSessions(): SessionInfo[] {
    return listTrashedSessions();
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

  async setThinkingLevel(level: string): Promise<string> {
    settingsManager.set({ defaultThinkingLevel: level });
    if (this.activeSession && typeof (this.activeSession as any).setThinkingLevel === 'function') {
      try {
        (this.activeSession as any).setThinkingLevel(level);
      } catch {
        // 模型不支持时忽略
      }
    }
    return level;
  }

  async compactContext(): Promise<void> {
    if (!this.activeSession) {
      throw new Error('当前没有活动会话');
    }
    if (typeof (this.activeSession as any).compact === 'function') {
      try {
        await (this.activeSession as any).compact();
      } catch (err) {
        // SDK 把「无需压缩」也当错误抛出；良性场景就此打住（提示已走 compaction_end 事件）。
        if (!benignCompactionNotice(err instanceof Error ? err.message : String(err))) {
          throw err;
        }
      }
    }
  }

  /**
   * 压缩当前会话并把摘要写入当前 agent 的记忆库。
   * 压缩取消（用户中断）或失败时不写记忆；压缩成功但摘要为空同样跳过。
   */
  async compactAndRemember(): Promise<void> {
    if (!this.activeSession) {
      throw new Error('当前没有活动会话');
    }
    let result: any;
    try {
      result = await (this.activeSession as any).compact();
    } catch (err) {
      // 良性场景（会话太短/已压缩过）不写记忆也不抛错，提示已走 compaction_end 事件。
      if (!benignCompactionNotice(err instanceof Error ? err.message : String(err))) {
        throw err;
      }
      return;
    }
    const summary = typeof result?.summary === 'string' ? result.summary.trim() : '';
    if (!summary) return;
    memoryService.add(summary, ['compaction'], 'compaction');
    this.emit(AGENT_EVENT_COMPACTION, {
      phase: 'end',
      message: '压缩摘要已写入记忆'
    });
  }

  /** 当前会话的上下文用量（tokens 可能为 null：压缩后未产生新回复前是未知态）。 */
  getContextUsage(): { tokens: number | null; contextWindow: number; percent: number | null } | null {
    if (!this.activeSession || typeof (this.activeSession as any).getContextUsage !== 'function') {
      return null;
    }
    const usage = (this.activeSession as any).getContextUsage();
    if (!usage) return null;
    return {
      tokens: usage.tokens ?? null,
      contextWindow: usage.contextWindow ?? 0,
      percent: usage.percent ?? null
    };
  }

  listCommands(): SlashCommandInfo[] {
    return [
      { name: '/compact', description: '压缩当前对话上下文', isBuiltin: true, icon: '↵↵' },
      { name: '/thinking', description: '切换思考深度（off/medium/high）', isBuiltin: true, icon: '💡' },
      { name: '/model', description: '快速切换模型', isBuiltin: true, icon: '🤖' },
      { name: '/clear', description: '清空当前会话消息', isBuiltin: true, icon: '🗑' }
    ];
  }

  async sendMessage(content: string, attachments: Attachment[] = []): Promise<void> {
    if (!this.activeSession || !this.activeSessionId) {
      throw new Error('当前没有活动会话');
    }

    const fullContent = this.buildMessageWithAttachments(content, attachments);

    // Reset assistant state for new turn
    this.resetTurnState();
    this.turnStartTime = Date.now();

    // Add user message
    const userMsg: Message = {
      id: `msg_${Date.now()}_u`,
      role: 'user',
      content: fullContent,
      timestamp: Date.now()
    };
    appendMessage(this.activeSessionId, userMsg);
    this.emit(AGENT_EVENT_MESSAGE, userMsg);
    this.messageCount++;

    try {
      this.setStatus({ state: 'thinking' });
      await this.activeSession.prompt(fullContent);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.emit(AGENT_EVENT_ERROR, errorMsg);
      this.setStatus({ state: 'error' });
    }
  }

  private buildMessageWithAttachments(content: string, attachments: Attachment[]): string {
    if (attachments.length === 0) return content;

    const parts: string[] = [];
    for (const att of attachments) {
      try {
        const stat = fs.statSync(att.path);
        if (stat.isDirectory()) {
          parts.push(`\n--- 附件文件夹：${att.name} ---\n（文件夹内容未读取，路径：${att.path}）\n`);
          continue;
        }
        if (stat.size > 1024 * 1024) {
          parts.push(`\n--- 附件：${att.name} ---\n（文件过大，${(stat.size / 1024).toFixed(0)} KB，未读取内容）\n`);
          continue;
        }
        const isText = this.isTextFile(att.name);
        if (isText) {
          const fileContent = fs.readFileSync(att.path, 'utf-8');
          parts.push(`\n--- 附件：${att.name} ---\n${fileContent}\n`);
        } else {
          parts.push(`\n--- 附件：${att.name} ---\n（二进制文件，${(stat.size / 1024).toFixed(1)} KB，内容未读取）\n`);
        }
      } catch {
        parts.push(`\n--- 附件：${att.name} ---\n（无法读取文件）\n`);
      }
    }

    return content + parts.join('');
  }

  private isTextFile(filename: string): boolean {
    const textExts = [
      '.txt', '.md', '.markdown', '.csv', '.json', '.xml', '.yaml', '.yml',
      '.py', '.js', '.ts', '.tsx', '.jsx', '.html', '.css', '.scss', '.less',
      '.java', '.c', '.cpp', '.h', '.hpp', '.go', '.rs', '.rb', '.php',
      '.sh', '.bash', '.zsh', '.fish', '.sql', '.log', '.ini', '.conf',
      '.env', '.toml', '.dockerfile', '.makefile', '.vue', '.svelte',
      '.swift', '.kt', '.dart', '.lua', '.r', '.m', '.mm', '.plist'
    ];
    const lower = filename.toLowerCase();
    return textExts.some((ext) => lower.endsWith(ext));
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
        // SDK 的 entry 生命周期事件对 user/toolResult 也会触发（如恢复回放）；
        // 这里的流式收尾与持久化只针对 assistant，避免误存行/误存 usage。
        if ((event.message as { role?: string }).role !== 'assistant') {
          break;
        }
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
        // 真实 token 用量随消息入库：切换会话回放时 SDK 靠它算上下文用量，
        // 不存的话 getContextUsage 会退回 chars/4 文本估算（中文误差极大）。
        const sdkUsage = (event.message as { usage?: Record<string, number> }).usage;
        if (sdkUsage) {
          assistantMsg.usage = {
            input: Number(sdkUsage.input ?? 0),
            output: Number(sdkUsage.output ?? 0),
            cacheRead: Number(sdkUsage.cacheRead ?? 0),
            cacheWrite: Number(sdkUsage.cacheWrite ?? 0),
            totalTokens: Number(
              sdkUsage.totalTokens ??
                (sdkUsage.input ?? 0) + (sdkUsage.output ?? 0) +
                (sdkUsage.cacheRead ?? 0) + (sdkUsage.cacheWrite ?? 0)
            )
          };
        }
        appendMessage(this.activeSessionId, assistantMsg);
        this.messageCount++;

        // Notify renderer to finalize streaming state
        if (this.currentMessageId) {
          this.emit(AGENT_EVENT_MESSAGE_END, { messageId: this.currentMessageId });
        }

        // 会话标题只在首轮结束后生成一次（见 maybeGenerateTitle），
        // 这里只负责同步消息计数（空会话复用依赖它）。
        const sessionId = this.activeSessionId;
        if (sessionId) {
          updateSessionMeta(sessionId, { messageCount: this.messageCount });
          void this.maybeGenerateTitle(sessionId);
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

      case 'compaction_start':
        this.emit(AGENT_EVENT_COMPACTION, {
          phase: 'start',
          message: '正在压缩对话上下文…'
        });
        break;

      case 'compaction_end': {
        if (event.errorMessage) {
          // SDK 把「无需压缩」也当错误报上来；良性场景给友好提示而不是错误。
          const benign = benignCompactionNotice(event.errorMessage);
          if (benign) {
            this.emit(AGENT_EVENT_COMPACTION, { phase: 'end', message: benign });
          } else {
            this.emit(AGENT_EVENT_ERROR, event.errorMessage);
            this.setStatus({ state: 'error' });
          }
        } else if (event.aborted) {
          this.emit(AGENT_EVENT_COMPACTION, {
            phase: 'end',
            message: '压缩已取消'
          });
        } else {
          const tokensBefore = event.result?.tokensBefore;
          this.emit(AGENT_EVENT_COMPACTION, {
            phase: 'end',
            message: tokensBefore
              ? `对话上下文已压缩（压缩前约 ${tokensBefore} tokens）`
              : '对话上下文已压缩'
          });
        }
        break;
      }

      default:
        break;
    }
  }

  /**
   * 首轮结束后生成会话标题，只生成一次。
   *
   * 幂等条件：标题仍是 newSession 的占位值（以「新对话」开头）。
   * 先用首条用户消息给出即时回退标题（保证 UI 立刻有内容），
   * 再异步调用模型总结出更贴切的标题；模型不可用或失败时保留回退标题。
   */
  private async maybeGenerateTitle(sessionId: string): Promise<void> {
    if (this.titleJobs.has(sessionId)) return;

    const meta = listSessions().find((s) => s.id === sessionId);
    if (!meta || !isPlaceholderTitle(meta.title)) return;

    const firstUser = loadSessionMessages(sessionId).find(
      (m) => m.role === 'user' && (m.content || '').trim().length > 0
    );
    const firstUserText = (firstUser?.content || '').trim();
    if (!firstUserText) return;

    this.titleJobs.add(sessionId);
    try {
      const fallback = deriveFallbackTitle(firstUserText);
      if (fallback) {
        updateSessionMeta(sessionId, { title: fallback });
        this.emit(AGENT_EVENT_SESSION_TITLE, { sessionId, title: fallback });
      }

      const model = modelManager.getActive();
      if (!model) return;

      const title = await generateTitle(model, firstUserText);
      if (title) {
        updateSessionMeta(sessionId, { title });
        this.emit(AGENT_EVENT_SESSION_TITLE, { sessionId, title });
      }
    } catch (err) {
      console.error('生成会话标题失败：', err);
    } finally {
      this.titleJobs.delete(sessionId);
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
