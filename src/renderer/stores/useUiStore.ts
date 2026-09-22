import { create } from 'zustand';

/**
 * Window-chrome layout state: which side panels are showing.
 *
 * Kept separate from the domain stores because it is pure view state that the
 * titlebar toggles and the panels both read.
 */
interface UiState {
  sidebarOpen: boolean;
  spacePanelOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSpacePanel: () => void;
  setSpacePanelOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  spacePanelOpen: true,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  toggleSpacePanel: () => set((s) => ({ spacePanelOpen: !s.spacePanelOpen })),
  setSpacePanelOpen: (open) => set({ spacePanelOpen: open })
}));
