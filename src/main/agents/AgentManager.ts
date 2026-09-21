import * as fs from 'node:fs';
import { getDb } from '../db';
import { settingsManager } from '../settings/SettingsManager';
import { agentDir, agentSkillsDir, readPersona, writePersona } from './persona';
import { ensureDir } from '../paths';
import type { AgentInfo } from '../../shared/types';

export const DEFAULT_AGENT_ID = 'main';

export type { AgentInfo };

interface AgentRow {
  id: string;
  name: string;
  description: string;
  created_at: number;
  updated_at: number;
}

function toInfo(row: AgentRow): AgentInfo {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return base || 'agent';
}

export class AgentManager {
  constructor() {
    this.ensureDefault();
  }

  list(): AgentInfo[] {
    const rows = getDb()
      .prepare('SELECT * FROM agents ORDER BY created_at ASC')
      .all() as unknown as AgentRow[];
    return rows.map(toInfo);
  }

  get(id: string): AgentInfo | undefined {
    const row = getDb()
      .prepare('SELECT * FROM agents WHERE id = ?')
      .get(id) as unknown as AgentRow | undefined;
    return row ? toInfo(row) : undefined;
  }

  create(input: { name: string; description?: string; persona?: string }): AgentInfo {
    const db = getDb();
    const now = Date.now();

    // Derive a unique id from the name so agents are addressable as folders.
    let id = slugify(input.name);
    let suffix = 2;
    while (this.get(id)) {
      id = `${slugify(input.name)}-${suffix++}`;
    }

    db.prepare(
      'INSERT INTO agents (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, input.name, input.description ?? '', now, now);

    ensureDir(agentDir(id));
    ensureDir(agentSkillsDir(id));
    if (input.persona) {
      writePersona(id, { name: input.name, body: input.persona });
    }

    return this.get(id)!;
  }

  update(id: string, updates: Partial<Pick<AgentInfo, 'name' | 'description'>>): AgentInfo {
    const existing = this.get(id);
    if (!existing) throw new Error(`Agent not found: ${id}`);

    getDb()
      .prepare('UPDATE agents SET name = ?, description = ?, updated_at = ? WHERE id = ?')
      .run(
        updates.name ?? existing.name,
        updates.description ?? existing.description,
        Date.now(),
        id
      );

    // Keep the persona frontmatter name in sync when it exists.
    const persona = readPersona(id);
    if (persona && updates.name) {
      writePersona(id, { ...persona, name: updates.name });
    }

    return this.get(id)!;
  }

  delete(id: string): void {
    if (id === DEFAULT_AGENT_ID) {
      throw new Error('The default agent cannot be deleted.');
    }
    if (this.list().length <= 1) {
      throw new Error('At least one agent must remain.');
    }

    const db = getDb();
    db.prepare('DELETE FROM sessions WHERE agent_id = ?').run(id);
    db.prepare('DELETE FROM memories WHERE agent_id = ?').run(id);
    db.prepare('DELETE FROM agents WHERE id = ?').run(id);

    // Messages are keyed by session; remove any orphaned rows for this agent.
    db.prepare(
      'DELETE FROM messages WHERE session_id NOT IN (SELECT id FROM sessions)'
    ).run();

    try {
      fs.rmSync(agentDir(id), { recursive: true, force: true });
    } catch {
      // Folder removal is best-effort; the registry row is already gone.
    }

    if (this.getActiveId() === id) {
      this.setActive(DEFAULT_AGENT_ID);
    }
  }

  /** Active agent id, falling back to the default when unset or stale. */
  getActiveId(): string {
    const configured = settingsManager.get().activeAgentId;
    if (configured && this.get(configured)) return configured;
    return DEFAULT_AGENT_ID;
  }

  getActive(): AgentInfo {
    return this.get(this.getActiveId()) ?? this.get(DEFAULT_AGENT_ID)!;
  }

  setActive(id: string): void {
    if (!this.get(id)) throw new Error(`Agent not found: ${id}`);
    settingsManager.set({ activeAgentId: id });
  }

  /** Create the built-in default agent on first run. */
  private ensureDefault(): void {
    try {
      if (this.get(DEFAULT_AGENT_ID)) return;
      const now = Date.now();
      getDb()
        .prepare(
          'INSERT INTO agents (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
        )
        .run(DEFAULT_AGENT_ID, 'Main', 'Default assistant', now, now);
      ensureDir(agentDir(DEFAULT_AGENT_ID));
      ensureDir(agentSkillsDir(DEFAULT_AGENT_ID));
    } catch {
      // DB not ready yet; the next construction will retry.
    }
  }
}

export const agentManager = new AgentManager();
