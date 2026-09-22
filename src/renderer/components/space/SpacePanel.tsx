import { useEffect } from 'react';
import { useSessionStore } from '../../stores/useSessionStore';
import { useSpaceStore } from '../../stores/useSpaceStore';
import { useUiStore } from '../../stores/useUiStore';
import { FileBrowser } from './FileBrowser';
import { FileViewer } from './FileViewer';
import { SpaceFooter } from './SpaceFooter';
import { ExternalIcon } from './icons';
import { SidebarRightIcon, RefreshCwIcon } from '../layout/icons';

export function SpacePanel() {
  const open = useUiStore((s) => s.spacePanelOpen);
  const setOpen = useUiStore((s) => s.setSpacePanelOpen);
  const root = useSpaceStore((s) => s.root);
  const setRoot = useSpaceStore((s) => s.setRoot);
  const error = useSpaceStore((s) => s.error);
  const tabs = useSpaceStore((s) => s.tabs);
  const refresh = useSpaceStore((s) => s.refresh);
  const switchSpace = useSpaceStore((s) => s.switchSpace);

  // The project space follows the session: whenever the bound workspace
  // changes (new session, session switch, manual switch) the panel re-roots.
  const currentWorkspace = useSessionStore((s) => s.currentWorkspace);
  const setCurrentWorkspace = useSessionStore((s) => s.setCurrentWorkspace);

  useEffect(() => {
    setRoot(currentWorkspace);
  }, [currentWorkspace, setRoot]);

  useEffect(() => {
    if (!currentWorkspace) {
      window.electronAPI.workspace.getCurrent().then((ws) => {
        if (ws) setCurrentWorkspace(ws);
      });
    }
  }, [currentWorkspace, setCurrentWorkspace]);

  // Collapsed from the titlebar toggle; the titlebar button brings it back.
  if (!open) return null;

  return (
    <aside className="flex h-full w-[380px] shrink-0 flex-col border-l border-border bg-panel">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-3 pb-2 pt-3">
        <div className="flex items-center gap-1">
          <h2 className="title-serif rule-title flex-1 text-center text-[13px] text-foreground/85">
            项目空间
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            title="折叠项目空间"
          >
            <SidebarRightIcon />
          </button>
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          <button
            onClick={switchSpace}
            className="min-w-0 flex-1 truncate rounded-md border border-border/70 bg-background/60 px-2 py-1 text-left text-[11px] text-foreground/85 transition-colors hover:bg-accent/60"
            title={root?.path ?? '选择项目空间目录'}
          >
            {root?.name ?? '选择项目空间'}
          </button>
          <button
            onClick={() => root && window.electronAPI.workspace.openInOS(root.path)}
            disabled={!root}
            className="shrink-0 rounded-md border border-border/70 p-1 text-muted-foreground transition-colors enabled:hover:bg-accent enabled:hover:text-accent-foreground disabled:opacity-40"
            title="在系统中打开"
          >
            <ExternalIcon />
          </button>
          <button
            onClick={refresh}
            className="shrink-0 rounded-md border border-border/70 px-1.5 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            title="刷新文件列表"
          >
            <RefreshCwIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {error && (
          <p className="mt-2 rounded-md bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
            {error}
          </p>
        )}
      </div>

      <FileBrowser />

      {tabs.length > 0 && (
        <div className="flex min-h-0 flex-1 flex-col border-t border-border">
          <FileViewer />
        </div>
      )}

      <SpaceFooter />
    </aside>
  );
}
