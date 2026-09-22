import React from 'react';

export function Titlebar() {
  return (
    <div
      className="flex h-9 items-center border-b border-border bg-panel px-3"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="title-serif text-xs tracking-widest text-muted-foreground">CocoAgent</div>
    </div>
  );
}
