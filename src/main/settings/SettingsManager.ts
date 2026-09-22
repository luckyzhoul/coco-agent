import { getDb } from '../db';
import type { AppSettings, ModelConfig, MCPConfig } from '../../shared/types';

const SETTINGS_KEY = 'app';

const DEFAULT_SETTINGS: AppSettings = {
  securityLevel: 'workspace',
  activeAgentId: null,
  defaultWorkspacePath: '~/Desktop/CocoSpace',
  lastWorkspacePath: '',
  models: [],
  activeModelId: null,
  mcpServers: [],
  theme: 'light',
  fontSize: 14,
  autoApproveTools: false,
  defaultThinkingLevel: 'medium',
  skillRegistryUrl: '',
  updateFeedUrl: ''
};

export class SettingsManager {
  private settings: AppSettings;

  constructor() {
    this.settings = this.load();
  }

  private load(): AppSettings {
    try {
      const row = getDb()
        .prepare('SELECT value FROM settings WHERE key = ?')
        .get(SETTINGS_KEY) as { value: string } | undefined;
      if (row?.value) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(row.value) };
      }
    } catch {
      // Corrupted value, use defaults
    }
    return { ...DEFAULT_SETTINGS };
  }

  private save(): void {
    try {
      getDb()
        .prepare(
          'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
        )
        .run(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      // Non-fatal
    }
  }

  get(): AppSettings {
    return { ...this.settings };
  }

  set(partial: Partial<AppSettings>): AppSettings {
    this.settings = { ...this.settings, ...partial };
    this.save();
    return { ...this.settings };
  }

  reset(): AppSettings {
    this.settings = { ...DEFAULT_SETTINGS };
    this.save();
    return { ...this.settings };
  }

  // Model helpers
  getModels(): ModelConfig[] {
    return [...this.settings.models];
  }

  addModel(model: ModelConfig): ModelConfig[] {
    // If this is the first model, make it default
    const models = [...this.settings.models];
    if (models.length === 0) {
      model.isDefault = true;
      this.settings.activeModelId = model.id;
    }
    models.push(model);
    this.settings.models = models;
    this.save();
    return [...models];
  }

  updateModel(id: string, updates: Partial<ModelConfig>): ModelConfig[] {
    const models = this.settings.models.map(m =>
      m.id === id ? { ...m, ...updates } : m
    );
    this.settings.models = models;
    this.save();
    return [...models];
  }

  deleteModel(id: string): ModelConfig[] {
    const models = this.settings.models.filter(m => m.id !== id);
    this.settings.models = models;
    if (this.settings.activeModelId === id) {
      this.settings.activeModelId = models[0]?.id || null;
    }
    this.save();
    return [...models];
  }

  setActiveModel(id: string): void {
    if (this.settings.models.some(m => m.id === id)) {
      this.settings.activeModelId = id;
      this.save();
    }
  }

  getActiveModel(): ModelConfig | null {
    return this.settings.models.find(m => m.id === this.settings.activeModelId) || null;
  }

  // MCP helpers
  getMcpServers(): MCPConfig[] {
    return [...this.settings.mcpServers];
  }

  addMcpServer(server: MCPConfig): MCPConfig[] {
    const servers = [...this.settings.mcpServers, server];
    this.settings.mcpServers = servers;
    this.save();
    return [...servers];
  }

  updateMcpServer(id: string, updates: Partial<MCPConfig>): MCPConfig[] {
    const servers = this.settings.mcpServers.map(s =>
      s.id === id ? { ...s, ...updates } : s
    );
    this.settings.mcpServers = servers;
    this.save();
    return [...servers];
  }

  deleteMcpServer(id: string): MCPConfig[] {
    const servers = this.settings.mcpServers.filter(s => s.id !== id);
    this.settings.mcpServers = servers;
    this.save();
    return [...servers];
  }
}

export const settingsManager = new SettingsManager();
