import { useCallback, useEffect, useRef } from 'react';

interface ResizeHandleProps {
  /** 拖拽条位于哪个面板一侧：left 面板拖拽条跟随鼠标 X；right 则用窗口宽减去鼠标 X。 */
  side: 'left' | 'right';
  /** clientX 已换算为「面板目标宽度」后回调。 */
  onResize: (width: number) => void;
  /** 双击恢复默认宽度。 */
  onReset: () => void;
}

/**
 * 面板与主内容之间的拖拽调宽条。纯视图行为：拖动期间全局接管 mousemove/mouseup，
 * 禁用文本选择并切换光标；无边框窗口下必须显式 no-drag（约定见 CLAUDE.md #16）。
 */
export function ResizeHandle({ side, onResize, onReset }: ResizeHandleProps) {
  const dragging = useRef(false);

  const handleMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging.current) return;
      const width =
        side === 'left' ? e.clientX : window.innerWidth - e.clientX;
      onResize(width);
    },
    [side, onResize]
  );

  const stopDrag = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', stopDrag);
    // 拖动中窗口失焦时 mouseup 可能丢失，兜底复位。
    window.addEventListener('blur', stopDrag);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', stopDrag);
      window.removeEventListener('blur', stopDrag);
    };
  }, [handleMove, stopDrag]);

  const startDrag = () => {
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div
      onMouseDown={startDrag}
      onDoubleClick={onReset}
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      className="group relative w-px shrink-0 cursor-col-resize bg-border/60 transition-colors hover:bg-primary/50"
      role="separator"
      aria-orientation="vertical"
    >
      {/* 加宽的透明热区，避免 1px 视觉线难以命中 */}
      <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
    </div>
  );
}
