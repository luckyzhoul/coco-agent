import React, { useState } from 'react';
import type { ToolCall } from '@shared/types';

interface ToolCallCardProps {
  toolCall: ToolCall;
}

const statusColors: Record<ToolCall['status'], string> = {
  pending: 'text-muted-foreground',
  running: 'text-primary',
  success: 'text-emerald-600',
  error: 'text-destructive'
};

const statusLabels: Record<ToolCall['status'], string> = {
  pending: '等待',
  running: '执行中',
  success: '完成',
  error: '失败'
};

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);

  const hasOutput = toolCall.output && toolCall.output.length > 0;

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-border bg-card/60">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent/50"
      >
        <span className={`shrink-0 ${statusColors[toolCall.status]}`}>
          {statusLabels[toolCall.status]}
        </span>
        <span className="truncate font-medium text-foreground/90">{toolCall.name}</span>
        <span className="ml-auto shrink-0 text-muted-foreground/60">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t border-border px-3 py-2">
          <div className="mb-2">
            <span className="text-[11px] text-muted-foreground">入参</span>
            <pre className="mt-1 max-h-32 overflow-auto rounded bg-background/70 p-2 font-mono text-[11px]">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>

          {hasOutput && (
            <div>
              <span className="text-[11px] text-muted-foreground">输出</span>
              <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-background/70 p-2 font-mono text-[11px]">
                {toolCall.output}
              </pre>
            </div>
          )}

          {toolCall.error && (
            <div className="mt-2 text-[11px] text-destructive">错误：{toolCall.error}</div>
          )}
        </div>
      )}
    </div>
  );
}
