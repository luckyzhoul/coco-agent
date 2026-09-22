import { Titlebar } from './Titlebar';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
  onOpenSettings: () => void;
}

export function AppLayout({ children, onOpenSettings }: AppLayoutProps) {
  return (
    <div className="flex h-full flex-col bg-background">
      <Titlebar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar onOpenSettings={onOpenSettings} />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
