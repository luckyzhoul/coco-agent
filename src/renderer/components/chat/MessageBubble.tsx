import React from 'react';
import type { Message } from '@shared/types';
import { ToolCallCard } from './ToolCallCard';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
          isUser
            ? 'bg-chat-user text-foreground'
            : 'bg-chat-assistant text-foreground border border-border/50'
        }`}
      >
        {!isUser && (
          <div className="mb-1.5 text-xs font-medium text-[#5B7FA6]">
            CocoAgent
          </div>
        )}

        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {message.content || (
            <span className="text-muted-foreground italic">
              {message.toolCalls && message.toolCalls.length > 0
                ? '处理中...'
                : ''}
            </span>
          )}
        </div>

        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.toolCalls.map((tc) => (
              <ToolCallCard key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
