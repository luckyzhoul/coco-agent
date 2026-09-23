import { create } from 'zustand';
import type { AgentInfo } from '@shared/types';
import { useAgentIconStore } from './useAgentIconStore';

interface AgentState {
  agents: AgentInfo[];
  activeAgentId: string | null;
  isLoading: boolean;

  loadAgents: () => Promise<void>;
  createAgent: (input: {
    name: string;
    description?: string;
    persona?: string;
    icon?: string;
  }) => Promise<AgentInfo>;
  setActiveAgent: (id: string) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  getPersona: (id: string) => Promise<string>;
  setPersona: (id: string, body: string) => Promise<void>;
  updateAgent: (
    id: string,
    updates: { name?: string; description?: string; icon?: string },
  ) => Promise<void>;
  uploadIcon: (id: string) => Promise<AgentInfo | null>;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  activeAgentId: null,
  isLoading: false,

  loadAgents: async () => {
    set({ isLoading: true });
    try {
      const [agents, active] = await Promise.all([
        window.electronAPI.agents.list(),
        window.electronAPI.agents.getActive()
      ]);
      set({ agents, activeAgentId: active?.id ?? null });
    } finally {
      set({ isLoading: false });
    }
  },

  createAgent: async (input) => {
    const agent = await window.electronAPI.agents.create(input);
    await get().loadAgents();
    return agent;
  },

  setActiveAgent: async (id) => {
    if (id === get().activeAgentId) return;
    const active = await window.electronAPI.agents.setActive(id);
    set({ activeAgentId: active.id });
  },

  deleteAgent: async (id) => {
    const agents = await window.electronAPI.agents.delete(id);
    set({ agents });
    const active = await window.electronAPI.agents.getActive();
    set({ activeAgentId: active?.id ?? null });
  },

  getPersona: (id) => window.electronAPI.agents.getPersona(id),

  setPersona: async (id, body) => {
    await window.electronAPI.agents.setPersona(id, body);
  },

  updateAgent: async (id, updates) => {
    await window.electronAPI.agents.update(id, updates);
    if (updates.icon !== undefined) {
      useAgentIconStore.getState().invalidate(id);
    }
    await get().loadAgents();
  },

  uploadIcon: async (id) => {
    const updated = await window.electronAPI.agents.uploadIcon(id);
    if (!updated) return null;
    // The file changed on disk even when the icon value stayed 'custom'.
    useAgentIconStore.getState().invalidate(id);
    await get().loadAgents();
    return updated;
  }
}));
