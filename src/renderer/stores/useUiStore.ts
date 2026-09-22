import { create } from 'zustand';

/**
 * Window-chrome layout state: which side panels are showing and how wide.
 *
 * Kept separate from the domain stores because it is pure view state that the
 * titlebar toggles and the panels both read. Widths persist to localStorage
 * (per-window view prefs, not user data — hence not the SQLite settings table).
 */

export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 480;
export const SIDEBAR_DEFAULT_WIDTH = 256;
export const SPACE_MIN_WIDTH = 280;
export const SPACE_MAX_WIDTH = 640;
export const SPACE_DEFAULT_WIDTH = 380;

const SIDEBAR_WIDTH_KEY = 'coco.sidebarWidth';
const SPACE_WIDTH_KEY = 'coco.spacePanelWidth';

function loadWidth(key: string, fallback: number, min: number, max: number): number {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    if (Number.isFinite(parsed)) {
      return Math.min(max, Math.max(min, parsed));
    }
  } catch {
    // localStorage 不可用时用默认值。
  }
  return fallback;
}

function saveWidth(key: string, value: number): void {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // 写入失败不影响本次会话内的使用。
  }
}

function clampWidth(value: number, min: number, max: number, key: string): number {
  const width = Math.min(max, Math.max(min, Math.round(value)));
  saveWidth(key, width);
  return width;
}

interface UiState {
  sidebarOpen: boolean;
  spacePanelOpen: boolean;
  skillsModalOpen: boolean;
  sidebarWidth: number;
  spacePanelWidth: number;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSpacePanel: () => void;
  setSpacePanelOpen: (open: boolean) => void;
  toggleSkillsModal: () => void;
  setSkillsModalOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setSpacePanelWidth: (width: number) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  spacePanelOpen: true,
  skillsModalOpen: false,
  sidebarWidth: loadWidth(SIDEBAR_WIDTH_KEY, SIDEBAR_DEFAULT_WIDTH, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH),
  spacePanelWidth: loadWidth(SPACE_WIDTH_KEY, SPACE_DEFAULT_WIDTH, SPACE_MIN_WIDTH, SPACE_MAX_WIDTH),

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  toggleSpacePanel: () => set((s) => ({ spacePanelOpen: !s.spacePanelOpen })),
  setSpacePanelOpen: (open) => set({ spacePanelOpen: open }),

  toggleSkillsModal: () => set((s) => ({ skillsModalOpen: !s.skillsModalOpen })),
  setSkillsModalOpen: (open) => set({ skillsModalOpen: open }),

  setSidebarWidth: (width) =>
    set({
      sidebarWidth: clampWidth(width, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH, SIDEBAR_WIDTH_KEY)
    }),
  setSpacePanelWidth: (width) =>
    set({
      spacePanelWidth: clampWidth(width, SPACE_MIN_WIDTH, SPACE_MAX_WIDTH, SPACE_WIDTH_KEY)
    })
}));
