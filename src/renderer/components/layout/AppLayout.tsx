import { Titlebar } from './Titlebar';
import { Sidebar } from './Sidebar';
import { SpacePanel } from '../space/SpacePanel';
import { useUiStore } from '../../stores/useUiStore';

interface AppLayoutProps {
  children: React.ReactNode;
  onOpenSettings: () => void;
}

export function AppLayout({ children, onOpenSettings }: AppLayoutProps) {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);

  return (
    <div className="flex h-full flex-col bg-background">
      <Titlebar />
      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && <Sidebar onOpenSettings={onOpenSettings} />}
        <main className="flex-1 overflow-hidden">{children}</main>
        <SpacePanel />
      </div>
    </div>
  );
}
