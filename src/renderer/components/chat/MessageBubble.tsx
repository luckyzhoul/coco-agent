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
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-card text-card-foreground border border-border'
        }`}
      >
        {!isUser && (
          <div className="mb-1 text-xs font-semibold text-muted-foreground">
            CocoAgent
          </div>
        )}

        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {message.content || (
            <span className="text-muted-foreground italic">
              {message.toolCalls && message.toolCalls.length > 0
                ? 'Processing...'
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
