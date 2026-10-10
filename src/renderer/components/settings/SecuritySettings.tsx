import { useEffect, useState } from 'react';
import type { AuthorizedDir, SecurityLevel } from '@shared/types';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { CheckIcon } from '../layout/icons';
import { SecurityModeIcon, SECURITY_MODE_STYLES } from '../security/modeIcons';
import { ArchiveManager } from './ArchiveManager';

const LEVEL_INFO: Record<SecurityLevel, { label: string; detail: string }> = {
  auto: {
    label: '自动审核（推荐）',
    detail:
      '平时可只读访问系统普通文件；项目空间、授权目录和 CocoAgent 数据目录内可自由写入，越界写入与 shell 命令会先征求你的批准。'
  },
  full: {
    label: '完整权限',
    detail: '不限制路径，不弹出确认。Agent 的权限完全由它自己判断。'
  },
  ask: {
    label: '操作前询问',
    detail: '每次写入、删除或执行命令都会先弹窗确认，批准才会执行。'
  },
  readonly: {
    label: '只读模式',
    detail:
      'Agent 完全不会获得写入、编辑或 shell 工具 — 它根本无法修改文件。'
  }
};

function AuthorizedDirsManager() {
  const [dirs, setDirs] = useState<AuthorizedDir[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = (list: AuthorizedDir[]) => setDirs(list);

  useEffect(() => {
    window.electronAPI.security
      .listAuthorized()
      .then(refresh)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const handleAdd = async () => {
    setError(null);
    try {
      const picked = await window.electronAPI.security.pickDirectory();
      if (!picked) return;
      refresh(await window.electronAPI.security.addAuthorized(picked, true));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRemove = async (path: string) => {
    setError(null);
    try {
      refresh(await window.electronAPI.security.removeAuthorized(path));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleToggleWrite = async (dir: AuthorizedDir) => {
    setError(null);
    try {
      refresh(await window.electronAPI.security.setAuthorizedCanWrite(dir.path, !dir.canWrite));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="bg-background border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">授权目录</span>
        <button
          onClick={handleAdd}
          className="text-xs px-2.5 py-1 rounded-md border border-border bg-card hover:bg-accent/40 transition-colors"
        >
          添加目录
        </button>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        项目空间之外的额外目录。未授权目录对 Agent 只读；默认授予读写权限，可降级为只读。
      </p>

      {error && <p className="text-xs text-destructive mb-2">{error}</p>}

      {dirs.length === 0 ? (
        <p className="text-xs text-muted-foreground/70">暂无授权目录。</p>
      ) : (
        <ul className="space-y-1.5">
          {dirs.map((dir) => (
            <li
              key={dir.path}
              className="flex items-center justify-between gap-2 text-xs bg-card border border-border/60 rounded-md px-2.5 py-1.5"
            >
              <code className="bg-muted px-1 rounded truncate" title={dir.path}>
                {dir.path}
              </code>
              <span className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleToggleWrite(dir)}
                  className={`px-1.5 py-0.5 rounded border transition-colors ${
                    dir.canWrite
                      ? 'border-amber-500/40 text-amber-600 hover:bg-amber-500/10'
                      : 'border-border text-muted-foreground hover:bg-accent/40'
                  }`}
                  title={dir.canWrite ? '当前可写入，点击降级为只读' : '当前只读，点击授予写入'}
                >
                  {dir.canWrite ? '可写' : '只读'}
                </button>
                <button
                  onClick={() => handleRemove(dir.path)}
                  className="px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  title="撤销授权"
                >
                  移除
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SecuritySettings() {
  const [level, setLevel] = useState<SecurityLevel>('auto');
  const [levels, setLevels] = useState<SecurityLevel[]>(['auto', 'full', 'ask', 'readonly']);
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.electronAPI.security
      .get()
      .then((s) => {
        setLevel(s.level);
        setLevels(s.levels);
        setWorkspaceRoot(s.workspaceRoot);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const handleSelect = async (next: SecurityLevel) => {
    setError(null);
    try {
      const applied = await window.electronAPI.security.setLevel(next);
      setLevel(applied);
      // Refresh the shared settings so the space panel reflects the new level.
      await useSettingsStore.getState().loadSettings();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-medium mb-1">安全</h3>
        <p className="text-sm text-muted-foreground">
          控制 Agent 可以在你的文件系统上做什么。更改对当前对话立即生效。
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {levels.map((lvl) => {
          const info = LEVEL_INFO[lvl];
          const active = lvl === level;
          return (
            <button
              key={lvl}
              onClick={() => handleSelect(lvl)}
              className={`w-full text-left p-4 rounded-lg border transition-colors ${
                active
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-border bg-background hover:bg-accent/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className={SECURITY_MODE_STYLES[lvl]}>
                    <SecurityModeIcon mode={lvl} className="w-4 h-4" />
                  </span>
                  {info.label}
                </span>
                {active && <span className="text-xs text-primary">当前</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{info.detail}</p>
            </button>
          );
        })}
      </div>

      <div className="bg-background border border-border rounded-lg p-4 text-xs text-muted-foreground space-y-1">
        <div className="font-medium text-foreground text-sm mb-1">执行细节</div>
        <div>
          写入根目录：{' '}
          <code className="bg-muted px-1 rounded">{workspaceRoot || '（尚无会话）'}</code>
        </div>
        <div>
          读取不受限制：所有模式下 Agent 都可以只读访问系统普通文件。
        </div>
        <div>
          「自动审核」下，越界写入与 shell 命令会弹窗征求批准；批准一次后可在会话内免重复确认。
        </div>
        <div>
          shell 命令无法逐路径审查，除「完整权限」外都会先请求批准。操作系统级沙箱尚未实现。
        </div>
      </div>

      <AuthorizedDirsManager />

      {saved && (
        <div className="flex items-center gap-1 text-xs text-emerald-600">
          <CheckIcon className="w-3.5 h-3.5" />
          已保存 — 当前对话立即生效。
        </div>
      )}

      <div className="border-t border-border/50 pt-6">
        <ArchiveManager />
      </div>
    </div>
  );
}
