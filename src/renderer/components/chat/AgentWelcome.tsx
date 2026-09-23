import React, { useEffect, useRef } from 'react';
import { useAgentStore } from '../../stores/useAgentStore';
import { useSessionStore } from '../../stores/useSessionStore';
import { useSpaceStore } from '../../stores/useSpaceStore';
import { AgentAvatar } from './AgentAvatar';

export function AgentWelcome() {
  const agents = useAgentStore((s) => s.agents);
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const loadAgents = useAgentStore((s) => s.loadAgents);
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent);
  const currentWorkspace = useSessionStore((s) => s.currentWorkspace);
  const switchSpace = useSpaceStore((s) => s.switchSpace);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeAgent = agents.find((a) => a.id === activeAgentId) ?? agents[0] ?? null;

  useEffect(() => {
    if (agents.length === 0) {
      loadAgents();
    }
  }, [agents.length, loadAgents]);

  useEffect(() => {
    if (!activeAgentId || !scrollRef.current) return;
    const activeEl = scrollRef.current.querySelector(`[data-agent-id="${activeAgentId}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' });
    }
  }, [activeAgentId]);

  const handleSelectAgent = async (id: string) => {
    if (id === activeAgentId) return;
    await setActiveAgent(id);
  };

  if (!activeAgent) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground">加载中…</div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center text-center px-8 w-full max-w-md">
        {/* 大头像 */}
        <div className="w-28 h-28 rounded-full bg-card border border-border/60 flex items-center justify-center mb-5 shadow-sm">
          <AgentAvatar
            name={activeAgent.name}
            agentId={activeAgent.id}
            icon={activeAgent.icon}
            size="xl"
          />
        </div>

        {/* 欢迎语 */}
        <h2 className="text-xl font-medium text-foreground mb-1">
          要做什么，交给 {activeAgent.name} 吧
        </h2>

        {/* Agent 胶囊选择器 */}
        {agents.length > 1 && (
          <div
            ref={scrollRef}
            className="mb-5 flex w-full justify-center overflow-x-auto scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <div className="flex w-max items-center justify-center gap-2 px-1 pb-1">
              {agents.map((agent) => {
                const isActive = agent.id === activeAgentId;
                return (
                  <button
                    key={agent.id}
                    data-agent-id={agent.id}
                    onClick={() => handleSelectAgent(agent.id)}
                    title={agent.name}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-all whitespace-nowrap ${
                      isActive
                        ? 'border-primary/50 bg-primary/10 text-foreground font-medium shadow-sm'
                        : 'border-border/60 bg-card/50 text-foreground/70 hover:bg-accent/40 hover:text-foreground'
                    }`}
                  >
                    <AgentAvatar
                      name={agent.name}
                      agentId={agent.id}
                      icon={agent.icon}
                      size="sm"
                    />
                    <span className="truncate max-w-[100px]">{agent.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 工作台按钮 */}
        <button
          onClick={switchSpace}
          title={currentWorkspace?.path ?? '选择工作台目录'}
          className="mb-6 flex items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
          </svg>
          <span>工作台：{currentWorkspace?.name ?? '未选择'}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M7 17L17 7M17 7H9M17 7v8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* 记忆标签 */}
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
