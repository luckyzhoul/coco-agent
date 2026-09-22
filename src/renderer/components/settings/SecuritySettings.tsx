import { useEffect, useState } from 'react';
import type { SecurityLevel } from '@shared/types';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { CheckIcon } from '../layout/icons';

const LEVEL_INFO: Record<SecurityLevel, { label: string; detail: string }> = {
  readonly: {
    label: '只读',
    detail:
      'Agent 完全不会获得写入、编辑或 shell 工具 — 它根本无法修改文件。'
  },
  workspace: {
    label: '项目空间（推荐）',
    detail:
      '文件工具被限制在选定的项目空间内。CocoAgent 数据目录仍可写。'
  },
  full: {
    label: '完全访问',
    detail: '不限制路径。危险工具调用仍需你批准。'
  }
};

export function SecuritySettings() {
  const [level, setLevel] = useState<SecurityLevel>('workspace');
  const [levels, setLevels] = useState<SecurityLevel[]>(['readonly', 'workspace', 'full']);
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
          控制 Agent 可以在你的文件系统上做什么。更改将在下一个会话启动时生效。
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
                <span className="text-sm font-medium">{info.label}</span>
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
          危险工具调用（shell 命令、桌面输入、浏览器操作）无论级别如何都会请求批准。
        </div>
        <div>
          在 `workspace` 模式下，shell 工具仍可访问项目空间之外 — 完整的操作系统级沙箱是已知限制，尚未实现。
        </div>
      </div>

      {saved && (
        <div className="flex items-center gap-1 text-xs text-emerald-600">
          <CheckIcon className="w-3.5 h-3.5" />
          已保存 — 将应用于新会话。
        </div>
      )}
    </div>
  );
}
