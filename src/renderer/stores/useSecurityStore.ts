import { create } from 'zustand';
import type { SecurityLevel } from '@shared/types';
import { useSettingsStore } from './useSettingsStore';

interface SecurityState {
  level: SecurityLevel;
  /** The session's write root, for display in the settings page. */
  workspaceRoot: string | null;
  loaded: boolean;

  load: () => Promise<void>;
  /** Persist a new level and keep every consumer (chat picker, settings page,
   *  space panel) in sync — the level applies to the running session at once. */
  select: (next: SecurityLevel) => Promise<void>;
}

/**
 * Shared source of truth for the security mode. ChatInput's picker and the
 * settings page used to hold independent one-shot local copies, which drifted
 * apart when the mode was switched in the other place; the store fixes both
 * the duplication and the desync.
 */
export const useSecurityStore = create<SecurityState>((set, get) => ({
  level: 'auto',
  workspaceRoot: null,
  loaded: false,

  load: async () => {
    const s = await window.electronAPI.security.get();
    set({ level: s.level, workspaceRoot: s.workspaceRoot, loaded: true });
  },

  select: async (next) => {
    if (next === get().level) return;
    const applied = await window.electronAPI.security.setLevel(next);
    set({ level: applied });
    // Refresh the shared settings so readers of settings.securityLevel
    // (e.g. the space panel's FileViewer) see the new level too.
    await useSettingsStore.getState().loadSettings();
  }
}));
