import { useEffect, useState } from 'react';
import type { SessionInfo } from '@shared/types';
import { UnarchiveIcon, CloseIcon } from '../layout/icons';

function formatTime(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
}

export function ArchiveManager() {
  const [archivedSessions, setArchivedSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadArchived = async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await window.electronAPI.agent.listSessions();
      setArchivedSessions(all.filter((s) => s.archived));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArchived();
  }, []);

  const handleUnarchive = async (session: SessionInfo) => {
    try {
      const updated = await window.electronAPI.agent.setArchived(session.id, false);
      setArchivedSessions(updated.filter((s) => s.archived));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async (session: SessionInfo) => {
    if (!window.confirm(`确定删除会话「${session.title}」吗？此操作不可撤销。`)) return;
    try {
      await window.electronAPI.agent.deleteSession(session.id);
      const all = await window.electronAPI.agent.listSessions();
      setArchivedSessions(all.filter((s) => s.archived));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-medium">归档对话</h4>
        <p className="text-xs text-muted-foreground mt-1">
          查看和管理已归档的对话。取消归档后，对话将重新出现在侧边栏列表中。
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-xs text-muted-foreground py-4 text-center">加载中…</div>
      ) : archivedSessions.length === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center bg-background border border-border/60 rounded-lg">
          暂无归档对话
        </div>
      ) : (
        <div className="space-y-1 max-h-64 overflow-y-auto border border-border/60 rounded-lg bg-background p-1">
          {archivedSessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent/40 transition-colors group"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{session.title}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {formatTime(session.updatedAt)} · {session.messageCount} 条
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleUnarchive(session)}
                  title="取消归档"
                  className="flex items-center justify-center rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <UnarchiveIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(session)}
                  title="删除会话"
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
