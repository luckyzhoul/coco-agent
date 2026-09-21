import { DatabaseSync } from 'node:sqlite';
import { COCO_HOME, paths, ensureDir } from './paths';

/**
 * Single SQLite database for all CocoAgent data: ${COCO_HOME}/coco.db.
 * WAL mode keeps concurrent reads/writes reliable across main-process managers.
 *
 * Uses node:sqlite (built into Electron 44 / Node 24) so there is no native
 * module to rebuild against Electron's ABI.
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL DEFAULT '',
  workspace_path TEXT NOT NULL DEFAULT '',
  agent_id       TEXT,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  message_count  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS messages (
  id         TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role       TEXT NOT NULL,
  content    TEXT NOT NULL DEFAULT '',
  timestamp  INTEGER NOT NULL,
  tool_calls TEXT
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);

CREATE TABLE IF NOT EXISTS memories (
  id         TEXT PRIMARY KEY,
  content    TEXT NOT NULL,
  tags       TEXT NOT NULL DEFAULT '[]',
  source     TEXT NOT NULL DEFAULT 'agent',
  agent_id   TEXT,
  tier       TEXT NOT NULL DEFAULT 'recent',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS recent_workspaces (
  path      TEXT PRIMARY KEY,
  name      TEXT NOT NULL DEFAULT '',
  last_used INTEGER NOT NULL
);
`;

let db: DatabaseSync | null = null;

export function initDb(): DatabaseSync {
  if (db) return db;
  ensureDir(COCO_HOME);

  db = new DatabaseSync(paths.dbFile);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

/** Get the singleton, initialising it on first use. */
export function getDb(): DatabaseSync {
  return initDb();
}