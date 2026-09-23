import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useIpcRenderer } from '../../hooks/useIpcRenderer';
import { useChatStore } from '../../stores/useChatStore';
import { useSessionStore } from '../../stores/useSessionStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import type { ModelProvider, Attachment, SecurityLevel, SlashCommandInfo } from '@shared/types';

const providerLabels: Record<ModelProvider, string> = {
  'openai-compatible': 'OpenAI 兼容',
  'anthropic': 'Anthropic',
  'ollama': 'Ollama（本地）',
  'ark': 'Ark（豆包）'
};

type ThinkingLevel = 'off' | 'medium' | 'high';

const THINKING_OPTIONS: { value: ThinkingLevel; label: string; hint: string }[] = [
  { value: 'off', label: '关闭', hint: '不推理' },
  { value: 'medium', label: '中等', hint: '平衡推理' },
  { value: 'high', label: '深度', hint: '深度推理' }
];

const SECURITY_OPTIONS: { value: SecurityLevel; label: string; hint: string }[] = [
  { value: 'readonly', label: '只读', hint: '只能读取文件' },
  { value: 'workspace', label: '项目空间', hint: '可写工作目录' },
  { value: 'full', label: '完全访问', hint: '无路径限制' }
];

function normalizeThinkingLevel(raw: string): ThinkingLevel {
  if (raw === 'off' || raw === 'minimal' || raw === 'low') return 'off';
  if (raw === 'high' || raw === 'xhigh' || raw === 'max') return 'high';
  return 'medium';
}

