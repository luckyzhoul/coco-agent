import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { ModelsSettings } from './ModelsSettings';
import { McpSettings } from './McpSettings';
import { SkillsSettings } from './SkillsSettings';
import { GeneralSettings } from './GeneralSettings';

interface SettingsPanelProps {
  onClose: () => void;
}

type TabId = 'general' | 'models' | 'mcp' | 'skills';

const tabs: { id: TabId; label: string; icon: string }[] = [
  { id: 'general', label: 'General', icon: '⚙️' },
  { id: 'models', label: 'Models', icon: '🧠' },
  { id: 'mcp', label: 'MCP Servers', icon: '🔌' },
  { id: 'skills', label: 'Skills', icon: '🧩' }
];

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const loadAll = useSettingsStore((s) => s.loadAll);
  const isLoading = useSettingsStore((s) => s.isLoading);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg w-[900px] max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors text-xl"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar tabs */}
          <div className="w-48 border-r border-border p-2 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left ${
                  activeTab === tab.id
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <span className="text-muted-foreground">Loading...</span>
              </div>
            ) : (
              <>
                {activeTab === 'general' && <GeneralSettings />}
                {activeTab === 'models' && <ModelsSettings />}
                {activeTab === 'mcp' && <McpSettings />}
                {activeTab === 'skills' && <SkillsSettings />}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
