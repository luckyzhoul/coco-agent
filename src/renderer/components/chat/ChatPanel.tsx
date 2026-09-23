import React, { useEffect, useRef } from 'react';
import { useChatStore } from '../../stores/useChatStore';
import { useAgentEvent, useIpcRenderer } from '../../hooks/useIpcRenderer';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { AlertIcon, CloseIcon } from '../layout/icons';
import type { Message, AgentStatus, ToolCall, TurnSummary } from '@shared/types';

export function ChatPanel() {
  const ipc = useIpcRenderer();
  const messages = useChatStore((s) => s.messages);
  const status = useChatStore((s) => s.status);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const addMessage = useChatStore((s) => s.addMessage);
  const setStatus = useChatStore((s) => s.setStatus);
  const error = useChatStore((s) => s.error);
  const setError = useChatStore((s) => s.setError);
  const setMessages = useChatStore((s) => s.setMessages);
  const isLoading = useChatStore((s) => s.isLoading);
  const updateToolCall = useChatStore((s) => s.updateToolCall);
  const updateToolResult = useChatStore((s) => s.updateToolResult);
  const appendTextDelta = useChatStore((s) => s.appendTextDelta);
  const appendThinkingDelta = useChatStore((s) => s.appendThinkingDelta);
  const addToolCallPart = useChatStore((s) => s.addToolCallPart);
  const updateToolCallPart = useChatStore((s) => s.updateToolCallPart);
  const addFileDelivery = useChatStore((s) => s.addFileDelivery);
  const addSummaryPart = useChatStore((s) => s.addSummaryPart);
  const finishMessage = useChatStore((s) => s.finishMessage);

  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    if (activeSessionId) {
      ipc.agent.getSessionMessages(activeSessionId).then((msgs) => {
        setMessages(msgs);
      });
      const currentSessionId = activeSessionId;
      ipc.agent.getStatus().then((s) => {
        if (s.sessionId !== currentSessionId) return;
        const cur = statusRef.current;
        if (cur.sessionId === s.sessionId && cur.state !== 'idle' && cur.state !== 'error') {
          return;
        }
        setStatus(s);
      });
    }
  }, [activeSessionId, ipc, setMessages, setStatus]);

  useAgentEvent('agentMessage', (msg: Message) => {
    addMessage(msg);
  });

  useAgentEvent('agentStatus', (s: AgentStatus) => {
    setStatus(s);
  });

  useAgentEvent('agentError', (err: string) => {
    setError(err);
  });

  // Legacy events (kept for backward compat)
  useAgentEvent('agentToolCall', (data) => {
    const typed = data as { toolCall: ToolCall; messageId: string };
    updateToolCall(typed.messageId, typed.toolCall);
  });

  useAgentEvent(
    'agentToolResult',
    (data: { toolCallId: string; output: string; status: string }) => {
      updateToolResult(data.toolCallId, data.output, data.status);
    }
  );

  // Streaming delta events
  useAgentEvent(
    'agentMessageDelta',
    (data: { messageId: string; partIndex: number; delta: string }) => {
      appendTextDelta(data.messageId, data.partIndex, data.delta);
    }
  );

  useAgentEvent(
    'agentThinkingDelta',
    (data: { messageId: string; partIndex: number; delta: string; state?: 'generating' | 'done' }) => {
      appendThinkingDelta(data.messageId, data.partIndex, data.delta, data.state);
    }
  );

  useAgentEvent(
    'agentToolCallDelta',
    (data: { messageId: string; partIndex: number; toolCall?: ToolCall; updates?: Partial<ToolCall> }) => {
      if (data.toolCall) {
        addToolCallPart(data.messageId, data.partIndex, data.toolCall);
      } else if (data.updates) {
        updateToolCallPart(data.messageId, data.partIndex, data.updates);
      }
    }
  );

  useAgentEvent(
    'agentFileDelivery',
    (data: { messageId: string; partIndex: number; file: { filePath: string; fileName: string; action: 'create' | 'edit'; fileSize?: number } }) => {
      addFileDelivery(data.messageId, data.partIndex, data.file);
    }
  );

  useAgentEvent('agentMessageEnd', (data: { messageId: string }) => {
    finishMessage(data.messageId);
  });

  useAgentEvent(
    'agentTurnEnd',
    (data: { messageId: string; partIndex: number; summary: TurnSummary }) => {
      addSummaryPart(data.messageId, data.partIndex, data.summary);
    }
  );

  return (
    <div className="flex h-full flex-col bg-background">
      <MessageList messages={messages} isLoading={isLoading} />

      {error && (
        <div className="mx-auto mb-1 flex w-full max-w-3xl items-start gap-2 px-4">
          <div className="flex min-w-0 flex-1 items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-[11.5px] text-destructive">
            <AlertIcon className="shrink-0 w-4 h-4 mt-[1px]" />
            <span className="min-w-0 flex-1 whitespace-pre-wrap">{error}</span>
            <button
              onClick={() => setError(null)}
              className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
              title="关闭"
            >
              <CloseIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <ChatInput />
    </div>
  );
}
