import { shell } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { FileEntry, FileReadResult, FileWriteResult } from '../../shared/types';
import { pathGuard } from '../security/PathGuard';
import { decide, isInside } from '../security/pathPolicy';
import { COCO_HOME } from '../paths';
import { workspaceManager } from './WorkspaceManager';
import { looksBinary, realpathParent } from './spacePaths';

const MAX_PREVIEW_BYTES = 2 * 1024 * 1024;
const BINARY_HEAD_BYTES = 4096;
const MTIME_TOLERANCE_MS = 1;

/**
 * Read/write access to the current project space for the renderer's space
 * panel. Every path is resolved inside the space first, then cleared by
 * PathGuard so the security level still governs writes.
 */
export class FileService {
  /**
   * The directory the panel browses.
   *
   * PathGuard holds the *session's* root and is only set once a session
   * exists; before that (fresh launch, no session yet) the app still has a
   * current project space, so fall back to it.
   */
  private rootDir(): string {
    const root = pathGuard.getWorkspaceRoot() ?? workspaceManager.getCurrent()?.path;
    if (!root) throw new Error('尚未选择项目空间');
    try {
      return fs.realpathSync(root);
    } catch {
      return root;
    }
  }

  /** Symlink-resolved path; falls back to the lexical path for missing files. */
  private effectivePath(abs: string): string {
    try {
      return fs.realpathSync(abs);
    } catch {
      return realpathParent(abs);
    }
  }

  /**
   * Resolve `input` (absolute or space-relative) and reject anything that
   * lands outside the space — including via a symlinked parent directory.
   */
  private resolveInside(input: string): string {
    const root = this.rootDir();
    const abs = path.resolve(root, input || '.');
    if (!isInside(root, this.effectivePath(abs))) {
      throw new Error('该路径不在当前项目空间内，已拒绝访问');
    }
    return abs;
  }

  listFiles(input: string): FileEntry[] {
    const dir = this.resolveInside(input);
    let dirents: fs.Dirent[];
    try {
      dirents = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      throw new Error(`无法读取目录：${dir}`);
    }

    const entries: FileEntry[] = dirents.map((dirent) => {
      const full = path.join(dir, dirent.name);
      let isDir = dirent.isDirectory();
      let size = 0;
      let mtime = 0;
      try {
        const stat = fs.statSync(full);
        isDir = stat.isDirectory();
        size = stat.size;
        mtime = stat.mtimeMs;
      } catch {
        // Unreadable entry (broken symlink, permissions) — list it anyway.
      }
      return { name: dirent.name, path: full, isDir, size, mtime };
    });

    return entries.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name, 'zh-Hans-CN');
    });
  }

  readFile(input: string): FileReadResult {
    const abs = this.resolveInside(input);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(abs);
    } catch {
      throw new Error(`文件不存在：${abs}`);
    }
    if (!stat.isFile()) throw new Error('目标不是文件');

    const mtime = stat.mtimeMs;
    if (stat.size > MAX_PREVIEW_BYTES) {
      return { path: abs, content: '', binary: false, tooLarge: true, mtime };
    }

    const buffer = fs.readFileSync(abs);
    if (looksBinary(buffer.subarray(0, BINARY_HEAD_BYTES), path.extname(abs))) {
      return { path: abs, content: '', binary: true, tooLarge: false, mtime };
    }

    return { path: abs, content: buffer.toString('utf8'), binary: false, tooLarge: false, mtime };
  }

  writeFile(input: string, content: string, expectedMtime?: number): FileWriteResult {
    const abs = this.resolveInside(input);

    // Decide against the space the panel is actually browsing. PathGuard's
    // own root is the *session's* root and is unset until a session exists,
    // which would wrongly classify an in-space write as "outside".
    const decision = decide(pathGuard.level, 'write', this.effectivePath(abs), this.rootDir(), COCO_HOME);
    if (!decision.allowed) {
      throw new Error(decision.reason || '当前安全级别不允许写入文件');
    }

    // Guard against silently clobbering an edit the agent made meanwhile.
    if (typeof expectedMtime === 'number' && expectedMtime > 0) {
      let current: number | null = null;
      try {
        current = fs.statSync(abs).mtimeMs;
      } catch {
        current = null;
      }
      if (current !== null && Math.abs(current - expectedMtime) > MTIME_TOLERANCE_MS) {
        throw new Error('文件已被修改，请重新打开后再保存');
      }
    }

    fs.writeFileSync(abs, content, 'utf8');
    return { path: abs, mtime: fs.statSync(abs).mtimeMs };
  }

  async openInOS(input: string): Promise<void> {
    const abs = this.resolveInside(input);
    const error = await shell.openPath(abs);
    if (error) throw new Error(error);
  }
}

export const fileService = new FileService();
