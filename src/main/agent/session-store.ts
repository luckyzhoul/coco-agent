import { getDb } from '../db';
import type { Message, SessionInfo } from '../../shared/types';

interface SessionRow {
  id: string;
  title: string;
  workspace_path: string;
  agent_id: string | null;
  created_at: number;
  updated_at: number;
  message_count: number;
  pinned: number;
}

interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  timestamp: number;
  tool_calls: string | null;
}

export function listSessions(): SessionInfo[] {
  const rows = getDb()
    .prepare('SELECT * FROM sessions ORDER BY pinned DESC, updated_at DESC')
    .all() as unknown as SessionRow[];

  return rows.map((m) => ({
    id: m.id,
    title: m.title,
    workspacePath: m.workspace_path,
    agentId: m.agent_id,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
    messageCount: m.message_count,
    pinned: !!m.pinned
  }));
}

export function setSessionPinned(sessionId: string, pinned: boolean): void {
  getDb()
    .prepare('UPDATE sessions SET pinned = ? WHERE id = ?')
    .run(pinned ? 1 : 0, sessionId);
}

export function updateSessionWorkspace(sessionId: string, workspacePath: string): void {
  getDb()
    .prepare('UPDATE sessions SET workspace_path = ?, updated_at = ? WHERE id = ?')
    .run(workspacePath, Date.now(), sessionId);
}

export function createSessionMeta(
  sessionId: string,
  workspacePath: string,
  title: string,
  agentId?: string
): void {
  const now = Date.now();
  getDb()
    .prepare(
      'INSERT INTO sessions (id, title, workspace_path, agent_id, created_at, updated_at, message_count) VALUES (?, ?, ?, ?, ?, ?, 0)'
    )
    .run(sessionId, title, workspacePath, agentId ?? null, now, now);
}

export function updateSessionMeta(
  sessionId: string,
  updates: Partial<Pick<SessionInfo, 'title' | 'messageCount'>>
): void {
  const db = getDb();

  if (updates.title !== undefined) {
    db.prepare('UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?').run(
      updates.title,
      Date.now(),
      sessionId
    );
  }
  if (updates.messageCount !== undefined) {
    db.prepare(
      'UPDATE sessions SET message_count = ?, updated_at = ? WHERE id = ?'
    ).run(updates.messageCount, Date.now(), sessionId);
  }
}

export function deleteSession(sessionId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  db.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId);
}

export function appendMessage(sessionId: string, message: Message): void {
  getDb()
    .prepare(
      'INSERT INTO messages (id, session_id, role, content, timestamp, tool_calls) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(
      message.id,
      sessionId,
      message.role,
      message.content,
      message.timestamp,
      message.toolCalls ? JSON.stringify(message.toolCalls) : null
    );
}

export function loadSessionMessages(sessionId: string): Message[] {
  const rows = getDb()
    .prepare(
      'SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC, rowid ASC'
    )
    .all(sessionId) as unknown as MessageRow[];

  return rows.map((r) => ({
    id: r.id,
    role: r.role as Message['role'],
    content: r.content,
    timestamp: r.timestamp,
    toolCalls: r.tool_calls ? JSON.parse(r.tool_calls) : undefined
  }));
}

export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export interface SessionSearchResult {
  session: SessionInfo;
  matches: { messageId: string; role: string; snippet: string }[];
}

export function searchSessions(query: string, limit = 20): SessionSearchResult[] {
  const queryLower = query.toLowerCase().trim();
  if (!queryLower) return [];

  const results: SessionSearchResult[] = [];

  for (const session of listSessions()) {
    const matches: { messageId: string; role: string; snippet: string }[] = [];

    const titleMatch = session.title.toLowerCase().includes(queryLower);

    const messages = loadSessionMessages(session.id);
    for (const msg of messages) {
      const contentLower = msg.content.toLowerCase();
      const idx = contentLower.indexOf(queryLower);
      if (idx !== -1) {
        const start = Math.max(0, idx - 40);
        const end = Math.min(msg.content.length, idx + queryLower.length + 40);
        const snippet =
          (start > 0 ? '...' : '') +
          msg.content.slice(start, end) +
          (end < msg.content.length ? '...' : '');
        matches.push({ messageId: msg.id, role: msg.role, snippet });
        if (matches.length >= 3) break;
      }
    }

    if (titleMatch || matches.length > 0) {
      results.push({ session, matches });
      if (results.length >= limit) break;
    }
  }

  return results;
}