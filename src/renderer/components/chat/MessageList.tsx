import React, { useEffect, useRef } from 'react';
import type { Message } from '@shared/types';
import { MessageBubble } from './MessageBubble';
import { useAgentStore } from '../../stores/useAgentStore';
import { useSessionStore } from '../../stores/useSessionStore';
import { useChatStore } from '../../stores/useChatStore';
import { useSpaceStore } from '../../stores/useSpaceStore';
import { FolderIcon, RefreshIcon } from '../space/icons';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

function Welcome() {
  const agents = useAgentStore((s) => s.agents);
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent);
  const currentWorkspace = useSessionStore((s) => s.currentWorkspace);
  const switchSpace = useSpaceStore((s) => s.switchSpace);
  const setActiveSession = useChatStore((s) => s.setActiveSession);
  const setMessages = useChatStore((s) => s.setMessages);

  const handleSwitchAgent = async (id: string) => {
    if (id === activeAgentId) return;
    await setActiveAgent(id);
    setActiveSession(null);
    setMessages([]);
  };

  const initial = (agents.find((a) => a.id === activeAgentId)?.name ?? 'C')[0];

  return (
    <div className="flex h-full flex-col items-center justify-center px-8">
      <div className="flex w-full max-w-md flex-col items-center">
        {/* 纸感圆形头像 */}
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-border bg-card shadow-soft">
          <span className="title-serif text-3xl text-primary/70">{initial}</span>
        </div>

        <h2 className="title-serif mb-6 text-xl tracking-wide text-foreground/85">
          想到什么就说什么吧～
        </h2>

        {/* 助手切换 */}
        {agents.length > 0 && (
          <div className="mb-4 flex flex-wrap justify-center gap-1.5">
            {agents.map((agent) => {
              const active = agent.id === activeAgentId;
              return (
                <button
                  key={agent.id}
                  onClick={() => handleSwitchAgent(agent.id)}
                  title={agent.description}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    active
                      ? 'border-primary/40 bg-primary/10 text-foreground'
                      : 'border-border text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  }`}
                >
                  {agent.name}
                </button>
              );
            })}
          </div>
        )}

        {/* 工作台（项目空间）：新建对话时在这里选目录 */}
        <div className="flex max-w-full items-center gap-1.5 text-[13px]">
          <FolderIcon className="h-4 w-4 shrink-0 text-muted-foreground/70" />
          <span className="shrink-0 text-muted-foreground">工作台：</span>
          <button
            onClick={switchSpace}
            title={currentWorkspace?.path ?? '选择项目空间目录'}
            className="min-w-0 truncate text-foreground/85 underline decoration-border decoration-dotted underline-offset-4 transition-colors hover:decoration-foreground/50"
          >
            {currentWorkspace?.name ?? '未选择'}
          </button>
          <button
            onClick={switchSpace}
            title="更换工作台目录"
            className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <RefreshIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground/70">
          新对话会绑定这个工作台，切换历史对话会跟着切回它自己的目录
          <br />
          右侧可以浏览、编辑该目录下的文件
        </p>
      </div>
    </div>
  );
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (messages.length === 0) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Welcome />
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-5">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <span className="inline-flex gap-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary/60" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary/40 [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary/25 [animation-delay:300ms]" />
            </span>
            思考中…
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
