import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Message, SessionInfo } from '../../shared/types';
import { paths, ensureDir } from '../paths';

function getDataDir(): string {
  return ensureDir(paths.sessionsDir);
}

function getSessionFilePath(sessionId: string): string {
  return path.join(getDataDir(), `${sessionId}.jsonl`);
}

function getMetaPath(): string {
  return paths.sessionMetaFile;
}

interface SessionMeta {
  id: string;
  title: string;
  workspacePath: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

function loadMeta(): SessionMeta[] {
  try {
    const file = getMetaPath();
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
  } catch {
    // Corrupted file, start fresh
  }
  return [];
}

function saveMeta(metas: SessionMeta[]): void {
  fs.writeFileSync(getMetaPath(), JSON.stringify(metas, null, 2));
}

export function listSessions(): SessionInfo[] {
  const metas = loadMeta();
  return metas
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(m => ({
      id: m.id,
      title: m.title,
      workspacePath: m.workspacePath,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      messageCount: m.messageCount
    }));
}

export function createSessionMeta(
  sessionId: string,
  workspacePath: string,
  title: string
): void {
  const metas = loadMeta();
  const now = Date.now();
  metas.push({
    id: sessionId,
    title,
    workspacePath,
    createdAt: now,
    updatedAt: now,
    messageCount: 0
  });
  saveMeta(metas);
}

export function updateSessionMeta(
  sessionId: string,
  updates: Partial<Pick<SessionMeta, 'title' | 'messageCount'>>
): void {
  const metas = loadMeta();
  const idx = metas.findIndex(m => m.id === sessionId);
  if (idx === -1) return;
  metas[idx] = { ...metas[idx], ...updates, updatedAt: Date.now() };
  saveMeta(metas);
}

export function deleteSession(sessionId: string): void {
  const metas = loadMeta().filter(m => m.id !== sessionId);
  saveMeta(metas);
  const file = getSessionFilePath(sessionId);
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
}

export function appendMessage(sessionId: string, message: Message): void {
  const file = getSessionFilePath(sessionId);
  fs.appendFileSync(file, JSON.stringify(message) + '\n');
}

export function loadSessionMessages(sessionId: string): Message[] {
  const file = getSessionFilePath(sessionId);
  if (!fs.existsSync(file)) return [];

  const lines = fs.readFileSync(file, 'utf-8').trim().split('\n');
  const messages: Message[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      messages.push(JSON.parse(line));
    } catch {
      // Skip malformed lines
    }
  }
  return messages;
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

    // Match against title
    const titleMatch = session.title.toLowerCase().includes(queryLower);

    // Match against message contents
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
