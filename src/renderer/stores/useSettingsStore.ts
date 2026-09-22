import { create } from 'zustand';
import type { AppSettings, ModelConfig, MCPConfig, SkillInfo } from '@shared/types';

interface SettingsState {
  settings: AppSettings | null;
  models: ModelConfig[];
  mcpServers: MCPConfig[];
  skills: SkillInfo[];
  activeModelId: string | null;
  isLoading: boolean;

  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  loadModels: () => Promise<void>;
  loadMcpServers: () => Promise<void>;
  loadSkills: () => Promise<void>;
  loadAll: () => Promise<void>;

  addModel: (model: Omit<ModelConfig, 'id'>) => Promise<void>;
  updateModel: (id: string, updates: Partial<ModelConfig>) => Promise<void>;
  deleteModel: (id: string) => Promise<void>;
  setActiveModel: (id: string) => Promise<void>;

  addMcpServer: (config: Omit<MCPConfig, 'id'>) => Promise<void>;
  updateMcpServer: (id: string, updates: Partial<MCPConfig>) => Promise<void>;
  deleteMcpServer: (id: string) => Promise<void>;
  startMcpServer: (id: string) => Promise<void>;
  stopMcpServer: (id: string) => Promise<void>;
  restartMcpServer: (id: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  models: [],
  mcpServers: [],
  skills: [],
  activeModelId: null,
  isLoading: false,

  loadSettings: async () => {
    const settings = await window.electronAPI.settings.get();
    set({ settings });
  },

  updateSettings: async (partial) => {
    const settings = await window.electronAPI.settings.set(partial);
    set({ settings });
  },

  loadModels: async () => {
    const models = await window.electronAPI.models.list();
    const active = await window.electronAPI.models.getActive();
    set({ models, activeModelId: active?.id || null });
  },

  loadMcpServers: async () => {
    const servers = await window.electronAPI.mcp.list();
    set({ mcpServers: servers });
  },

  loadSkills: async () => {
    const skills = await window.electronAPI.skills.list();
    set({ skills });
  },

  loadAll: async () => {
    set({ isLoading: true });
    try {
      await Promise.all([
        get().loadSettings(),
        get().loadModels(),
        get().loadMcpServers(),
        get().loadSkills()
      ]);
    } finally {
      set({ isLoading: false });
    }
  },

  addModel: async (model) => {
    const models = await window.electronAPI.models.add(model as ModelConfig);
    set({ models });
  },

  updateModel: async (id, updates) => {
    const models = await window.electronAPI.models.update(id, updates);
    set({ models });
  },

  deleteModel: async (id) => {
    const models = await window.electronAPI.models.delete(id);
    set({ models });
    if (get().activeModelId === id) {
      set({ activeModelId: models[0]?.id || null });
    }
  },

  setActiveModel: async (id) => {
    await window.electronAPI.models.setActive(id);
    set({ activeModelId: id });
  },

  addMcpServer: async (config) => {
    const servers = await window.electronAPI.mcp.add(config as MCPConfig);
    set({ mcpServers: servers });
  },

  updateMcpServer: async (id, updates) => {
    const servers = await window.electronAPI.mcp.update(id, updates);
    set({ mcpServers: servers });
  },

  deleteMcpServer: async (id) => {
    const servers = await window.electronAPI.mcp.delete(id);
    set({ mcpServers: servers });
  },

  startMcpServer: async (id) => {
    await window.electronAPI.mcp.start(id);
    const servers = await window.electronAPI.mcp.list();
    set({ mcpServers: servers });
  },

  stopMcpServer: async (id) => {
    await window.electronAPI.mcp.stop(id);
    const servers = await window.electronAPI.mcp.list();
    set({ mcpServers: servers });
  },

  restartMcpServer: async (id) => {
    await window.electronAPI.mcp.restart(id);
    const servers = await window.electronAPI.mcp.list();
    set({ mcpServers: servers });
  }
}));
