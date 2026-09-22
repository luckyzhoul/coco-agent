import React, { useState } from 'react';
import type { SummaryPart as SummaryPartType } from '@shared/types';

interface SummaryPartProps {
  part: SummaryPartType;
}

export function SummaryPart({ part }: SummaryPartProps) {
  const [expanded, setExpanded] = useState(false);
  const { summary } = part;
  const duration = summary.durationMs
    ? summary.durationMs >= 1000
      ? `${(summary.durationMs / 1000).toFixed(1)} 秒`
      : `${summary.durationMs} 毫秒`
    : null;

  return (
    <div className="my-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full bg-muted/30 hover:bg-muted/45 transition-colors text-xs text-muted-foreground"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-[#E8B86B]">
          <path d="M12 2l2.39 7.36H22l-6.2 4.51L18.18 21 12 16.49 5.82 21l2.38-7.13L2 9.36h7.61z" />
        </svg>
        <span className="font-medium text-foreground/70">{summary.agentName}</span>
        <span>忙活了一阵子</span>
        {summary.toolCount > 0 && (
          <>
            <span className="text-border/50">·</span>
            <span>{summary.toolCount} 个工具</span>
          </>
        )}
        {summary.thinkingCount > 0 && (
          <>
            <span className="text-border/50">·</span>
            <span>{summary.thinkingCount} 次思考</span>
          </>
        )}
        {duration && (
          <>
            <span className="text-border/50">·</span>
            <span>{duration}</span>
          </>
        )}
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
      </button>
    </div>
  );
}
