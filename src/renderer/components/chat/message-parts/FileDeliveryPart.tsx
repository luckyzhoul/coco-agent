import React, { useState } from 'react';
import type { FileDeliveryPart as FileDeliveryPartType } from '@shared/types';
import { useIpcRenderer } from '../../../hooks/useIpcRenderer';

interface FileDeliveryPartProps {
  part: FileDeliveryPartType;
}

function formatSize(bytes?: number): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileFormat(fileName?: string): { lang: string; badge: string } {
  if (!fileName) return { lang: 'File', badge: 'FILE' };
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, { lang: string; badge: string }> = {
    ts: { lang: 'TypeScript', badge: 'TS' },
    tsx: { lang: 'TypeScript', badge: 'TSX' },
    js: { lang: 'JavaScript', badge: 'JS' },
    jsx: { lang: 'JavaScript', badge: 'JSX' },
    py: { lang: 'Python', badge: 'PY' },
    sh: { lang: 'Shell', badge: 'SH' },
    bash: { lang: 'Shell', badge: 'SH' },
    json: { lang: 'JSON', badge: 'JSON' },
    md: { lang: 'Markdown', badge: 'MD' },
    html: { lang: 'HTML', badge: 'HTML' },
    css: { lang: 'CSS', badge: 'CSS' },
    yaml: { lang: 'YAML', badge: 'YAML' },
    yml: { lang: 'YAML', badge: 'YAML' },
    go: { lang: 'Go', badge: 'GO' },
    rs: { lang: 'Rust', badge: 'RS' },
    java: { lang: 'Java', badge: 'JAVA' },
    rb: { lang: 'Ruby', badge: 'RB' },
    php: { lang: 'PHP', badge: 'PHP' },
    txt: { lang: 'Text', badge: 'TXT' }
  };
  return map[ext] || { lang: ext.toUpperCase() || 'File', badge: ext.toUpperCase() || 'FILE' };
}

export function FileDeliveryPart({ part }: FileDeliveryPartProps) {
  const ipc = useIpcRenderer();
  const [menuOpen, setMenuOpen] = useState(false);
  const format = getFileFormat(part.fileName);

  const handleOpen = () => {
    ipc.workspace.openInOS(part.filePath).catch(() => {});
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText(part.filePath).catch(() => {});
    setMenuOpen(false);
  };

  return (
    <div className="my-2 inline-block min-w-[280px] max-w-full">
      <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 px-4 py-3 hover:bg-card/80 transition-colors">
        <div className="shrink-0 flex items-center justify-center w-12 h-12 rounded-lg bg-muted/50 text-muted-foreground">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground truncate">
            {part.fileName}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <span>{format.lang}</span>
            <span className="text-border/60">·</span>
            <span className="px-1.5 py-0.5 rounded bg-muted/60 text-[10px] font-mono tracking-wide">
              {format.badge}
            </span>
            {part.fileSize != null && (
              <>
                <span className="text-border/60">·</span>
                <span>{formatSize(part.fileSize)}</span>
              </>
            )}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-1">
          <button
            onClick={handleOpen}
            className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
            title="打开文件"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
              title="更多操作"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 min-w-[140px] rounded-lg border border-border/50 bg-card shadow-lg py-1 text-xs">
                  <button
                    onClick={handleCopyPath}
                    className="w-full px-3 py-1.5 text-left hover:bg-muted/50 text-foreground/80"
                  >
                    复制路径
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
