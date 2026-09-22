import * as fs from 'node:fs';
import { COCO_HOME } from '../paths';
import { settingsManager } from '../settings/SettingsManager';
import {
  decide,
  DEFAULT_SECURITY_LEVEL,
  type PathDecision,
  type PathOperation,
  type SecurityLevel
} from './pathPolicy';

const LEVELS: SecurityLevel[] = ['readonly', 'workspace', 'full'];

function isSecurityLevel(value: unknown): value is SecurityLevel {
  return typeof value === 'string' && (LEVELS as string[]).includes(value);
}

/**
 * Process-wide path-safety gate.
 *
 * Holds the configured level and the current workspace root, resolves
 * symlinks before delegating to the pure policy in pathPolicy, and exposes
 * the decision API used by IPC, custom tools, and session setup.
 */
export class PathGuard {
  private workspaceRoot: string | null = null;

  get level(): SecurityLevel {
    const configured = settingsManager.get().securityLevel;
    return isSecurityLevel(configured) ? configured : DEFAULT_SECURITY_LEVEL;
  }

  setLevel(level: SecurityLevel): void {
    if (!isSecurityLevel(level)) {
      throw new Error(`Unknown security level: ${String(level)}`);
    }
    settingsManager.set({ securityLevel: level });
  }

  /** The session cwd is the write root at `workspace` level. */
  setWorkspaceRoot(root: string | null): void {
    this.workspaceRoot = root;
  }

  getWorkspaceRoot(): string | null {
    return this.workspaceRoot;
  }

  listLevels(): SecurityLevel[] {
    return [...LEVELS];
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
    return decide(this.level, op, effective, this.workspaceRoot, COCO_HOME);
  }
}

export const pathGuard = new PathGuard();
