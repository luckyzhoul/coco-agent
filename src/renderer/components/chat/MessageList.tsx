import React, { useEffect, useRef, useState } from 'react';
import type { Message } from '@shared/types';
import { MessageBubble } from './MessageBubble';
import { AgentWelcome } from './AgentWelcome';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  // Detect if user has scrolled up manually
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAutoScroll(distanceFromBottom < 50);
  };

  // Auto-scroll to bottom when messages change and auto-scroll is enabled
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, autoScroll]);

  // Scroll to bottom when switching sessions (new session, fresh start)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setAutoScroll(true);
    }
  }, [messages.length === 0]);

  if (messages.length === 0) {
    return <AgentWelcome />;
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 py-6"
    >
      <div className="mx-auto max-w-3xl space-y-5">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
