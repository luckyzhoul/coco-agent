import { useEffect, useState } from 'react';
import { useSettingsStore } from '../../stores/useSettingsStore';
import type { SkillInfo } from '@shared/types';

interface CatalogEntry {
  name: string;
  description: string;
  source: string;
  version?: string;
  author?: string;
}

type Tab = 'installed' | 'marketplace';

export function SkillsSettings() {
  const skills = useSettingsStore((s) => s.skills);
  const loadSkills = useSettingsStore((s) => s.loadSkills);
  const settings = useSettingsStore((s) => s.settings);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  const [tab, setTab] = useState<Tab>('installed');
  const [detail, setDetail] = useState<{ skill: SkillInfo; content: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Marketplace state
  const [registryUrl, setRegistryUrl] = useState('');
  const [catalog, setCatalog] = useState<{ name: string; skills: CatalogEntry[] } | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [sourceInput, setSourceInput] = useState('');

  useEffect(() => {
    if (settings) setRegistryUrl(settings.skillRegistryUrl || '');
  }, [settings]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setError(null);
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const handleInstallFolder = () =>
    run('folder', async () => {
      const result = await window.electronAPI.skills.install();
      if (result) await loadSkills();
    });

  const handleInstallSource = () =>
    run('source', async () => {
      if (!sourceInput.trim()) return;
      await window.electronAPI.skills.installFromSource(sourceInput.trim());
      setSourceInput('');
      await loadSkills();
    });

  const handleUninstall = (name: string) =>
    run(`uninstall:${name}`, async () => {
      await window.electronAPI.skills.uninstall(name);
      await loadSkills();
    });

  const handleView = async (skill: SkillInfo) => {
    const content = await window.electronAPI.skills.getContent(skill.name);
    setDetail({ skill, content: content || '(no content)' });
  };

  const handleOpenDir = () => window.electronAPI.skills.openDir();

  const handleSaveRegistry = () =>
    run('saveRegistry', async () => {
      await window.electronAPI.settings.set({ skillRegistryUrl: registryUrl.trim() });
      await loadSettings();
    });

  const handleLoadCatalog = () => {
    setCatalogError(null);
    setLoadingCatalog(true);
    window.electronAPI.skills
      .fetchCatalog(registryUrl.trim())
      .then(setCatalog)
      .catch((err) => setCatalogError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoadingCatalog(false));
  };

  const handleCatalogInstall = (entry: CatalogEntry) =>
    run(`catalog:${entry.name}`, async () => {
      await window.electronAPI.skills.installFromCatalog(entry.source);
      await loadSkills();
    });

  const sourceLabels: Record<string, string> = {
    'built-in': '内置',
    'global': '全局',
    'project': '项目'
  };

  const installedNames = new Set(skills.map((s) => s.name));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-medium mb-1">技能</h3>
        <p className="text-sm text-muted-foreground">
          通过专用技能扩展 Agent 的能力。
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['installed', 'marketplace'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'installed' ? `已安装（${skills.length}）` : '技能市场'}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {tab === 'installed' && (
        <>
          <div className="flex gap-2">
            <button
              onClick={handleOpenDir}
              className="px-3 py-1.5 rounded-md text-sm border border-input hover:bg-accent transition-colors"
            >
              打开文件夹
            </button>
            <button
              onClick={loadSkills}
              className="px-3 py-1.5 rounded-md text-sm border border-input hover:bg-accent transition-colors"
            >
              ↻ 重新加载
            </button>
            <button
              onClick={handleInstallFolder}
              disabled={busy === 'folder'}
              className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {busy === 'folder' ? '安装中…' : '+ 从文件夹安装'}
            </button>
          </div>

          {/* Install from source */}
          <div className="bg-background border border-border rounded-lg p-4">
            <div className="text-sm font-medium mb-2">从 URL 或路径安装</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={sourceInput}
                onChange={(e) => setSourceInput(e.target.value)}
                placeholder="https://github.com/user/my-skill  ·  ./local/skill  ·  skill.tar.gz"
                className="flex-1 bg-background border border-input rounded-md px-3 py-1.5 text-sm"
              />
              <button
                onClick={handleInstallSource}
                disabled={!sourceInput.trim() || busy === 'source'}
                className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {busy === 'source' ? '安装中…' : '安装'}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              支持 git 仓库、<code className="bg-muted px-1 rounded">.zip</code> /{' '}
              <code className="bg-muted px-1 rounded">.tar.gz</code> 压缩包和本地文件夹。
              压缩包或仓库中必须包含 <code className="bg-muted px-1 rounded">SKILL.md</code>。
            </p>
          </div>

          <div className="bg-background border border-border rounded-lg p-4">
            <div className="text-sm font-medium mb-2">技能位置</div>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li><code className="bg-muted px-1 rounded">{`${'{COCO_HOME}'}/skills/`}</code>（全局 — 在此管理，默认 <code>~/.coco</code>）</li>
              <li><code className="bg-muted px-1 rounded">&lt;workspace&gt;/.coco/skills/</code>（项目）</li>
            </ul>
          </div>

          {/* Skills list */}
          <div className="space-y-2">
            {skills.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm bg-background border border-border rounded-lg">
                尚未安装任何技能。
              </div>
            ) : (
              skills.map((skill) => (
                <div key={skill.name} className="p-3 rounded-lg border border-border bg-background">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{skill.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {skill.description || '无描述'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                        {sourceLabels[skill.source] || skill.source}
                      </span>
                      <button
                        onClick={() => handleView(skill)}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        查看
                      </button>
                      {skill.source === 'global' && (
                        <button
                          onClick={() => handleUninstall(skill.name)}
                          disabled={busy === `uninstall:${skill.name}`}
                          className="text-xs text-destructive hover:text-destructive/80 disabled:opacity-50 transition-colors"
                        >
                          移除
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {tab === 'marketplace' && (
        <>
          {/* Registry config */}
          <div className="bg-background border border-border rounded-lg p-4 space-y-3">
            <div className="text-sm font-medium">技能仓库</div>
            <p className="text-xs text-muted-foreground">
              指向一个列出可用技能的 JSON 目录。目录格式为{' '}
              <code className="bg-muted px-1 rounded">{'{ "skills": [{ "name", "description", "source" }] }'}</code>.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={registryUrl}
                onChange={(e) => setRegistryUrl(e.target.value)}
                placeholder="https://example.com/cocoagent-skills.json"
                className="flex-1 bg-background border border-input rounded-md px-3 py-1.5 text-sm"
              />
              <button
                onClick={handleSaveRegistry}
                disabled={busy === 'saveRegistry'}
                className="px-3 py-1.5 rounded-md text-sm border border-input hover:bg-accent disabled:opacity-50 transition-colors"
              >
                保存
              </button>
              <button
                onClick={handleLoadCatalog}
                disabled={!registryUrl.trim() || loadingCatalog}
                className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {loadingCatalog ? '加载中…' : '浏览'}
              </button>
            </div>
          </div>

          {catalogError && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
              {catalogError}
            </div>
          )}

          {!registryUrl.trim() && (
            <div className="text-center py-8 text-muted-foreground text-sm bg-background border border-border rounded-lg">
              在上方设置仓库 URL 即可浏览可用技能。
            </div>
          )}

          {catalog && (
            <div className="space-y-2">
              <div className="text-sm font-medium">
                {catalog.name} — {catalog.skills.length} 个可用
              </div>
              {catalog.skills.map((entry) => (
                <div
                  key={entry.name}
                  className="p-3 rounded-lg border border-border bg-background"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium flex items-center gap-2">
                        {entry.name}
                        {entry.version && (
                          <span className="text-xs text-muted-foreground">v{entry.version}</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {entry.description}
                      </div>
                      {entry.author && (
                        <div className="text-xs text-muted-foreground/70 mt-0.5">
                          作者 {entry.author}
                        </div>
                      )}
                    </div>
                    {installedNames.has(entry.name) ? (
                      <span className="text-xs text-primary shrink-0">已安装</span>
                    ) : (
                      <button
                        onClick={() => handleCatalogInstall(entry)}
                        disabled={busy === `catalog:${entry.name}`}
                        className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-xs hover:opacity-90 disabled:opacity-50 shrink-0 transition-opacity"
                      >
                        {busy === `catalog:${entry.name}` ? '安装中…' : '安装'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
          <div className="bg-card border border-border rounded-lg w-[700px] max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h3 className="text-base font-semibold">{detail.skill.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{detail.skill.path}</p>
              </div>
              <button
                onClick={() => setDetail(null)}
                className="text-muted-foreground hover:text-foreground text-xl"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <pre className="text-xs font-mono whitespace-pre-wrap bg-background border border-border rounded-md p-3">
                {detail.content}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
