import React from 'react';
import { useSettingsStore } from '../../stores/useSettingsStore';

export function GeneralSettings() {
  const settings = useSettingsStore((s) => s.settings);

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
        <h3 className="text-base font-medium mb-1">About</h3>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>CocoAgent v0.1.0</p>
          <p>Local desktop AI agent powered by Pi SDK</p>
        </div>
      </div>
    </div>
  );
}
