import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SkillInfo } from '../../shared/types';
import { isInside } from '../security/pathPolicy';
import { realpathParent } from '../workspace/spacePaths';

/**
 * Project-space (workspace-level) skill helpers — no Electron imports so
 * they can be unit-tested directly (scripts/test-skills.ts).
 *
 * Convention: a project space keeps its own skills at `<space>/.coco/skills`,
 * loaded automatically for every agent while a session is bound to that
 * space. The `.coco` directory may later hold other space-scoped config.
 */

/** The workspace-level skills directory for a project space. */
export function projectSkillsDir(workspacePath: string): string {
  return path.join(workspacePath, '.coco', 'skills');
}

export interface SkillFrontmatter {
  name?: string;
  description?: string;
}

/** Parse the leading YAML frontmatter of a SKILL.md (flat key: value pairs). */
export function parseSkillFrontmatter(content: string): SkillFrontmatter {
  const frontmatter: SkillFrontmatter = {};

  // Match YAML frontmatter between --- delimiters
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return frontmatter;

  const lines = match[1].split('\n');
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

/**
 * Scan `dir` for direct child directories containing a SKILL.md.
 * Invalid entries are skipped; a skill without a description is reported as
 * not loaded — Pi drops it from the agent's prompt anyway.
 */
export function scanSkillsDir(dir: string, source: SkillInfo['source']): SkillInfo[] {
  const skills: SkillInfo[] = [];
  if (!fs.existsSync(dir)) return skills;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return skills;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillPath = path.join(dir, entry.name);
    const skillMdPath = path.join(skillPath, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) continue;

    try {
      const content = fs.readFileSync(skillMdPath, 'utf-8');
      const frontmatter = parseSkillFrontmatter(content);
      const description = frontmatter.description || '';

      skills.push({
        name: frontmatter.name || entry.name,
        description,
        path: skillPath,
        source,
        loaded: description.trim() !== ''
      });
    } catch {
      // Skip unreadable skills
    }
  }

  return skills;
}

/**
 * Reject names that could escape the skills directory when used as a single
 * path segment (install destination).
 */
export function assertSafeSkillName(name: string): void {
  if (!name || name === '.' || name === '..' || name.startsWith('.') ||
      /[/\\]/.test(name) || name.includes('\0')) {
    throw new Error(`非法的技能名：${name}`);
  }
}

/**
 * Resolve `target` under the project space `root` and reject anything that
 * lands outside it — including via a symlinked directory. Mirrors
 * FileService.resolveInside so every project-skill filesystem mutation is
 * confined to the space root.
 */
export function resolveInsideWorkspace(root: string, target: string): string {
  let realRoot = root;
  try {
    realRoot = fs.realpathSync(root);
  } catch {
    // Keep the lexical root; the isInside check below still rejects escapes.
  }
  const abs = path.resolve(realRoot, target);
  const effective = fs.existsSync(abs) ? realpathParent(abs) : abs;
  if (!isInside(realRoot, effective)) {
    throw new Error('该路径不在当前项目空间内，已拒绝访问');
  }
  return abs;
}
