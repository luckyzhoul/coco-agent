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
    checking: 'text-primary',
    available: 'text-amber-600',
    'up-to-date': 'text-emerald-600',
    downloading: 'text-primary',
    downloaded: 'text-emerald-600',
    error: 'text-destructive',
    unavailable: 'text-muted-foreground'
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-medium mb-1">更新</h3>
        <p className="text-sm text-muted-foreground">
          CocoAgent 会从 GitHub Releases 检查新版本。
        </p>
      </div>

      {/* Status card */}
      <div className="bg-background border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm">
              当前版本：{' '}
              <span className="font-mono">{status?.currentVersion || '—'}</span>
            </div>
            <div className={`text-sm mt-1 ${stateColor[status?.state || 'idle'] || ''}`}>
              {status?.message || '就绪。'}
            </div>
            {status && !status.packaged && (
              <div className="text-xs text-muted-foreground mt-1">
                开发版本中已禁用自动更新。
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {status?.state === 'downloaded' ? (
              <button
                onClick={() => window.electronAPI.update.quitAndInstall()}
                className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm hover:opacity-90 transition-opacity"
              >
                重启并安装
              </button>
            ) : status?.state === 'available' ? (
              <button
                onClick={handleDownload}
                disabled={busy}
                className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {busy ? '下载中…' : '下载更新'}
              </button>
            ) : (
              <button
                onClick={handleCheck}
                disabled={busy || !status?.packaged}
                className="px-3 py-1.5 rounded-md text-sm border border-input hover:bg-accent disabled:opacity-50 transition-colors"
              >
                {busy ? '检查中…' : '检查更新'}
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
        <div className="text-sm font-medium">自定义更新源</div>
        <p className="text-xs text-muted-foreground">
          留空则使用默认的 GitHub Releases 源。填入 URL 可使用自建的通用源（服务器需提供{' '}
          <code className="bg-muted px-1 rounded">latest-linux.yml</code>{' '}
          及对应的构建产物）。
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
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
