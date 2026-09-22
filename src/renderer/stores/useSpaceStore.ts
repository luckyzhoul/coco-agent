import { create } from 'zustand';
import type { FileEntry, WorkspaceInfo } from '@shared/types';
import { useSessionStore } from './useSessionStore';

export interface SpaceTab {
  path: string;
  name: string;
  /** Text as last loaded/saved. */
  savedContent: string;
  /** Current editor text. */
  content: string;
  mtime: number;
  binary: boolean;
  tooLarge: boolean;
  loadError?: string;
}

export type SpaceSort = 'name' | 'time';

interface SpaceState {
  root: WorkspaceInfo | null;
  /** Directory currently listed in the browser. */
  currentDir: string;
  entries: FileEntry[];
  sort: SpaceSort;
  showHidden: boolean;
  filter: string;
  tabs: SpaceTab[];
  activeTabPath: string | null;
  loading: boolean;
  error: string | null;
  /** Whether the panel is expanded. */
  open: boolean;

  setOpen: (open: boolean) => void;
  setRoot: (root: WorkspaceInfo | null) => void;
  /** Ask the user for a directory and move the app + active session to it. */
  switchSpace: () => Promise<WorkspaceInfo | null>;
  setSort: (sort: SpaceSort) => void;
  setFilter: (filter: string) => void;
  toggleHidden: () => void;
  browse: (dirPath: string) => Promise<void>;
  refresh: () => Promise<void>;
  openFile: (entry: FileEntry) => Promise<void>;
  closeTab: (path: string) => void;
  setActiveTab: (path: string) => void;
  updateContent: (path: string, content: string) => void;
  saveTab: (path: string) => Promise<void>;
}

function tabName(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
}

function messageOf(err: unknown): string {
  if (err instanceof Error) {
    // Electron wraps IPC errors; strip the noisy prefix.
    return err.message.replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/, '');
  }
  return String(err);
}

export const useSpaceStore = create<SpaceState>((set, get) => ({
  root: null,
  currentDir: '',
  entries: [],
  sort: 'name',
  showHidden: false,
  filter: '',
  tabs: [],
  activeTabPath: null,
  loading: false,
  error: null,
  open: true,

  setOpen: (open) => set({ open }),
  setSort: (sort) => set({ sort }),
  setFilter: (filter) => set({ filter }),
  toggleHidden: () => set((s) => ({ showHidden: !s.showHidden })),

  setRoot: (root) => {
    const changed = get().root?.path !== root?.path;
    set({ root, error: null });
    if (changed) {
      // A different project space: drop tabs that no longer belong to it.
      set({ tabs: [], activeTabPath: null });
      if (root) get().browse(root.path);
    }
  },

  switchSpace: async () => {
    const selected = await window.electronAPI.workspace.select();
    if (!selected) return null;

    // Moving the app to a space also moves the active session: the panel and
    // the agent must never disagree about the working directory.
    const rebound = await window.electronAPI.agent.rebindWorkspace(selected.path);
    const info: WorkspaceInfo = rebound?.workspacePath
      ? {
          path: rebound.workspacePath,
          name:
            rebound.workspacePath.split(/[/\\]/).filter(Boolean).pop() || rebound.workspacePath
        }
      : selected;

    useSessionStore.getState().setCurrentWorkspace(info);
    return info;
  },

  browse: async (dirPath) => {
    set({ loading: true, error: null });
    try {
      const entries = await window.electronAPI.workspace.listFiles(dirPath);
      set({ entries, currentDir: dirPath, loading: false });
    } catch (err) {
      set({ loading: false, error: messageOf(err) });
    }
  },

  refresh: async () => {
    const { currentDir, root } = get();
    if (currentDir) await get().browse(currentDir);
    else if (root) await get().browse(root.path);
  },

  openFile: async (entry) => {
    if (entry.isDir) {
      await get().browse(entry.path);
      return;
    }

    const existing = get().tabs.find((t) => t.path === entry.path);
    if (existing) {
      set({ activeTabPath: entry.path });
      return;
    }

    try {
      const result = await window.electronAPI.workspace.readFile(entry.path);
      const tab: SpaceTab = {
        path: result.path,
        name: tabName(result.path),
        content: result.content,
        savedContent: result.content,
        mtime: result.mtime,
        binary: result.binary,
        tooLarge: result.tooLarge
      };
      set((s) => ({ tabs: [...s.tabs, tab], activeTabPath: tab.path, error: null }));
    } catch (err) {
      set({ error: messageOf(err) });
    }
  },

  closeTab: (path) =>
    set((s) => {
      const tabs = s.tabs.filter((t) => t.path !== path);
      const activeTabPath =
        s.activeTabPath === path ? tabs[tabs.length - 1]?.path ?? null : s.activeTabPath;
      return { tabs, activeTabPath };
    }),

  setActiveTab: (path) => set({ activeTabPath: path }),

  updateContent: (path, content) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.path === path ? { ...t, content } : t))
    })),

  saveTab: async (path) => {
    const tab = get().tabs.find((t) => t.path === path);
    if (!tab || tab.binary || tab.tooLarge) return;

    try {
      const result = await window.electronAPI.workspace.writeFile(path, tab.content, tab.mtime);
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.path === path
            ? { ...t, savedContent: t.content, mtime: result.mtime }
            : t
        ),
        error: null
      }));
    } catch (err) {
      set({ error: messageOf(err) });
    }
  }
}));

export function isTabDirty(tab: SpaceTab): boolean {
  return tab.content !== tab.savedContent;
}
