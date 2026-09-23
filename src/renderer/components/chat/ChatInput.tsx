import React, { useState, useRef, useEffect } from 'react';
import { useIpcRenderer } from '../../hooks/useIpcRenderer';
import { useChatStore } from '../../stores/useChatStore';
import { useSessionStore } from '../../stores/useSessionStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import type { ModelProvider } from '@shared/types';

const providerLabels: Record<ModelProvider, string> = {
  'openai-compatible': 'OpenAI 兼容',
  'anthropic': 'Anthropic',
  'ollama': 'Ollama（本地）',
  'ark': 'Ark（豆包）'
};

export function ChatInput() {
  const [input, setInput] = useState('');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const ipc = useIpcRenderer();

  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const status = useChatStore((s) => s.status);
  const setLoading = useChatStore((s) => s.setLoading);
  const setError = useChatStore((s) => s.setError);
  const setActiveSession = useChatStore((s) => s.setActiveSession);
  const setMessages = useChatStore((s) => s.setMessages);
  const currentWorkspace = useSessionStore((s) => s.currentWorkspace);
  const setCurrentWorkspace = useSessionStore((s) => s.setCurrentWorkspace);
  const setSessions = useSessionStore((s) => s.setSessions);

  const models = useSettingsStore((s) => s.models);
  const activeModelId = useSettingsStore((s) => s.activeModelId);
  const setActiveModel = useSettingsStore((s) => s.setActiveModel);

  const activeModel = models.find((m) => m.id === activeModelId);

  useEffect(() => {
    if (!showModelPicker) return;
    const handler = (e: MouseEvent) => {
      if (
        modelPickerRef.current &&
        !modelPickerRef.current.contains(e.target as Node)
      ) {
        setShowModelPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showModelPicker]);

  const handleSelectModel = async (id: string) => {
    if (id === activeModelId) {
      setShowModelPicker(false);
      return;
    }
    await setActiveModel(id);
    setShowModelPicker(false);
  };

  const isBusy = status.state !== 'idle' && status.state !== 'error';
  const canSend = input.trim().length > 0 && !isBusy;

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
      // 打开应用默认是新对话状态（无会话也可输入）：首条消息发出时才真正创建会话。
      if (!activeSessionId) {
        // 新会话默认落在当前项目空间；没有就退回默认空间（~/Desktop/CocoSpace）。
        const workspace = currentWorkspace ?? (await ipc.workspace.getDefault());
        if (!currentWorkspace) setCurrentWorkspace(workspace);

        const sessionId = await ipc.agent.newSession(workspace.path);
        setActiveSession(sessionId);
        setMessages([]);
        ipc.agent.listSessions().then(setSessions).catch(() => {});
      }

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
      // 尽力而为
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-border/60 bg-background/80 backdrop-blur-sm p-4">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-border/60 bg-chat-assistant shadow-sm overflow-hidden">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="试试 /rc，在手机上操作你的电脑"
            rows={1}
            className="w-full resize-none bg-transparent px-5 pt-4 pb-2 text-sm outline-none placeholder:text-muted-foreground/60 text-foreground"
          />
          <div className="flex items-center justify-between px-3 pb-3">
            <div className="flex items-center gap-1">
              <button
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                title="添加文件"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </button>
              <button
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                title="工具"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                title="安全模式"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-2">
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
                  disabled={!canSend}
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
