import { useEffect, useState } from 'react';
import type { SecurityLevel } from '@shared/types';

const LEVEL_INFO: Record<SecurityLevel, { label: string; detail: string }> = {
  readonly: {
    label: 'Read-only',
    detail:
      'The agent gets no write, edit, or shell tools at all — it physically cannot modify files.'
  },
  workspace: {
    label: 'Workspace (recommended)',
    detail:
      'File tools are scoped to the selected workspace. The CocoAgent data directory stays writable.'
  },
  full: {
    label: 'Full access',
    detail: 'No path restrictions. Dangerous tool calls still require your approval.'
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
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-medium mb-1">Security</h3>
        <p className="text-sm text-muted-foreground">
          Controls what the agent is allowed to do on your filesystem. Changes take effect when
          the next session starts.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
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
                {active && <span className="text-xs text-primary">Current</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{info.detail}</p>
            </button>
          );
        })}
      </div>

      <div className="bg-background border border-border rounded-lg p-4 text-xs text-muted-foreground space-y-1">
        <div className="font-medium text-foreground text-sm mb-1">Enforcement details</div>
        <div>
          Write root:{' '}
          <code className="bg-muted px-1 rounded">{workspaceRoot || '(no session yet)'}</code>
        </div>
        <div>
          Dangerous tool calls (shell commands, desktop input, browser actions) always ask for
          approval regardless of level.
        </div>
        <div>
          In `workspace` mode the shell tool can still reach outside the workspace — full
          OS-level sandboxing is a known limitation, not yet implemented.
        </div>
      </div>

      {saved && <div className="text-xs text-green-400">✓ Saved — applies to new sessions.</div>}
    </div>
  );
}
