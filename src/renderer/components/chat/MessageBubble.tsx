import React from 'react';
import type { Message } from '@shared/types';
import { PartRenderer } from './message-parts';
import { useAgentStore } from '../../stores/useAgentStore';

// Note: TurnSummaryBar was replaced by SummaryPart (a message part type)

interface MessageBubbleProps {
  message: Message;
}

function Avatar({ name }: { name: string }) {
  const initial = name?.charAt(0)?.toUpperCase() || '?';
  return (
    <div
      className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-sm"
      style={{
        background: 'linear-gradient(135deg, #5B7FA6 0%, #3D5A80 100%)'
      }}
    >
      {initial}
    </div>
  );
}

export function MessageBubble({ message }: MessageBubbleProps) {
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
        <Avatar name={agentName} />
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
      </div>
    </div>
  );
}