export function ChatInput() {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showThinkingPicker, setShowThinkingPicker] = useState(false);
  const [showSecurityPicker, setShowSecurityPicker] = useState(false);
  const [showCommandPicker, setShowCommandPicker] = useState(false);
  const [commandHighlight, setCommandHighlight] = useState(0);
  const [commands, setCommands] = useState<SlashCommandInfo[]>([]);
  const [securityLevel, setSecurityLevel] = useState<SecurityLevel>('workspace');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const thinkingPickerRef = useRef<HTMLDivElement>(null);
  const securityPickerRef = useRef<HTMLDivElement>(null);
  const slashMenuRef = useRef<HTMLDivElement>(null);
  const commandPickerRef = useRef<HTMLDivElement>(null);
  const ipc = useIpcRenderer();

  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const status = useChatStore((s) => s.status);
  const setLoading = useChatStore((s) => s.setLoading);
  const setError = useChatStore((s) => s.setError);
  const setActiveSession = useChatStore((s) => s.setActiveSession);
  const setMessages = useChatStore((s) => s.setMessages);
  const addSystemMessage = useChatStore((s) => s.addSystemMessage);
  const currentWorkspace = useSessionStore((s) => s.currentWorkspace);
  const setCurrentWorkspace = useSessionStore((s) => s.setCurrentWorkspace);
  const setSessions = useSessionStore((s) => s.setSessions);

  const models = useSettingsStore((s) => s.models);
  const activeModelId = useSettingsStore((s) => s.activeModelId);
  const setActiveModel = useSettingsStore((s) => s.setActiveModel);
  const settings = useSettingsStore((s) => s.settings);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  const activeModel = models.find((m) => m.id === activeModelId);
  const thinkingLevel = settings ? normalizeThinkingLevel(settings.defaultThinkingLevel) : 'medium';
  const isBusy = status.state !== 'idle' && status.state !== 'error';
  const canSend = input.trim().length > 0 && !isBusy;

  // Load commands on mount
  useEffect(() => {
    ipc.agent.listCommands().then(setCommands).catch(() => {});
  }, [ipc]);

  // Load current security level
  useEffect(() => {
    window.electronAPI.security.get().then((s) => {
      setSecurityLevel(s.level);
    }).catch(() => {});
  }, []);

  // Filter commands based on input (for slash command completion)
  const filteredCommands = useMemo(() => {
    if (!input.startsWith('/')) return [];
    const query = input.slice(1).toLowerCase();
    return commands.filter((cmd) =>
      cmd.name.toLowerCase().startsWith(query) ||
      cmd.description.toLowerCase().includes(query)
    );
  }, [input, commands]);

  const showSlashMenu = input.startsWith('/') && filteredCommands.length > 0;

  // Auto-close pickers on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (modelPickerRef.current && !modelPickerRef.current.contains(target)) setShowModelPicker(false);
      if (thinkingPickerRef.current && !thinkingPickerRef.current.contains(target)) setShowThinkingPicker(false);
      if (securityPickerRef.current && !securityPickerRef.current.contains(target)) setShowSecurityPicker(false);
      if (commandPickerRef.current && !commandPickerRef.current.contains(target)) setShowCommandPicker(false);
      if (slashMenuRef.current && !slashMenuRef.current.contains(target) &&
          !textareaRef.current?.contains(target)) {
        // slash menu 关闭由输入内容变化自然控制，这里不强制关
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reset command highlight when filter changes
  useEffect(() => {
    setCommandHighlight(0);
  }, [filteredCommands.length]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSelectModel = async (id: string) => {
    if (id === activeModelId) {
      setShowModelPicker(false);
      return;
    }
    await setActiveModel(id);
    setShowModelPicker(false);
  };

  const handleSelectThinking = async (level: ThinkingLevel) => {
    try {
      await ipc.agent.setThinkingLevel(level);
      await loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setShowThinkingPicker(false);
  };

  const handleSelectSecurity = async (level: SecurityLevel) => {
    try {
      const applied = await window.electronAPI.security.setLevel(level);
      setSecurityLevel(applied);
      await loadSettings();
      addSystemMessage('安全级别已切换，将应用于新对话');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setShowSecurityPicker(false);
  };

  // Handle file selection from the + button
  const handleAddFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    addFiles(Array.from(files));
    e.target.value = '';
  };

  const addFiles = (files: File[]) => {
    const newAttachments: Attachment[] = files.map((f) => ({
      name: f.name,
      path: (f as any).path || f.name,
      size: f.size,
      type: f.type || 'application/octet-stream'
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      addFiles(Array.from(files));
    }
  };

  // Execute a built-in command
  const executeCommand = useCallback(async (cmd: SlashCommandInfo, arg: string) => {
    const argStr = arg.trim();
    switch (cmd.name) {
      case '/compact':
        try {
          await ipc.agent.compactContext();
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
        break;
      case '/thinking':
        if (argStr) {
          const level = argStr as ThinkingLevel;
          if (['off', 'medium', 'high'].includes(level)) {
            try {
              await ipc.agent.setThinkingLevel(level);
              await loadSettings();
              addSystemMessage(`思考深度已切换为：${THINKING_OPTIONS.find(o => o.value === level)?.label || level}`);
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
            }
          }
        }
        break;
      case '/clear':
        useChatStore.getState().clear();
        addSystemMessage('会话已清空');
        break;
      default:
        // Not a built-in command with special handling — just send it as text
        return false;
    }
    return true;
  }, [ipc, loadSettings, addSystemMessage, setError]);

  const handleSend = async () => {
    if (!canSend && attachments.length === 0) return;

    const content = input.trim();

    // Check if it's a slash command
    if (content.startsWith('/') && !content.startsWith('//')) {
      const spaceIdx = content.indexOf(' ');
      const cmdName = spaceIdx > 0 ? content.slice(0, spaceIdx) : content;
      const arg = spaceIdx > 0 ? content.slice(spaceIdx + 1) : '';
      const cmd = commands.find((c) => c.name === cmdName);
      if (cmd && cmd.isBuiltin) {
        setInput('');
        await executeCommand(cmd, arg);
        return;
      }
    }

    if (!content && attachments.length === 0) return;

    setInput('');
    setLoading(true);
    setError(null);

    try {
      if (!activeSessionId) {
        const workspace = currentWorkspace ?? (await ipc.workspace.getDefault());
        if (!currentWorkspace) setCurrentWorkspace(workspace);

        const sessionId = await ipc.agent.newSession(workspace.path);
        setActiveSession(sessionId);
        setMessages([]);
        ipc.agent.listSessions().then(setSessions).catch(() => {});
      }

      await ipc.agent.sendMessage(content || '(附件)', attachments);
      setAttachments([]);
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
      // 尽力而为
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSlashMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCommandHighlight((i) => (i + 1) % filteredCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCommandHighlight((i) => (i - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = filteredCommands[commandHighlight];
        if (cmd) {
          // Fill the command name (with space for argument input)
          setInput(cmd.name + ' ');
          setCommandHighlight(0);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setInput('');
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const cmd = filteredCommands[commandHighlight];
        if (cmd) {
          setInput(cmd.name + ' ');
          setCommandHighlight(0);
        }
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const currentThinking = THINKING_OPTIONS.find((o) => o.value === thinkingLevel);
  const currentSecurity = SECURITY_OPTIONS.find((o) => o.value === securityLevel);

  return (
    <div
      className="border-t border-border/60 bg-background/80 backdrop-blur-sm p-4"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="mx-auto max-w-3xl">
        {/* Attachments bar */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 px-1">
            {attachments.map((att, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/30 border border-border/40 text-xs text-foreground/80"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="max-w-[160px] truncate">{att.name}</span>
                <button
                  onClick={() => removeAttachment(i)}
                  className="ml-0.5 text-muted-foreground hover:text-foreground"
                  title="移除"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-2xl border border-border/60 bg-chat-assistant shadow-sm relative">
          {/* Slash command menu */}
          {showSlashMenu && (
            <div
              ref={slashMenuRef}
              className="absolute z-50 w-80 max-h-64 overflow-y-auto bg-card border border-border/60 rounded-xl shadow-lifted py-1"
              style={{ bottom: 'calc(100% + 8px)', left: 12 }}
            >
              {filteredCommands.map((cmd, i) => (
                <button
                  key={cmd.name}
                  onMouseEnter={() => setCommandHighlight(i)}
                  onClick={() => {
                    setInput(cmd.name + ' ');
                    textareaRef.current?.focus();
                  }}
                  className={`w-full flex items-start gap-2.5 px-3 py-2 text-left text-xs transition-colors ${
                    i === commandHighlight
                      ? 'bg-accent/60 text-foreground'
                      : 'text-foreground/80 hover:bg-accent/40'
                  }`}
                >
                  <span className="shrink-0 text-base leading-5 w-6 text-center">
                    {cmd.icon || '✨'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{cmd.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {cmd.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="说点什么...（输入 / 查看命令）"
            rows={1}
            className="w-full resize-none bg-transparent px-5 pt-4 pb-2 text-sm outline-none placeholder:text-muted-foreground/60 text-foreground"
          />
          <div className="flex items-center justify-between px-3 pb-3">
            <div className="flex items-center gap-1">
              {/* Add file button */}
              <button
                onClick={handleAddFile}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                title="添加文件"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </button>

              {/* Tools / commands button */}
              <div className="relative" ref={commandPickerRef}>
                <button
                  onClick={() => setShowCommandPicker(!showCommandPicker)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                    showCommandPicker
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                  title="命令 / 工具"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z" strokeLinejoin="round" />
                  </svg>
                </button>

                {showCommandPicker && (
                  <div className="absolute bottom-full left-0 mb-1 z-50 w-72 max-h-72 overflow-y-auto bg-card border border-border/60 rounded-xl shadow-lifted py-1">
                    <div className="px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      命令面板
                    </div>
                    {commands.map((cmd) => (
                      <button
                        key={cmd.name}
                        onClick={() => {
                          setInput(cmd.name + ' ');
                          setShowCommandPicker(false);
                          textareaRef.current?.focus();
                        }}
                        className="w-full flex items-start gap-2.5 px-3 py-2 text-left text-xs text-foreground/80 hover:bg-accent/40 transition-colors"
                      >
                        <span className="shrink-0 text-base leading-5 w-6 text-center">
                          {cmd.icon || '✨'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{cmd.name}</div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {cmd.description}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Security level button */}
              <div className="relative" ref={securityPickerRef}>
                <button
                  onClick={() => setShowSecurityPicker(!showSecurityPicker)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                    securityLevel === 'readonly'
                      ? 'text-emerald-500 hover:bg-emerald-500/10'
                      : securityLevel === 'full'
                      ? 'text-amber-500 hover:bg-amber-500/10'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                  title={`安全模式：${currentSecurity?.label || ''}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinejoin="round" />
                  </svg>
                </button>

                {showSecurityPicker && (
                  <div className="absolute bottom-full left-0 mb-1 z-50 min-w-[180px] bg-card border border-border/60 rounded-xl shadow-lifted py-1">
                    <div className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      安全级别
                    </div>
                    {SECURITY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleSelectSecurity(opt.value)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                          opt.value === securityLevel
                            ? 'bg-accent/60 text-foreground'
                            : 'text-foreground/80 hover:bg-accent/40'
                        }`}
                      >
                        <span className="font-medium">{opt.label}</span>
                        <span className="text-[10px] text-muted-foreground">{opt.hint}</span>
                      </button>
                    ))}
                    <div className="px-3 py-1.5 border-t border-border/30 text-[10px] text-muted-foreground">
                      更改将在新对话生效
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Thinking level button */}
              <div className="relative" ref={thinkingPickerRef}>
                <button
                  onClick={() => setShowThinkingPicker(!showThinkingPicker)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                    thinkingLevel === 'off'
                      ? 'text-muted-foreground/50 hover:bg-accent hover:text-muted-foreground'
                      : thinkingLevel === 'high'
                      ? 'text-[#5B7FA6] hover:bg-[#5B7FA6]/10'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                  title={`思考深度：${currentThinking?.label || ''}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {showThinkingPicker && (
                  <div className="absolute bottom-full right-0 mb-1 z-50 min-w-[180px] bg-card border border-border/60 rounded-xl shadow-lifted py-1">
                    <div className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      思考深度
                    </div>
                    {THINKING_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleSelectThinking(opt.value)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                          opt.value === thinkingLevel
                            ? 'bg-accent/60 text-foreground'
                            : 'text-foreground/80 hover:bg-accent/40'
                        }`}
                      >
                        <span className="font-medium">{opt.label}</span>
                        <span className="text-[10px] text-muted-foreground">{opt.hint}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Model picker */}
              <div className="relative" ref={modelPickerRef}>
                <button
                  onClick={() => setShowModelPicker(!showModelPicker)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors max-w-[180px]"
                  title={activeModel ? `当前模型：${activeModel.name}` : '选择模型'}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" strokeLinecap="round" />
                  </svg>
                  <span className="truncate">
                    {activeModel ? activeModel.name : '请选择模型'}
                  </span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="shrink-0 transition-transform"
                    style={{ transform: showModelPicker ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  >
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {showModelPicker && (
                  <div className="absolute bottom-full left-0 mb-1 z-50 min-w-[200px] max-h-60 overflow-y-auto bg-card border border-border/60 rounded-xl shadow-lifted py-1">
                    {models.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        暂无模型，请在设置中添加
                      </div>
                    ) : (
                      models.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => handleSelectModel(model.id)}
                          className={`w-full flex flex-col items-start gap-0.5 px-3 py-2 text-left text-xs transition-colors ${
                            model.id === activeModelId
                              ? 'bg-accent/60 text-foreground'
                              : 'text-foreground/80 hover:bg-accent/40'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 w-full">
                            <span className="font-medium truncate flex-1">{model.name}</span>
                            {model.id === activeModelId && (
                              <span className="text-[10px] text-primary shrink-0">当前</span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground truncate w-full">
                            {providerLabels[model.provider]} · {model.model}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {isBusy ? (
                <button
                  onClick={handleAbort}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-red-500/15 text-red-500 text-sm hover:bg-red-500/25 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="6" y="6" width="12" height="12" rx="1" />
                  </svg>
                  停止
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!canSend && attachments.length === 0}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#5B7FA6] text-white text-sm hover:bg-[#4A6D91] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  发送
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
