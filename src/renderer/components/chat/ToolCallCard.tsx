import React, { useState } from 'react';
import type { ToolCall } from '@shared/types';

interface ToolCallCardProps {
  toolCall: ToolCall;
}

const statusColors: Record<ToolCall['status'], string> = {
  pending: 'text-muted-foreground',
  running: 'text-blue-400',
  success: 'text-green-400',
  error: 'text-red-400'
};

const statusIcons: Record<ToolCall['status'], string> = {
  pending: '⏳',
  running: '⚙️',
  success: '✓',
  error: '✕'
};

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);

  const hasOutput = toolCall.output && toolCall.output.length > 0;

  return (
    <div className="my-2 rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent/50 transition-colors text-left"
      >
        <span className={statusColors[toolCall.status]}>
          {statusIcons[toolCall.status]}
        </span>
        <span className="font-mono text-xs text-muted-foreground">tool</span>
        <span className="font-medium">{toolCall.name}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border px-3 py-2">
          <div className="mb-2">
            <span className="text-xs text-muted-foreground">Input:</span>
            <pre className="mt-1 max-h-32 overflow-auto rounded bg-background p-2 text-xs font-mono">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>

          {hasOutput && (
            <div>
              <span className="text-xs text-muted-foreground">Output:</span>
              <pre className="mt-1 max-h-64 overflow-auto rounded bg-background p-2 text-xs font-mono whitespace-pre-wrap">
                {toolCall.output}
              </pre>
            </div>
          )}

          {toolCall.error && (
            <div className="text-red-400 text-sm">
              Error: {toolCall.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
