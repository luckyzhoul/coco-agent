import React, { useState, useRef, useEffect } from 'react';
import { useIpcRenderer } from '../../hooks/useIpcRenderer';
import { useChatStore } from '../../stores/useChatStore';

export function ChatInput() {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ipc = useIpcRenderer();

  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const status = useChatStore((s) => s.status);
  const setLoading = useChatStore((s) => s.setLoading);
  const setError = useChatStore((s) => s.setError);

  const isBusy = status.state !== 'idle' && status.state !== 'error';
  const canSend = input.trim().length > 0 && !!activeSessionId && !isBusy;

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
    <div className="shrink-0 px-4 pb-4 pt-2">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-2 rounded-xl border border-border bg-card shadow-soft transition-shadow focus-within:shadow-lifted">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={activeSessionId ? '说点什么…' : '先新建一个会话'}
            disabled={!activeSessionId}
            rows={1}
            className="min-h-[2.5rem] flex-1 resize-none bg-transparent px-3.5 py-2.5 text-[13.5px] outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
          />
          {isBusy ? (
            <button
              onClick={handleAbort}
              className="mb-2 mr-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/20"
            >
              停止
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="mb-2 mr-2 rounded-lg bg-primary px-3.5 py-1.5 text-xs text-primary-foreground transition-opacity enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              发送
            </button>
          )}
        </div>
        <div className="mt-1.5 px-1 text-[11px] text-muted-foreground/60">
          Enter 发送，Shift + Enter 换行
        </div>
      </div>
    </div>
  );
}
