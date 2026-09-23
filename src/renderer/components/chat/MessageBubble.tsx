import React, { useState } from 'react';
import type { Message, TextPart } from '@shared/types';
import { PartRenderer } from './message-parts';
import { useAgentStore } from '../../stores/useAgentStore';
import { useChatStore } from '../../stores/useChatStore';
import { useIpcRenderer } from '../../hooks/useIpcRenderer';
import { RefreshCwIcon, CopyIcon, CheckIcon } from '../layout/icons';
import { AgentAvatar } from './AgentAvatar';

// Note: the turn summary pill was replaced by the per-message action bar.

interface MessageBubbleProps {
  message: Message;
  isLast?: boolean;
}

/** 提取一条助手消息的可复制文本（只取 text part） */
function extractText(message: Message): string {
  const textParts = (message.parts || []).filter(
    (p): p is TextPart => p.type === 'text'
  );
  if (textParts.length > 0) {
    return textParts.map((p) => p.content).join('\n\n');
  }
  return message.content || '';
}

/** 助手消息底部操作栏：时间 / 重新生成 / 复制 */
function MessageActions({ message, canRegenerate }: { message: Message; canRegenerate: boolean }) {
  const ipc = useIpcRenderer();
  const setError = useChatStore((s) => s.setError);
  const removeTrailingAssistantMessages = useChatStore(
    (s) => s.removeTrailingAssistantMessages
  );
  const status = useChatStore((s) => s.status);
  const [copied, setCopied] = useState(false);
  const isBusy = status.state !== 'idle' && status.state !== 'error';

  const time = new Date(message.timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(extractText(message));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('复制失败');
    }
  };

  const handleRegenerate = async () => {
    if (isBusy) return;
    try {
      removeTrailingAssistantMessages();
      await ipc.agent.regenerate();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="mt-1.5 flex items-center gap-0.5 text-muted-foreground/55">
      <span className="mr-1 text-[11px] tabular-nums">{time}</span>
      {canRegenerate && (
        <button
          onClick={handleRegenerate}
          disabled={isBusy}
          title="重新生成"
          className="p-1.5 rounded-md transition-colors hover:bg-muted/50 hover:text-foreground/70 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RefreshCwIcon />
        </button>
      )}
      <button
        onClick={handleCopy}
        title={copied ? '已复制' : '复制'}
        className="p-1.5 rounded-md transition-colors hover:bg-muted/50 hover:text-foreground/70"
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </div>
  );
}

export function MessageBubble({ message, isLast }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const activeAgent = useAgentStore((s) =>
    s.agents.find((a) => a.id === s.activeAgentId)
  );
  const agentName = activeAgent?.name || 'CocoAgent';

  if (isUser) {
    return (
      <div className="flex w-full justify-end">
        <div className="max-w-[80%] rounded-2xl px-4 py-3 shadow-sm bg-chat-user text-foreground">
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  const hasParts = message.parts && message.parts.length > 0;
  const isEmpty = !hasParts && !message.content?.trim();

  return (
    <div className="flex w-full justify-start gap-3">
      <div className="pt-1">
        <AgentAvatar
          name={agentName}
          agentId={activeAgent?.id ?? 'main'}
          icon={activeAgent?.icon}
          size="lg"
        />
      </div>
      <div className="flex-1 min-w-0 max-w-[calc(100%-3.5rem)]">
        <div className="mb-1 text-xs font-medium text-[#5B7FA6]">
          {agentName}
        </div>

        {isEmpty && (
          <div className="flex items-center gap-2 py-1">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-sm text-muted-foreground">思考中...</span>
          </div>
        )}

        {hasParts && (
          <div className="space-y-1.5">
            {message.parts!.map((part) => (
              <PartRenderer key={part.id} part={part} />
            ))}
          </div>
        )}

        {!hasParts && message.content && (
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {message.content}
          </div>
        )}

        {!isEmpty && (
          <MessageActions message={message} canRegenerate={!!isLast} />
        )}
      </div>
    </div>
  );
}
