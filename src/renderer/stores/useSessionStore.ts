import { create } from 'zustand';
import type { SessionInfo, WorkspaceInfo } from '@shared/types';

interface SessionState {
  sessions: SessionInfo[];
  currentWorkspace: WorkspaceInfo | null;
  recentWorkspaces: WorkspaceInfo[];
  isLoading: boolean;

  setSessions: (sessions: SessionInfo[]) => void;
  setCurrentWorkspace: (ws: WorkspaceInfo | null) => void;
  setRecentWorkspaces: (workspaces: WorkspaceInfo[]) => void;
  setLoading: (loading: boolean) => void;

  addSession: (session: SessionInfo) => void;
  removeSession: (sessionId: string) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessions: [],
  currentWorkspace: null,
  recentWorkspaces: [],
  isLoading: false,

  setSessions: (sessions) => set({ sessions }),
  setCurrentWorkspace: (ws) => set({ currentWorkspace: ws }),
  setRecentWorkspaces: (workspaces) => set({ recentWorkspaces: workspaces }),
  setLoading: (loading) => set({ isLoading: loading }),

  addSession: (session) =>
    set((state) => ({
      sessions: [session, ...state.sessions.filter((s) => s.id !== session.id)]
    })),

  removeSession: (sessionId) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== sessionId)
    }))
}));
