import { useEffect, useState } from 'react';
import type { SessionInfo } from '@shared/types';
import { TrashIcon, CloseIcon } from '../layout/icons';

function formatTime(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  });
}

export function TrashManager() {
  const [trashedSessions, setTrashedSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTrashed = async () => {
    setLoading(true);
    setError(null);
    try {
      setTrashedSessions(await window.electronAPI.agent.listTrashedSessions());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrashed();
  }, []);

  const handleRestore = async (session: SessionInfo) => {
    try {
      await window.electronAPI.agent.restoreSession(session.id);
      setTrashedSessions(await window.electronAPI.agent.listTrashedSessions());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handlePurge = async (session: SessionInfo) => {
    if (!window.confirm(`彻底删除会话「${session.title}」吗？此操作不可撤销。`)) return;
    try {
      await window.electronAPI.agent.purgeSession(session.id);
      setTrashedSessions(await window.electronAPI.agent.listTrashedSessions());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleEmpty = async () => {
    if (trashedSessions.length === 0) return;
    if (!window.confirm(`清空回收站？共 ${trashedSessions.length} 个会话将被彻底删除，此操作不可撤销。`))
      return;
    try {
      await window.electronAPI.agent.emptyTrash();
      setTrashedSessions([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-medium">回收站</h4>
          <p className="text-xs text-muted-foreground mt-1">
            侧边栏删除的对话会移到这里。恢复后对话将重新出现在侧边栏列表中；清空后彻底删除，无法找回。
          </p>
        </div>
        {trashedSessions.length > 0 && (
          <button
            onClick={handleEmpty}
            className="shrink-0 text-xs px-2.5 py-1 rounded-md border border-border bg-card hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            清空回收站
          </button>
        )}
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-xs text-muted-foreground py-4 text-center">加载中…</div>
      ) : trashedSessions.length === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center bg-background border border-border/60 rounded-lg">
          回收站是空的
        </div>
      ) : (
        <div className="space-y-1 max-h-64 overflow-y-auto border border-border/60 rounded-lg bg-background p-1">
          {trashedSessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent/40 transition-colors group"
            >
              <TrashIcon className="w-3.5 h-3.5 shrink-0 text-muted-foreground/60" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{session.title}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  删除于 {formatTime(session.deletedAt ?? session.updatedAt)} ·{' '}
                  {session.messageCount} 条
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleRestore(session)}
                  title="恢复到侧边栏"
                  className="text-xs px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  恢复
                </button>
                <button
                  onClick={() => handlePurge(session)}
                  title="彻底删除"
                  className="flex items-center justify-center rounded p-1 text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
