import { app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AppSettings, ModelConfig, MCPConfig } from '../../shared/types';

const SETTINGS_FILE = 'settings.json';

const DEFAULT_SETTINGS: AppSettings = {
  models: [],
  activeModelId: null,
  mcpServers: [],
  theme: 'dark',
  fontSize: 14,
  autoApproveTools: false,
  defaultThinkingLevel: 'medium',
  skillRegistryUrl: ''
};

export class SettingsManager {
  private settings: AppSettings;
  private filePath: string;

  constructor() {
    const dataDir = path.join(app.getPath('userData'), 'cocoagent');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.filePath = path.join(dataDir, SETTINGS_FILE);
    this.settings = this.load();
  }

  private load(): AppSettings {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(data);
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch {
      // Corrupted file, use defaults
    }
    return { ...DEFAULT_SETTINGS };
  }

  private save(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2));
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
