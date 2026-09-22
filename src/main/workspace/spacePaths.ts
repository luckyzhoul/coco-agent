import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { isInside } from '../security/pathPolicy';

/**
 * Pure project-space path helpers — no Electron imports so they can be
 * unit-tested directly (scripts/test-fileservice.ts).
 */

export const FALLBACK_SPACE_DIRNAME = 'CocoSpace';

/** Extensions treated as binary even when no NUL byte shows up in the head. */
export const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.icns', '.avif',
  '.pdf', '.zip', '.gz', '.tgz', '.bz2', '.xz', '.7z', '.rar',
  '.mp3', '.mp4', '.mov', '.avi', '.mkv', '.wav', '.flac', '.ogg', '.webm',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.so', '.dylib', '.dll', '.exe', '.bin', '.wasm', '.class', '.o', '.a',
  '.sqlite', '.db', '.node'
]);

/** Expand a leading `~` to the user's home directory. */
export function expandHome(input: string): string {
  const trimmed = (input ?? '').trim();
  if (!trimmed) return '';
  if (trimmed === '~') return os.homedir();
  if (trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
    return path.join(os.homedir(), trimmed.slice(2));
  }
  return trimmed;
}

/**
 * The built-in project space: `~/Desktop/CocoSpace`, degrading to
 * `~/CocoSpace` on machines with no Desktop directory.
 */
export function builtinDefaultPath(homeDir: string = os.homedir()): string {
  const desktop = path.join(homeDir, 'Desktop');
  try {
    if (fs.statSync(desktop).isDirectory()) {
      return path.join(desktop, FALLBACK_SPACE_DIRNAME);
    }
  } catch {
    // No Desktop directory — fall through.
  }
  return path.join(homeDir, FALLBACK_SPACE_DIRNAME);
}

/**
 * Resolve `abs` with its parent directory symlink-resolved.
 *
 * Paths are validated against the workspace root *after* resolution so a
 * symlink inside the space cannot be used to reach outside it. Non-existent
 * parents fall back to the lexical path — the subsequent `isInside` check
 * still rejects anything that escapes lexically.
 */
export function realpathParent(abs: string): string {
  const parent = path.dirname(abs);
  try {
    return path.join(fs.realpathSync(parent), path.basename(abs));
  } catch {
    return abs;
  }
}

/** True when the file head looks like binary content. */
export function looksBinary(head: Buffer, ext: string): boolean {
  if (BINARY_EXTENSIONS.has(ext.toLowerCase())) return true;
  return head.includes(0);
}
