import { useEffect, useState } from 'react';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useAgentEvent } from '../../hooks/useIpcRenderer';
import type { UpdateStatus } from '@shared/types';

export function UpdateSettings() {
  const settings = useSettingsStore((s) => s.settings);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [feedUrl, setFeedUrl] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.electronAPI.update.getStatus().then(setStatus).catch(() => {});
  }, []);

  useEffect(() => {
    if (settings) setFeedUrl(settings.updateFeedUrl || '');
  }, [settings]);

  useAgentEvent('updateStatus', (s: UpdateStatus) => {
    setStatus(s);
  });

  const handleSaveFeed = async () => {
    await window.electronAPI.settings.set({ updateFeedUrl: feedUrl.trim() });
    await window.electronAPI.update.setFeed(feedUrl.trim());
    await loadSettings();
  };

  const handleCheck = async () => {
    setBusy(true);
    try {
      const s = await window.electronAPI.update.check();
      setStatus(s);
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    setBusy(true);
    try {
      const s = await window.electronAPI.update.download();
      setStatus(s);
    } finally {
      setBusy(false);
    }
  };

  const stateColor: Record<string, string> = {
    idle: 'text-muted-foreground',
    checking: 'text-blue-400',
    available: 'text-yellow-400',
    'up-to-date': 'text-green-400',
    downloading: 'text-blue-400',
    downloaded: 'text-green-400',
    error: 'text-red-400',
    unavailable: 'text-muted-foreground'
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-medium mb-1">Updates</h3>
        <p className="text-sm text-muted-foreground">
          CocoAgent checks GitHub Releases for new versions.
        </p>
      </div>

      {/* Status card */}
      <div className="bg-background border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm">
              Current version:{' '}
              <span className="font-mono">{status?.currentVersion || '—'}</span>
            </div>
            <div className={`text-sm mt-1 ${stateColor[status?.state || 'idle'] || ''}`}>
              {status?.message || 'Ready.'}
            </div>
            {status && !status.packaged && (
              <div className="text-xs text-muted-foreground mt-1">
                Auto-update is disabled in development builds.
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {status?.state === 'downloaded' ? (
              <button
                onClick={() => window.electronAPI.update.quitAndInstall()}
                className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm hover:opacity-90 transition-opacity"
              >
                Restart & Install
              </button>
            ) : status?.state === 'available' ? (
              <button
                onClick={handleDownload}
                disabled={busy}
                className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {busy ? 'Downloading…' : 'Download Update'}
              </button>
            ) : (
              <button
                onClick={handleCheck}
                disabled={busy || !status?.packaged}
                className="px-3 py-1.5 rounded-md text-sm border border-input hover:bg-accent disabled:opacity-50 transition-colors"
              >
                {busy ? 'Checking…' : 'Check for Updates'}
              </button>
            )}
          </div>
        </div>

        {status?.state === 'downloading' && typeof status.percent === 'number' && (
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-primary h-full transition-all"
              style={{ width: `${status.percent}%` }}
            />
          </div>
        )}
      </div>

      {/* Feed override */}
      <div className="bg-background border border-border rounded-lg p-4 space-y-3">
        <div className="text-sm font-medium">Custom Update Feed</div>
        <p className="text-xs text-muted-foreground">
          Leave empty to use the default GitHub Releases feed. Set a URL to use a self-hosted
          generic feed (the server must expose <code className="bg-muted px-1 rounded">latest-linux.yml</code>{' '}
          and the matching artifacts).
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={feedUrl}
            onChange={(e) => setFeedUrl(e.target.value)}
            placeholder="https://updates.example.com/cocoagent"
            className="flex-1 bg-background border border-input rounded-md px-3 py-1.5 text-sm"
          />
          <button
            onClick={handleSaveFeed}
            className="px-3 py-1.5 rounded-md text-sm border border-input hover:bg-accent transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
