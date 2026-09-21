import { useState } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { ChatPanel } from './components/chat/ChatPanel';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { ToolApprovalModal } from './components/common/ToolApprovalModal';

export default function App() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <AppLayout onOpenSettings={() => setShowSettings(true)}>
        <ChatPanel />
      </AppLayout>
      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}
      <ToolApprovalModal />
    </>
  );
}
