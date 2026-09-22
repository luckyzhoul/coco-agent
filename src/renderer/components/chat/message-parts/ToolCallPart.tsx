import React, { useState } from 'react';
import type { ToolCallPart as ToolCallPartType } from '@shared/types';
import { useAgentStore } from '../../../stores/useAgentStore';

interface ToolCallPartProps {
  part: ToolCallPartType;
}

function getActionPhrase(category?: string, action?: string): string {
  switch (category) {
    case 'bash':
      return '用完电脑了';
    case 'file_write':
      return '落笔了';
    case 'file_read':
      return '翻看了';
    case 'search':
      return '检索了';
    case 'browser':
      return '浏览了网页';
    case 'computer':
      return '操作了一下';
    case 'mcp':
      return '调用了工具';
    default:
      return '用了工具';
  }
}

function getIcon(category?: string): React.ReactNode {
  switch (category) {
    case 'bash':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="18" rx="2" />
          <polyline points="7 10 10 13 7 16" />
          <line x1="13" y1="17" x2="17" y2="17" />
        </svg>
      );
    case 'file_write':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      );
    case 'file_read':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
    case 'browser':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    case 'search':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case 'computer':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      );
    default:
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
        </svg>
      );
  }
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'success') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (status === 'error') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    );
  }
  if (status === 'running') {
    return (
      <span className="w-3 h-3 rounded-full border-2 border-[#5B7FA6] border-t-transparent animate-spin" />
    );
  }
  return (
    <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40" />
  );
}

export function ToolCallPart({ part }: ToolCallPartProps) {
  const [expanded, setExpanded] = useState(false);
  const { toolCall } = part;
  const activeAgent = useAgentStore((s) =>
    s.agents.find((a) => a.id === s.activeAgentId)
  );
  const agentName = activeAgent?.name || 'CocoAgent';

  const preview = toolCall.inputPreview ||
    (typeof toolCall.input?.command === 'string' ? toolCall.input.command : '') ||
    (typeof toolCall.input?.path === 'string' ? toolCall.input.path : '') ||
    '';

  const hasOutput = toolCall.output && toolCall.output.length > 0;
  const phrase = getActionPhrase(toolCall.category);

  return (
    <div className="my-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2.5 px-3 py-1.5 rounded-lg bg-muted/25 hover:bg-muted/40 transition-colors text-left"
      >
        <span className="shrink-0 text-muted-foreground/80 flex items-center">
          {getIcon(toolCall.category)}
        </span>
        <span className="text-sm text-foreground/80 font-medium shrink-0">
          {agentName} {phrase}
        </span>
        <span className="flex-1 min-w-0 text-xs text-muted-foreground/70 truncate font-mono">
          {preview}
        </span>
        <span className="shrink-0 flex items-center">
          <StatusIcon status={toolCall.status} />
        </span>
      </button>

      {expanded && (
        <div className="mx-3 mt-1 mb-2 space-y-2">
          <div>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground/50">工具</span>
            <div className="text-xs text-foreground/80 font-mono">{toolCall.name}</div>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground/50">入参</span>
            <pre className="mt-0.5 max-h-40 overflow-auto rounded-md bg-background/60 p-2 font-mono text-[11px] leading-relaxed border border-border/30">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>
          {hasOutput && (
            <div>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground/50">输出</span>
              <pre className="mt-0.5 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-background/60 p-2 font-mono text-[11px] leading-relaxed border border-border/30">
                {toolCall.output}
              </pre>
            </div>
          )}
          {toolCall.error && (
            <div className="text-red-500 text-xs font-mono">
              Error: {toolCall.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
