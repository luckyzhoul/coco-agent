import React, { useState } from 'react';
import type { ThinkingPart as ThinkingPartType } from '@shared/types';

interface ThinkingPartProps {
  part: ThinkingPartType;
}

export function ThinkingPart({ part }: ThinkingPartProps) {
  const [expanded, setExpanded] = useState(false);
  const isGenerating = part.state === 'generating';
  const hasContent = part.content && part.content.length > 0;

  // If no content and not generating, render nothing
  if (!hasContent && !isGenerating) return null;

  return (
    <div className="py-0.5">
      <button
        onClick={() => hasContent && setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors"
        disabled={!hasContent}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="font-medium">
          {isGenerating ? '思考中...' : '思考完成'}
        </span>
        {isGenerating && (
          <span className="flex gap-0.5 ml-0.5">
            <span className="w-1 h-1 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1 h-1 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1 h-1 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        )}
      </button>
      {expanded && hasContent && (
        <div className="mt-1 pl-3.5 text-xs text-muted-foreground/60 whitespace-pre-wrap border-l border-border/40 ml-1.5">
          {part.content}
          {isGenerating && (
            <span className="inline-block w-0.5 h-3 ml-0.5 bg-muted-foreground/30 align-[-2px] animate-pulse" />
          )}
        </div>
      )}
    </div>
  );
}
