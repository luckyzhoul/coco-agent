import { useState } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { ChatPanel } from './components/chat/ChatPanel';
import { SettingsPanel } from './components/settings/SettingsPanel';

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
    </>
  );
}
