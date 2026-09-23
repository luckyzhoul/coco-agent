import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { ModelsSettings } from './ModelsSettings';
import { McpSettings } from './McpSettings';
import { SkillsSettings } from './SkillsSettings';
import { GeneralSettings } from './GeneralSettings';
import { UpdateSettings } from './UpdateSettings';
import { AgentsSettings } from './AgentsSettings';
import { SecuritySettings } from './SecuritySettings';
import {
  CogIcon,
  UserIcon,
  ShieldIcon,
  BrainIcon,
  PlugIcon,
  PuzzleIcon,
  UploadIcon,
  CloseIcon
} from '../layout/icons';

interface SettingsPanelProps {
  onClose: () => void;
}

type TabId = 'general' | 'agents' | 'security' | 'models' | 'mcp' | 'skills' | 'updates';

const tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'general', label: '通用', icon: CogIcon },
  { id: 'agents', label: 'Agent', icon: UserIcon },
  { id: 'security', label: '安全', icon: ShieldIcon },
  { id: 'models', label: '模型', icon: BrainIcon },
  { id: 'mcp', label: 'MCP 服务', icon: PlugIcon },
  { id: 'skills', label: '技能', icon: PuzzleIcon },
  { id: 'updates', label: '更新', icon: UploadIcon }
];

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const loadAll = useSettingsStore((s) => s.loadAll);
  const isLoading = useSettingsStore((s) => s.isLoading);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-chat-assistant border border-border/60 rounded-2xl w-[900px] h-[80vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <h2 className="text-lg font-semibold">设置</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar tabs */}
          <div className="w-48 border-r border-border/50 p-2 space-y-1">
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
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <span className="text-muted-foreground">加载中…</span>
              </div>
            ) : (
              <>
                {activeTab === 'general' && <GeneralSettings />}
                {activeTab === 'agents' && <AgentsSettings />}
                {activeTab === 'security' && <SecuritySettings />}
                {activeTab === 'models' && <ModelsSettings />}
                {activeTab === 'mcp' && <McpSettings />}
                {activeTab === 'skills' && <SkillsSettings />}
                {activeTab === 'updates' && <UpdateSettings />}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
