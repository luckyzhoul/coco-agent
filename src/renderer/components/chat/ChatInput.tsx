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
  const canSend = input.trim().length > 0 && activeSessionId && !isBusy;

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
      // Best effort
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-border bg-background p-4">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-2 rounded-lg border border-input bg-card">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={activeSessionId ? 'Type a message...' : 'Start a new session first'}
            disabled={!activeSessionId}
            rows={1}
            className="flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
          />
          {isBusy ? (
            <button
              onClick={handleAbort}
              className="mb-2 mr-2 rounded-md bg-red-500/20 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/30 transition-colors"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="mb-2 mr-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              Send
            </button>
          )}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}
