import { getDb } from '../db';
import type { AuthorizedRoot } from './pathPolicy';

/**
 * Persistence for user-authorized directories (授权目录): additional roots
 * beyond the session workspace that the agent may read (and write, when
 * canWrite). One row per directory; revocation = delete row.
 */

export function listAuthorizedDirs(): AuthorizedRoot[] {
  const rows = getDb()
    .prepare('SELECT path, can_write, label FROM authorized_dirs ORDER BY created_at')
    .all() as { path: string; can_write: number; label: string }[];
  return rows.map((r) => ({ path: r.path, canWrite: r.can_write === 1, label: r.label || undefined }));
}

export function addAuthorizedDir(path: string, canWrite: boolean, label = ''): AuthorizedRoot[] {
  getDb()
    .prepare(
      `INSERT INTO authorized_dirs (path, can_write, label, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(path) DO UPDATE SET can_write = excluded.can_write, label = excluded.label`
    )
    .run(path, canWrite ? 1 : 0, label, Date.now());
  return listAuthorizedDirs();
}

export function removeAuthorizedDir(path: string): AuthorizedRoot[] {
  getDb().prepare('DELETE FROM authorized_dirs WHERE path = ?').run(path);
  return listAuthorizedDirs();
}

export function setAuthorizedDirCanWrite(path: string, canWrite: boolean): AuthorizedRoot[] {
  getDb().prepare('UPDATE authorized_dirs SET can_write = ? WHERE path = ?').run(canWrite ? 1 : 0, path);
  return listAuthorizedDirs();
}
