import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { skillManager } from './SkillManager';
import type { SkillInfo } from '../../shared/types';

const execFileAsync = promisify(execFile);

export interface CatalogEntry {
  name: string;
  description: string;
  /** Archive URL, git URL, or local path. */
  source: string;
  version?: string;
  author?: string;
}

export interface SkillCatalog {
  name: string;
  skills: CatalogEntry[];
}

function tempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `cocoagent-${prefix}-`));
}

function rmrf(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // best effort
  }
}

/** Depth-first search for the shallowest directory containing a SKILL.md. */
function findSkillRoot(dir: string): string | null {
  if (fs.existsSync(path.join(dir, 'SKILL.md'))) return dir;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === '__MACOSX' || entry.name.startsWith('.')) continue;
    const found = findSkillRoot(path.join(dir, entry.name));
    if (found) return found;
  }
  return null;
}

export class SkillInstaller {
  /** Extract .zip / .tar.gz / .tgz using system tools, then install the skill inside. */
  async installFromArchive(archivePath: string): Promise<SkillInfo> {
    if (!fs.existsSync(archivePath)) {
      throw new Error(`Archive not found: ${archivePath}`);
    }

    const work = tempDir('archive');
    try {
      const lower = archivePath.toLowerCase();
      if (lower.endsWith('.zip')) {
        await this.extractZip(archivePath, work);
      } else if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz') || lower.endsWith('.tar')) {
        await execFileAsync('tar', ['-xf', archivePath, '-C', work]);
      } else {
        throw new Error('Unsupported archive type. Use .zip, .tar.gz, or .tgz');
      }

      const root = findSkillRoot(work);
      if (!root) {
        throw new Error('No SKILL.md found inside the archive.');
      }
      return skillManager.install(root);
    } finally {
      rmrf(work);
    }
  }

  private async extractZip(archivePath: string, dest: string): Promise<void> {
    if (process.platform === 'win32') {
      await execFileAsync('powershell', [
        '-NoProfile',
        '-Command',
        `Expand-Archive -LiteralPath '${archivePath}' -DestinationPath '${dest}' -Force`
      ]);
      return;
    }
    try {
      await execFileAsync('unzip', ['-o', '-q', archivePath, '-d', dest]);
    } catch (err) {
      // bsdtar (macOS, many Linux distros) handles zip too.
      try {
        await execFileAsync('tar', ['-xf', archivePath, '-C', dest]);
      } catch {
        throw new Error(
          `Could not extract zip. Install "unzip" (e.g. sudo apt install unzip). Original error: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }
  }

  /** Clone a git repository and install the skill found inside. */
  async installFromGit(url: string): Promise<SkillInfo> {
    const work = tempDir('git');
    try {
      try {
        await execFileAsync('git', ['clone', '--depth', '1', url, work], {
          maxBuffer: 16 * 1024 * 1024
        });
      } catch (err) {
        throw new Error(
          `git clone failed. Is git installed and the URL reachable? ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }

      const root = findSkillRoot(work);
      if (!root) {
        throw new Error('No SKILL.md found in the repository.');
      }
      return skillManager.install(root);
    } finally {
      rmrf(work);
    }
  }

  /** Download a remote archive and install it. */
  async installFromUrl(url: string): Promise<SkillInfo> {
    const work = tempDir('download');
    const isZip = url.toLowerCase().includes('.zip');
    const target = path.join(work, isZip ? 'skill.zip' : 'skill.tar.gz');

    try {
      const resp = await fetch(url, { redirect: 'follow' });
      if (!resp.ok) {
        throw new Error(`Download failed (HTTP ${resp.status}) for ${url}`);
      }
      const buffer = Buffer.from(await resp.arrayBuffer());
      fs.writeFileSync(target, buffer);
      return await this.installFromArchive(target);
    } finally {
      rmrf(work);
    }
  }

  /** Install from any supported source string. */
  async installFromSource(source: string): Promise<SkillInfo> {
    const trimmed = source.trim();

    if (/^https?:\/\//i.test(trimmed) && /\.(zip|tar\.gz|tgz|tar)$/i.test(trimmed)) {
      return this.installFromUrl(trimmed);
    }
    if (/^git\+/i.test(trimmed)) {
      return this.installFromGit(trimmed.replace(/^git\+/i, ''));
    }
    if (/^(https?:\/\/|git@)/i.test(trimmed) && /\.git$/i.test(trimmed)) {
      return this.installFromGit(trimmed);
    }
    if (/^https?:\/\//i.test(trimmed)) {
      // GitHub-style repo URL without .git — treat as git.
      return this.installFromGit(trimmed);
    }

    const stat = fs.existsSync(trimmed) ? fs.statSync(trimmed) : null;
    if (stat?.isDirectory()) {
      return skillManager.install(trimmed);
    }
    if (stat?.isFile()) {
      return this.installFromArchive(trimmed);
    }

    throw new Error(`Unrecognized skill source: ${source}`);
  }

  /** Fetch and validate a remote skill catalog JSON document. */
  async fetchCatalog(registryUrl: string): Promise<SkillCatalog> {
    let resp: Response;
    try {
      resp = await fetch(registryUrl, { redirect: 'follow' });
    } catch (err) {
      throw new Error(
        `Could not reach the skill registry. Check the URL and your network. ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    if (!resp.ok) {
      throw new Error(`Registry returned HTTP ${resp.status}`);
    }

    const json = (await resp.json()) as Partial<SkillCatalog>;
    if (!json || !Array.isArray(json.skills)) {
      throw new Error('Registry JSON must contain a "skills" array.');
    }

    const skills = json.skills.filter(
      (s): s is CatalogEntry =>
        !!s && typeof s.name === 'string' && typeof s.source === 'string'
    );

    return { name: json.name || 'Skill Registry', skills };
  }
}

export const skillInstaller = new SkillInstaller();
