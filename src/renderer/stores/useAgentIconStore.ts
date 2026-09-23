import { create } from 'zustand';

/**
 * Cache of uploaded avatar images (data URLs) keyed by agent id. The renderer
 * cannot read files off disk, so uploaded icons come over IPC; caching keeps
 * that to one round-trip per agent instead of one per avatar instance.
 */
interface AgentIconState {
  /** agentId → data URL, or null when the agent has no uploaded icon file. */
  icons: Record<string, string | null>;
  ensure: (agentId: string) => Promise<void>;
  /** Drop the cached entry so the next render re-reads it from disk. */
  invalidate: (agentId: string) => void;
}

export const useAgentIconStore = create<AgentIconState>((set, get) => ({
  icons: {},

  ensure: async (agentId) => {
    if (agentId in get().icons) return;
    // Mark as pending so concurrent avatars don't fire duplicate requests.
    set((s) => ({ icons: { ...s.icons, [agentId]: null } }));
    try {
      const dataUrl = await window.electronAPI.agents.getIcon(agentId);
      set((s) => ({ icons: { ...s.icons, [agentId]: dataUrl } }));
    } catch {
      // Leave the null fallback in place; the avatar degrades to initials.
    }
  },

  invalidate: (agentId) => {
    set((s) => {
      const icons = { ...s.icons };
      delete icons[agentId];
      return { icons };
    });
  }
}));
