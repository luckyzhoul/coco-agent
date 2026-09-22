import React, { useEffect, useRef } from 'react';
import type { Message } from '@shared/types';
import { MessageBubble } from './MessageBubble';
import { useSessionStore } from '../../stores/useSessionStore';

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
  const currentWorkspace = useSessionStore((s) => s.currentWorkspace);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center text-center px-8">
          <div className="w-24 h-24 rounded-full bg-card border border-border/60 flex items-center justify-center mb-5 shadow-sm">
            <div
              className="w-20 h-20 rounded-full bg-[#3D5A80] flex items-center justify-center text-3xl"
              style={{
                background: 'linear-gradient(135deg, #5B7FA6 0%, #3D5A80 100%)'
              }}
            >
              <span className="text-white/90">✦</span>
            </div>
          </div>

          <h2 className="text-xl font-medium text-foreground mb-2">
            想到什么就说什么吧～
          </h2>

          {currentWorkspace && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
              </svg>
              <span>工作台：{currentWorkspace.name}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M7 17L17 7M17 7H9M17 7v8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}

          <div className="flex items-center gap-3 text-sm text-muted-foreground/70">
            <span className="flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z" strokeLinejoin="round" />
              </svg>
              记忆
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-5">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-chat-assistant border border-border/50 px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-sm text-muted-foreground">思考中...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
