import React, { useEffect } from 'react';
import { useChatStore } from '../../stores/useChatStore';
import { useAgentEvent, useIpcRenderer } from '../../hooks/useIpcRenderer';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import type { Message, AgentStatus, ToolCall } from '@shared/types';

export function ChatPanel() {
  const ipc = useIpcRenderer();
  const messages = useChatStore((s) => s.messages);
  const status = useChatStore((s) => s.status);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const addMessage = useChatStore((s) => s.addMessage);
  const setStatus = useChatStore((s) => s.setStatus);
  const setError = useChatStore((s) => s.setError);
  const setMessages = useChatStore((s) => s.setMessages);
  const isLoading = useChatStore((s) => s.isLoading);
  const updateToolCall = useChatStore((s) => s.updateToolCall);
  const updateToolResult = useChatStore((s) => s.updateToolResult);

  useEffect(() => {
    if (activeSessionId) {
      ipc.agent.getSessionMessages(activeSessionId).then((msgs) => {
        setMessages(msgs);
      });
      ipc.agent.getStatus().then((s) => setStatus(s));
    }
  }, [activeSessionId, ipc, setMessages, setStatus]);

  useAgentEvent('agentMessage', (msg: Message) => {
    addMessage(msg);
  });

  useAgentEvent('agentStatus', (s: AgentStatus) => {
    setStatus(s);
  });

  useAgentEvent('agentError', (error: string) => {
    setError(error);
  });

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

  const isThinking =
    status.state === 'thinking' ||
    status.state === 'tool_calling' ||
    status.state === 'responding';

  return (
    <div className="flex h-full flex-col">
      <MessageList messages={messages} isLoading={isLoading || isLoading} />
      <ChatInput />
    </div>
  );
}
