import * as fs from 'node:fs';
import { COCO_HOME } from '../paths';
import { settingsManager } from '../settings/SettingsManager';
import { listAuthorizedDirs, addAuthorizedDir, removeAuthorizedDir, setAuthorizedDirCanWrite } from './authorizedDirs';
import {
  decide,
  isSecurityLevel,
  normalizeSecurityLevel,
  type AuthorizedRoot,
  type PathDecision,
  type PathOperation,
  type SecurityLevel
} from './pathPolicy';

/**
 * Process-wide path-safety gate.
 *
 * Holds the configured mode and the current workspace root, resolves symlinks
 * before delegating to the pure policy in pathPolicy, and exposes the
 * decision API used by IPC, custom tools, and the write gate. Also fronts the
 * user-authorized directory registry (授权目录) so callers get one object
 * answering "what may this agent touch".
 */
export class PathGuard {
  private workspaceRoot: string | null = null;

  get level(): SecurityLevel {
    return normalizeSecurityLevel(settingsManager.get().securityLevel);
  }

  setLevel(level: SecurityLevel): void {
    if (!isSecurityLevel(level)) {
      throw new Error(`Unknown security level: ${String(level)}`);
    }
    settingsManager.set({ securityLevel: level });
  }

  /** The session cwd is the write root at `auto` level. */
  setWorkspaceRoot(root: string | null): void {
    this.workspaceRoot = root;
  }

  getWorkspaceRoot(): string | null {
    return this.workspaceRoot;
  }

  listLevels(): SecurityLevel[] {
    return ['readonly', 'ask', 'auto', 'full'];
  }

  // --- 授权目录 (user-granted additional roots) ---

  listAuthorized(): AuthorizedRoot[] {
    return listAuthorizedDirs();
  }

  addAuthorized(path: string, canWrite: boolean, label = ''): AuthorizedRoot[] {
    return addAuthorizedDir(path, canWrite, label);
  }

  removeAuthorized(path: string): AuthorizedRoot[] {
    return removeAuthorizedDir(path);
  }

  setAuthorizedCanWrite(path: string, canWrite: boolean): AuthorizedRoot[] {
    return setAuthorizedDirCanWrite(path, canWrite);
  }

  /**
   * Symlink-resolve then decide. Resolution failures (missing file) fall back
   * to the lexical path so writes to not-yet-existing files still evaluate.
   */
  check(path: string, op: PathOperation): PathDecision {
    let effective = path;
    try {
      effective = fs.realpathSync(path);
    } catch {
      // File does not exist yet (typical for writes) — use the lexical path.
    }
    return decide(this.level, op, effective, this.workspaceRoot, COCO_HOME, this.listAuthorized());
  }
}

export const pathGuard = new PathGuard();
