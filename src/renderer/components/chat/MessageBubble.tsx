import React from 'react';
import type { Message } from '@shared/types';
import { ToolCallCard } from './ToolCallCard';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  // 用户消息走气泡，助手消息直接落在纸面上（阅读感更好，也贴近参考稿）。
  if (!isUser) {
    return (
      <div className="w-full">
        <div className="mb-1.5 text-[11px] tracking-wider text-muted-foreground/70">助手</div>
        <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-foreground/90">
          {message.content || (
            <span className="italic text-muted-foreground/70">
              {message.toolCalls && message.toolCalls.length > 0 ? '处理中…' : ''}
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
    );
  }

  return (
    <div className="flex w-full justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground shadow-soft">
        <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{message.content}</div>
      </div>
    </div>
  );
}
