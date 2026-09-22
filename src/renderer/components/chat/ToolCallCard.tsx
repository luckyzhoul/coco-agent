import React, { useState } from 'react';
import type { ToolCall } from '@shared/types';
import { ChevronUpIcon, ChevronDownIcon } from '../layout/icons';

interface ToolCallCardProps {
  toolCall: ToolCall;
}

const statusColors: Record<ToolCall['status'], string> = {
  pending: 'text-muted-foreground',
  running: 'text-[#5B7FA6]',
  success: 'text-emerald-600',
  error: 'text-red-500'
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
    <div className="my-2 rounded-xl border border-border/50 bg-chat-assistant/60 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent/60 transition-colors text-left"
      >
        <span className={`shrink-0 ${statusColors[toolCall.status]}`}>
          {statusLabels[toolCall.status]}
        </span>
        <span className="truncate font-medium text-foreground/90">{toolCall.name}</span>
        <span className="ml-auto shrink-0 text-muted-foreground/60">
          {expanded ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
        </span>
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
            <div className="text-red-500 text-sm">
              Error: {toolCall.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
