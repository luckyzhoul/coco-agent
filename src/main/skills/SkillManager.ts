import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';
import type { SkillInfo } from '../../shared/types';

interface SkillFrontmatter {
  name?: string;
  description?: string;
}

export class SkillManager {
  private skills: SkillInfo[] = [];

  constructor() {
    this.loadAllSkills();
  }

  list(): SkillInfo[] {
    return [...this.skills];
  }

  getDetail(name: string): SkillInfo | null {
    return this.skills.find(s => s.name === name) || null;
  }

  getSkillContent(name: string): string | null {
    const skill = this.skills.find(s => s.name === name);
    if (!skill) return null;

    try {
      const skillPath = path.join(skill.path, 'SKILL.md');
      if (fs.existsSync(skillPath)) {
        return fs.readFileSync(skillPath, 'utf-8');
      }
    } catch {
      // Fall through
    }
    return null;
  }

  reload(): SkillInfo[] {
    this.skills = [];
    this.loadAllSkills();
    return [...this.skills];
  }

  private loadAllSkills(): void {
    // Global skills: ~/.cocoagent/skills
    const globalDir = path.join(app.getPath('userData'), 'cocoagent', 'skills');
    this.loadSkillsFromDir(globalDir, 'global');

    // Built-in skills (bundled with app)
    // For now, we don't have built-in skills, but the structure is here
  }

  private loadSkillsFromDir(dir: string, source: SkillInfo['source']): void {
    if (!fs.existsSync(dir)) return;

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillPath = path.join(dir, entry.name);
        const skillMdPath = path.join(skillPath, 'SKILL.md');

        if (!fs.existsSync(skillMdPath)) continue;

        try {
          const content = fs.readFileSync(skillMdPath, 'utf-8');
          const frontmatter = this.parseFrontmatter(content);

          const skill: SkillInfo = {
            name: frontmatter.name || entry.name,
            description: frontmatter.description || '',
            path: skillPath,
            source,
            loaded: true
          };

          // Avoid duplicates
          if (!this.skills.some(s => s.name === skill.name)) {
            this.skills.push(skill);
          }
        } catch {
          // Skip invalid skills
        }
      }
    } catch {
      // Directory read failed, skip
    }
  }

  private parseFrontmatter(content: string): SkillFrontmatter {
    const frontmatter: SkillFrontmatter = {};

    // Match YAML frontmatter between --- delimiters
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) return frontmatter;

    const yamlContent = match[1];
    const lines = yamlContent.split('\n');

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();

      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (key === 'name') frontmatter.name = value;
      if (key === 'description') frontmatter.description = value;
    }

    return frontmatter;
  }
}

export const skillManager = new SkillManager();
