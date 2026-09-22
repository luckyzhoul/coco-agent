import { useEffect, useState } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { ChatPanel } from './components/chat/ChatPanel';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { ToolApprovalModal } from './components/common/ToolApprovalModal';
import { SkillsModal } from './components/skills/SkillsModal';
import { useSettingsStore } from './stores/useSettingsStore';

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const theme = useSettingsStore((s) => s.settings?.theme);
  const fontSize = useSettingsStore((s) => s.settings?.fontSize);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (fontSize) document.documentElement.style.fontSize = `${fontSize}px`;
  }, [fontSize]);

  useEffect(() => {
    const root = document.documentElement;
    const prefersDark =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = theme === 'dark' || (theme === 'system' && prefersDark);
    root.classList.toggle('dark', dark);
  }, [theme]);

  return (
    <>
      <AppLayout onOpenSettings={() => setShowSettings(true)}>
        <ChatPanel />
      </AppLayout>
      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}
      <ToolApprovalModal />
      <SkillsModal />
    </>
  );
}
