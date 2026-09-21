import React from 'react';
import { useSettingsStore } from '../../stores/useSettingsStore';

export function SkillsSettings() {
  const skills = useSettingsStore((s) => s.skills);
  const loadSkills = useSettingsStore((s) => s.loadSkills);

  const sourceLabels: Record<string, string> = {
    'built-in': 'Built-in',
    'global': 'Global',
    'project': 'Project'
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
        <button
          onClick={loadSkills}
          className="px-3 py-1.5 rounded-md text-sm border border-input hover:bg-accent transition-colors"
        >
          ↻ Reload
        </button>
      </div>

      {/* Skills directory hint */}
      <div className="bg-background border border-border rounded-lg p-4">
        <div className="text-sm font-medium mb-2">Install Skills</div>
        <p className="text-xs text-muted-foreground mb-2">
          Skills are loaded from these directories:
        </p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li><code className="bg-muted px-1 rounded">~/.cocoagent/skills/</code> (global)</li>
          <li><code className="bg-muted px-1 rounded">.cocoagent/skills/</code> in your workspace (project)</li>
        </ul>
        <p className="text-xs text-muted-foreground mt-2">
          Each skill is a directory containing a <code className="bg-muted px-1 rounded">SKILL.md</code> file.
        </p>
      </div>

      {/* Skills list */}
      <div className="space-y-2">
        <div className="text-sm font-medium">Available Skills</div>
        {skills.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm bg-background border border-border rounded-lg">
            No skills found. Add skills to the directories above.
          </div>
        ) : (
          <div className="space-y-2">
            {skills.map((skill) => (
              <div
                key={skill.name}
                className="p-3 rounded-lg border border-border bg-background"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium">{skill.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {skill.description || 'No description'}
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                    {sourceLabels[skill.source] || skill.source}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
