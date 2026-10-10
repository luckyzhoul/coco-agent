import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SkillInfo } from '../../shared/types';
import { paths, ensureDir } from '../paths';
import { isInside } from '../security/pathPolicy';
import {
  assertSafeSkillName,
  parseSkillFrontmatter,
  projectSkillsDir,
  resolveInsideWorkspace,
  scanSkillsDir
} from './projectSkills';

export class SkillManager {
  private skills: SkillInfo[] = [];

  constructor() {
    this.loadAllSkills();
  }

  getSkillsDir(): string {
    return ensureDir(paths.skillsDir);
  }

  /**
   * Install a skill by copying a directory that contains a SKILL.md file
   * into the global skills directory.
   */
  install(sourceDir: string): SkillInfo {
    const skillMd = path.join(sourceDir, 'SKILL.md');
    if (!fs.existsSync(skillMd)) {
      throw new Error(`Not a valid skill: SKILL.md not found in ${sourceDir}`);
    }

    const content = fs.readFileSync(skillMd, 'utf-8');
    const frontmatter = parseSkillFrontmatter(content);
    const name = frontmatter.name || path.basename(sourceDir);

    const destDir = path.join(this.getSkillsDir(), name);
    if (fs.existsSync(destDir)) {
      fs.rmSync(destDir, { recursive: true, force: true });
    }

    this.copyDir(sourceDir, destDir);
    this.reload();

    const installed = this.skills.find((s) => s.name === name);
    if (!installed) {
      throw new Error(`Skill installed but could not be loaded: ${name}`);
    }
    return installed;
  }

  uninstall(name: string): void {
    const skill = this.skills.find((s) => s.name === name);
    if (!skill) {
      throw new Error(`Skill not found: ${name}`);
    }
    if (skill.source !== 'global') {
      throw new Error(`Only globally installed skills can be removed: ${name}`);
    }
    fs.rmSync(skill.path, { recursive: true, force: true });
    this.reload();
  }

  private copyDir(src: string, dest: string): void {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        this.copyDir(srcPath, destPath);
      } else if (entry.isFile()) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  list(): SkillInfo[] {
    return [...this.skills];
  }

  getContent(name: string): string | null {
    return this.getSkillContent(name);
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
    // Global skills: ${COCO_HOME}/skills
    this.skills = scanSkillsDir(paths.skillsDir, 'global');

    // Built-in skills (bundled with app)
    // For now, we don't have built-in skills, but the structure is here
  }

  // ── Project-space (workspace-level) skills ─────────────────────────────
  //
  // These live at <space>/.coco/skills and apply to every agent while a
  // session is bound to that space — they never go through the per-agent
  // enable/disable registry. They are scanned live on each call so they
  // always follow the app's current project space.

  /** List the current project space's own skills. */
  listProject(workspacePath: string | undefined): SkillInfo[] {
    if (!workspacePath) return [];
    return scanSkillsDir(projectSkillsDir(workspacePath), 'project');
  }

  getProjectContent(name: string, workspacePath: string | undefined): string | null {
    const skill = this.listProject(workspacePath).find((s) => s.name === name);
    if (!skill) return null;
    try {
      const skillMdPath = path.join(skill.path, 'SKILL.md');
      if (fs.existsSync(skillMdPath)) {
        return fs.readFileSync(skillMdPath, 'utf-8');
      }
    } catch {
      // Fall through
    }
    return null;
  }

  /**
   * Install a skill (a directory containing SKILL.md) into the current
   * project space's skills directory. An existing skill with the same name
   * is replaced.
   */
  installToProject(sourceDir: string, workspacePath: string | undefined): SkillInfo {
    if (!workspacePath) {
      throw new Error('尚未选择项目空间');
    }

    const skillMd = path.join(sourceDir, 'SKILL.md');
    if (!fs.existsSync(skillMd)) {
      throw new Error(`不是有效的技能：${sourceDir} 中没有 SKILL.md`);
    }

    const content = fs.readFileSync(skillMd, 'utf-8');
    const frontmatter = parseSkillFrontmatter(content);
    const name = frontmatter.name || path.basename(sourceDir);
    assertSafeSkillName(name);

    // The destination must stay inside the space root, even via symlinks.
    const destDir = resolveInsideWorkspace(
      workspacePath,
      path.join(projectSkillsDir(workspacePath), name)
    );

    if (fs.existsSync(destDir)) {
      fs.rmSync(destDir, { recursive: true, force: true });
    }

    this.copyDir(sourceDir, destDir);

    return {
      name,
      description: frontmatter.description || '',
      path: destDir,
      source: 'project',
      loaded: (frontmatter.description || '').trim() !== ''
    };
  }

  /** Delete a skill from the current project space's skills directory. */
  deleteProject(name: string, workspacePath: string | undefined): SkillInfo[] {
    if (!workspacePath) {
      throw new Error('尚未选择项目空间');
    }

    const root = projectSkillsDir(workspacePath);
    const skill = this.listProject(workspacePath).find((s) => s.name === name);
    if (!skill) {
      throw new Error(`项目空间中未找到技能：${name}`);
    }
    // Defense in depth: the scan already produced a direct child of the
    // skills dir, but never rm anything that resolves outside the space.
    const target = resolveInsideWorkspace(workspacePath, skill.path);
    if (!isInside(root, target)) {
      throw new Error(`非法的技能路径：${name}`);
    }
    fs.rmSync(target, { recursive: true, force: true });
    return this.listProject(workspacePath);
  }
}

export const skillManager = new SkillManager();
