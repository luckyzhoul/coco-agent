import { useState } from 'react';
import { useSettingsStore } from '../../stores/useSettingsStore';
import type { SkillInfo } from '@shared/types';

export function SkillsSettings() {
  const skills = useSettingsStore((s) => s.skills);
  const loadSkills = useSettingsStore((s) => s.loadSkills);
  const [detail, setDetail] = useState<{ skill: SkillInfo; content: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sourceLabels: Record<string, string> = {
    'built-in': 'Built-in',
    'global': 'Global',
    'project': 'Project'
  };

  const handleInstall = async () => {
    setError(null);
    try {
      const result = await window.electronAPI.skills.install();
      if (result) {
        await loadSkills();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleUninstall = async (name: string) => {
    setError(null);
    try {
      await window.electronAPI.skills.uninstall(name);
      await loadSkills();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleView = async (skill: SkillInfo) => {
    const content = await window.electronAPI.skills.getContent(skill.name);
    setDetail({ skill, content: content || '(no content)' });
  };

  const handleOpenDir = async () => {
    await window.electronAPI.skills.openDir();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-medium mb-1">Skills</h3>
          <p className="text-sm text-muted-foreground">
            Extend agent capabilities with specialized skills.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleOpenDir}
            className="px-3 py-1.5 rounded-md text-sm border border-input hover:bg-accent transition-colors"
          >
            Open Folder
          </button>
          <button
            onClick={loadSkills}
            className="px-3 py-1.5 rounded-md text-sm border border-input hover:bg-accent transition-colors"
          >
            ↻ Reload
          </button>
          <button
            onClick={handleInstall}
            className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm hover:opacity-90 transition-opacity"
          >
            + Install Skill
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Skills directory hint */}
      <div className="bg-background border border-border rounded-lg p-4">
        <div className="text-sm font-medium mb-2">How to add skills</div>
        <p className="text-xs text-muted-foreground mb-2">
          Each skill is a folder containing a <code className="bg-muted px-1 rounded">SKILL.md</code> file
          with <code className="bg-muted px-1 rounded">name</code> and{' '}
          <code className="bg-muted px-1 rounded">description</code> frontmatter. Skills are loaded from:
        </p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li><code className="bg-muted px-1 rounded">~/.cocoagent/skills/</code> (global — managed here)</li>
          <li><code className="bg-muted px-1 rounded">&lt;workspace&gt;/.cocoagent/skills/</code> (project)</li>
        </ul>
      </div>

      {/* Skills list */}
      <div className="space-y-2">
        <div className="text-sm font-medium">Installed Skills ({skills.length})</div>
        {skills.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm bg-background border border-border rounded-lg">
            No skills found. Click "Install Skill" to add one.
          </div>
        ) : (
          <div className="space-y-2">
            {skills.map((skill) => (
              <div
                key={skill.name}
                className="p-3 rounded-lg border border-border bg-background"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{skill.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {skill.description || 'No description'}
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
                      View
                    </button>
                    {skill.source === 'global' && (
                      <button
                        onClick={() => handleUninstall(skill.name)}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
          <div className="bg-card border border-border rounded-lg w-[700px] max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h3 className="text-base font-semibold">{detail.skill.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {detail.skill.path}
                </p>
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
