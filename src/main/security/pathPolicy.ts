import { isAbsolute, relative, resolve, sep } from 'node:path';

/**
 * Path-safety policy math — kept free of Electron imports so it can be
 * unit-tested directly.
 *
 * CocoAgent's security levels map to what the app can actually enforce:
 * the Pi SDK runs its built-in read/write/edit/bash tools in-process, so the
 * strong lever we hold is which tools a session gets at all (see
 * AgentRuntime). PathGuard provides the classification + containment math
 * used by that decision and by any path-aware custom tool.
 */

export type SecurityLevel = 'readonly' | 'workspace' | 'full';

export type PathOperation = 'read' | 'write';

/** Tools that can modify the filesystem and are dropped in readonly mode. */
export const WRITE_CAPABLE_TOOLS = ['write', 'edit', 'bash'] as const;

export const DEFAULT_SECURITY_LEVEL: SecurityLevel = 'workspace';

/** Where a path sits relative to the guarded roots. */
export type PathZone = 'workspace' | 'coco-home' | 'outside';

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
  cocoHome: string
): PathZone {
  const abs = resolve(path);
  if (workspaceRoot && isInside(workspaceRoot, abs)) return 'workspace';
  if (isInside(cocoHome, abs)) return 'coco-home';
  return 'outside';
}

/**
 * Decide whether `op` on `path` is permitted at the given level.
 *
 * - read:   always allowed at every level.
 * - write:  readonly denies everything; workspace allows only the workspace
 *           and the COCO_HOME data dir; full allows anything (tool-level
 *           approval still applies on top).
 *
 * `resolvedPath` lets callers pass an already-symlink-resolved path; the
 * containment check is only as strong as the resolution done upstream.
 */
export function decide(
  level: SecurityLevel,
  op: PathOperation,
  path: string,
  workspaceRoot: string | null,
  cocoHome: string
): PathDecision {
  const zone = classifyPath(path, workspaceRoot, cocoHome);

  if (op === 'read') {
    return { allowed: true, zone };
  }

  if (level === 'readonly') {
    return {
      allowed: false,
      zone,
      reason: `当前是只读安全级别，不允许写入 ${path}。`
    };
  }

  if (level === 'full') {
    return { allowed: true, zone };
  }

  // workspace level
  if (zone === 'workspace' || zone === 'coco-home') {
    return { allowed: true, zone };
  }
  return {
    allowed: false,
    zone,
    reason:
      `写入被限制在项目空间和 CocoAgent 数据目录内，${path} 不在其中。` +
      `如需放开，请在设置里提高安全级别。`
  };
}

/** Tools to exclude from a session at the given level. */
export function excludedToolsFor(level: SecurityLevel): string[] {
  return level === 'readonly' ? [...WRITE_CAPABLE_TOOLS] : [];
}

/** Guard separator handling for display/debug: root + sep + rest. */
export function joinUnder(root: string, ...parts: string[]): string {
  return [resolve(root), ...parts].join(sep);
}
