import { useEffect, useState } from 'react';
import { useSettingsStore } from '../../stores/useSettingsStore';

interface AppPaths {
  home: string;
  piRuntime: string;
  settingsFile: string;
  sessionsDir: string;
  skillsDir: string;
  memoryFile: string;
  homeOverridden: boolean;
}

export function GeneralSettings() {
  const settings = useSettingsStore((s) => s.settings);
  const [appPaths, setAppPaths] = useState<AppPaths | null>(null);

  useEffect(() => {
    window.electronAPI.app.getPaths().then(setAppPaths).catch(() => {});
  }, []);

  if (!settings) return null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-medium mb-1">Appearance</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Customize the look and feel of CocoAgent.
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm">Theme</label>
            <select
              value={settings.theme}
              className="bg-background border border-input rounded-md px-3 py-1.5 text-sm"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm">Font Size</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="12"
                max="20"
                value={settings.fontSize}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground w-10">
                {settings.fontSize}px
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <h3 className="text-base font-medium mb-1">Behavior</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Control how the agent behaves.
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm">Auto-approve tools</div>
              <div className="text-xs text-muted-foreground">
                Automatically approve all tool calls
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.autoApproveTools}
              className="w-4 h-4"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm">Default Thinking Level</label>
            <select
              value={settings.defaultThinkingLevel}
              className="bg-background border border-input rounded-md px-3 py-1.5 text-sm"
            >
              <option value="off">Off</option>
              <option value="minimal">Minimal</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <h3 className="text-base font-medium mb-1">Data Directory</h3>
        <p className="text-sm text-muted-foreground mb-4">
          All CocoAgent data lives under <code className="bg-muted px-1 rounded">COCO_HOME</code>.
          Override it with the <code className="bg-muted px-1 rounded">COCO_HOME</code> environment
          variable.
        </p>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-background border border-border rounded-md px-3 py-1.5 text-xs font-mono truncate">
              {appPaths?.home || '…'}
            </code>
            {appPaths?.homeOverridden && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground shrink-0">
                from env
              </span>
            )}
            <button
              onClick={() => window.electronAPI.app.openHome()}
              className="px-3 py-1.5 rounded-md text-sm border border-input hover:bg-accent transition-colors shrink-0"
            >
              Open
            </button>
          </div>

          <div className="text-xs text-muted-foreground space-y-1 pt-1">
            <div>
              Settings: <code className="bg-muted px-1 rounded">{appPaths?.settingsFile}</code>
            </div>
            <div>
              Sessions: <code className="bg-muted px-1 rounded">{appPaths?.sessionsDir}</code>
            </div>
            <div>
              Skills: <code className="bg-muted px-1 rounded">{appPaths?.skillsDir}</code>
            </div>
            <div>
              Memory: <code className="bg-muted px-1 rounded">{appPaths?.memoryFile}</code>
            </div>
            <div>
              Pi SDK runtime:{' '}
              <code className="bg-muted px-1 rounded">{appPaths?.piRuntime}</code>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <h3 className="text-base font-medium mb-1">About</h3>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>CocoAgent v0.1.0</p>
          <p>Local desktop AI agent powered by Pi SDK</p>
        </div>
      </div>
    </div>
  );
}
