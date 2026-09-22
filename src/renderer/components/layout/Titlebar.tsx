import React, { useState, useEffect } from 'react';
import { useIpcRenderer } from '../../hooks/useIpcRenderer';
import { useUiStore } from '../../stores/useUiStore';
import { SidebarLeftIcon, SidebarRightIcon } from './icons';

const NO_DRAG = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

export function Titlebar() {
  const ipc = useIpcRenderer();
  const [isMaximized, setIsMaximized] = useState(false);

  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const spacePanelOpen = useUiStore((s) => s.spacePanelOpen);
  const toggleSpacePanel = useUiStore((s) => s.toggleSpacePanel);

  useEffect(() => {
    ipc.window.isMaximized().then(setIsMaximized);
  }, [ipc]);

  const handleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    ipc.window.minimize();
  };

  const handleToggleMaximize = (e: React.MouseEvent) => {
    e.stopPropagation();
    ipc.window.toggleMaximize().then(setIsMaximized);
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    ipc.window.close();
  };

  // Collapsed panels read as "off" rather than disabled — clicking brings them back.
  const panelToggleClass = (open: boolean) =>
    `flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
      open
        ? 'text-muted-foreground/70 hover:bg-accent/60 hover:text-foreground'
        : 'text-muted-foreground/35 hover:bg-accent/60 hover:text-foreground'
    }`;

  return (
    <div
      className="flex h-10 shrink-0 items-center justify-between px-4 select-none"
      style={{
        background: 'transparent',
        WebkitAppRegion: 'drag'
      } as React.CSSProperties}
    >
      {/* 左侧：会话侧边栏开关 */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleSidebar}
          className={panelToggleClass(sidebarOpen)}
          style={NO_DRAG}
          title={sidebarOpen ? '收起会话栏' : '展开会话栏'}
        >
          <SidebarLeftIcon />
        </button>
      </div>

      <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground/50">
        <button
          className="px-3 py-1 rounded-md text-muted-foreground/70 hover:bg-accent/50 hover:text-foreground transition-colors"
          style={NO_DRAG}
        >
          聊天
        </button>
        <button
          className="px-3 py-1 rounded-md text-muted-foreground/40 hover:bg-accent/30 hover:text-muted-foreground/70 transition-colors"
          style={NO_DRAG}
        >
          频道
        </button>
      </div>

      {/* 右侧：项目空间开关 + 窗口控制 */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleSpacePanel}
          className={panelToggleClass(spacePanelOpen)}
          style={NO_DRAG}
          title={spacePanelOpen ? '收起项目空间' : '展开项目空间'}
        >
          <SidebarRightIcon />
        </button>

        <div className="mx-1 h-4 w-px bg-border" />

        <button
          onClick={handleMinimize}
          className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground/50 hover:bg-accent/50 hover:text-foreground transition-colors"
          style={NO_DRAG}
          title="最小化"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="2" y1="6" x2="10" y2="6" strokeLinecap="round" />
          </svg>
        </button>
        <button
          onClick={handleToggleMaximize}
          className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground/50 hover:bg-accent/50 hover:text-foreground transition-colors"
          style={NO_DRAG}
          title={isMaximized ? '还原' : '最大化'}
        >
          {isMaximized ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3.5 2.5h4v4h-4z M5.5 5.5h4v4h-4z" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2.5" y="2.5" width="7" height="7" rx="0.5" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        <button
          onClick={handleClose}
          className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive transition-colors"
          style={NO_DRAG}
          title="关闭"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="3" y1="3" x2="9" y2="9" strokeLinecap="round" />
            <line x1="9" y1="3" x2="3" y2="9" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
