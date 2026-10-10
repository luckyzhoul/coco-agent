import { isAbsolute, relative, resolve, sep } from 'node:path';

/**
 * Path-safety policy math — kept free of Electron imports so it can be
 * unit-tested directly.
 *
 * CocoAgent's security model has two axes:
 *
 * 1. Session permission mode (SecurityLevel) — what happens when the agent
 *    attempts a side effect. Mirrors the four-mode picker in the UI:
 *    只读模式 / 操作前询问 / 自动审核(默认) / 完整权限. Enforcement is
 *    call-time only: every mode keeps all tools assembled (stable prompt
 *    cache) and security/writeGuard decides each call against the live level.
 *
 * 2. Path zones — where a path sits relative to the guarded roots. Reads are
 *    allowed everywhere at every level; writes are confined to the workspace,
 *    user-authorized directories (授权目录), and the COCO_HOME data dir.
 *
 * The Pi SDK runs its built-in file tools in-process, so the strong lever we
 * hold is the operations/spawnHook injection points those tools expose (see
 * writeGuard). PathGuard provides the classification + containment math used
 * by that gate and by any path-aware custom tool.
 */

export type SecurityLevel = 'readonly' | 'ask' | 'auto' | 'full';

export type PathOperation = 'read' | 'write';

export const DEFAULT_SECURITY_LEVEL: SecurityLevel = 'auto';

const LEVELS: SecurityLevel[] = ['readonly', 'ask', 'auto', 'full'];

export function isSecurityLevel(value: unknown): value is SecurityLevel {
  return typeof value === 'string' && (LEVELS as string[]).includes(value);
}

/**
 * Map stored/legacy values onto the four-mode scheme. `workspace` was the
 * old name of what is now `auto` (自动审核); normalization happens on read so
 * existing databases keep working without a migration.
 */
export function normalizeSecurityLevel(value: unknown): SecurityLevel {
  if (value === 'workspace') return 'auto';
  return isSecurityLevel(value) ? value : DEFAULT_SECURITY_LEVEL;
}

/**
 * A directory the user explicitly granted to the agent (授权目录) — an
 * additional root beyond the session workspace and COCO_HOME. `canWrite`
 * false means read-only access inside that root.
 */
export interface AuthorizedRoot {
  path: string;
  canWrite: boolean;
  label?: string;
}

/** Where a path sits relative to the guarded roots. */
export type PathZone = 'workspace' | 'authorized' | 'coco-home' | 'outside';

export interface PathDecision {
  allowed: boolean;
  zone: PathZone;
  /** Populated when not allowed. */
  reason?: string;
}

/**
 * True when `candidate` is inside `root` (or equals it).
 *
 * Uses path.relative so `/foo/barbaz` is correctly NOT inside `/foo/bar`, and
 * normalises away `..`/`.` segments before comparing.
 */
export function isInside(root: string, candidate: string): boolean {
  const rel = relative(resolve(root), resolve(candidate));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

export function classifyPath(
  path: string,
  workspaceRoot: string | null,
  cocoHome: string,
  authorizedRoots: AuthorizedRoot[] = []
): PathZone {
  const abs = resolve(path);
  if (workspaceRoot && isInside(workspaceRoot, abs)) return 'workspace';
  if (authorizedRoots.some((r) => isInside(resolve(r.path), abs))) return 'authorized';
  if (isInside(cocoHome, abs)) return 'coco-home';
  return 'outside';
}

/**
 * Decide whether `op` on `path` is permitted at the given level.
 *
 * - read:   always allowed at every level.
 * - write:  readonly denies everything (writeGuard turns the deny into a
 *           hard error); ask denies pending per-call user confirmation
 *           (writeGuard turns the deny into an approval prompt — an approval
 *           IS the grant); auto allows workspace / coco-home / writable
 *           authorized roots and denies the rest (writeGuard turns THAT deny
 *           into a prompt); full allows anything.
 *
 * Pure callers that don't prompt (the space panel's FileService) treat a deny
 * as a hard refusal, which is why ask denies here rather than allowing.
 *
 * `resolvedPath` lets callers pass an already-symlink-resolved path; the
 * containment check is only as strong as the resolution done upstream.
 */
export function decide(
  level: SecurityLevel,
  op: PathOperation,
  path: string,
  workspaceRoot: string | null,
  cocoHome: string,
  authorizedRoots: AuthorizedRoot[] = []
): PathDecision {
  const zone = classifyPath(path, workspaceRoot, cocoHome, authorizedRoots);

  if (op === 'read') {
    return { allowed: true, zone };
  }

  if (level === 'readonly') {
    return {
      allowed: false,
      zone,
      reason: `当前是只读模式，不允许写入 ${path}。`
    };
  }

  if (level === 'full') {
    return { allowed: true, zone };
  }

  if (level === 'ask') {
    return {
      allowed: false,
      zone,
      reason: `当前是「操作前询问」模式，写入 ${path} 需要用户逐次确认。`
    };
  }

  // auto (自动审核): in-zone writes are regular work, cross-boundary writes
  // are held for user approval by the write gate.
  if (zone === 'workspace' || zone === 'coco-home') {
    return { allowed: true, zone };
  }
  if (zone === 'authorized') {
    const root = authorizedRoots.find((r) => isInside(resolve(r.path), resolve(path)));
    if (root?.canWrite) return { allowed: true, zone };
    return {
      allowed: false,
      zone,
      reason: `${path} 在授权目录中，但该目录被授予的是只读权限。`
    };
  }
  return {
    allowed: false,
    zone,
    reason:
      `写入被限制在项目空间、授权目录和 CocoAgent 数据目录内，${path} 不在其中。` +
      `如需写入该位置，请获得用户批准或让用户在设置中添加授权目录。`
  };
}

/** Guard separator handling for display/debug: root + sep + rest. */
export function joinUnder(root: string, ...parts: string[]): string {
  return [resolve(root), ...parts].join(sep);
}
