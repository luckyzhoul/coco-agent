import { Titlebar } from './Titlebar';
import { Sidebar } from './Sidebar';
import { ResizeHandle } from './ResizeHandle';
import { SpacePanel } from '../space/SpacePanel';
import { useUiStore } from '../../stores/useUiStore';
import {
  SIDEBAR_DEFAULT_WIDTH,
  SPACE_DEFAULT_WIDTH,
} from '../../stores/useUiStore';

interface AppLayoutProps {
  children: React.ReactNode;
  onOpenSettings: () => void;
}

export function AppLayout({ children, onOpenSettings }: AppLayoutProps) {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const spacePanelOpen = useUiStore((s) => s.spacePanelOpen);
  const sidebarWidth = useUiStore((s) => s.sidebarWidth);
  const spacePanelWidth = useUiStore((s) => s.spacePanelWidth);
  const setSidebarWidth = useUiStore((s) => s.setSidebarWidth);
  const setSpacePanelWidth = useUiStore((s) => s.setSpacePanelWidth);

  return (
    <div className="flex h-full flex-col bg-background">
      <Titlebar />
      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <>
            <div
              className="h-full shrink-0 overflow-hidden"
              style={{ width: sidebarWidth }}
            >
              <Sidebar onOpenSettings={onOpenSettings} />
            </div>
            <ResizeHandle
              side="left"
              onResize={setSidebarWidth}
              onReset={() => setSidebarWidth(SIDEBAR_DEFAULT_WIDTH)}
            />
          </>
        )}
        <main className="flex-1 overflow-hidden">{children}</main>
        {spacePanelOpen && (
          <>
            <ResizeHandle
              side="right"
              onResize={setSpacePanelWidth}
              onReset={() => setSpacePanelWidth(SPACE_DEFAULT_WIDTH)}
            />
            <div
              className="h-full shrink-0 overflow-hidden"
              style={{ width: spacePanelWidth }}
            >
              <SpacePanel />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
