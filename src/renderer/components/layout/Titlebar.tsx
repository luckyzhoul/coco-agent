import React from 'react';

export function Titlebar() {
  return (
    <div
      className="h-9 border-b border-border bg-background flex items-center px-3"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="text-xs font-medium text-muted-foreground">
        CocoAgent
      </div>
    </div>
  );
}
