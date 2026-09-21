import { Type } from '@sinclair/typebox';
import { defineTool } from '@earendil-works/pi-coding-agent';
import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import { getDb } from '../db';
import { DEFAULT_AGENT_ID } from '../agents/AgentManager';
import { Bm25Index } from './Bm25Index';
import { embeddingClient, cosineSimilarity } from './EmbeddingClient';

interface MemoryEntry {
  id: string;
  content: string;
  tags: string[];
  source: string;
  createdAt: number;
  updatedAt: number;
}

interface MemoryRow {
  id: string;
  content: string;
  tags: string;
  source: string;
  created_at: number;
  updated_at: number;
}

function safeParseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

export interface MemorySearchHit extends MemoryEntry {
  score: number;
  matchType: 'bm25' | 'semantic' | 'hybrid';
}

/** Weight applied to the semantic score when blending with BM25. */
const SEMANTIC_WEIGHT = 0.7;

export class MemoryService {
  /** Agent whose memories are currently loaded. */
  private agentId: string | null = null;
  private entries: MemoryEntry[] = [];
  private index = new Bm25Index();
  private embeddings = new Map<string, number[]>();

  constructor() {
    this.load(DEFAULT_AGENT_ID);
  }

  /**
   * Load memories for an agent, replacing whatever is indexed.
   * Memories are agent-scoped: each agent only sees its own.
   */
  load(agentId: string): void {
    this.agentId = agentId;
    try {
      const rows = getDb()
        .prepare('SELECT * FROM memories WHERE agent_id = ? ORDER BY created_at DESC')
        .all(agentId) as unknown as MemoryRow[];
      this.entries = rows.map((r) => ({
        id: r.id,
        content: r.content,
        tags: safeParseTags(r.tags),
        source: r.source,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
    } catch {
      this.entries = [];
    }
    this.reindex();
  }

  getAgentId(): string | null {
    return this.agentId;
  }

  private insertEntry(entry: MemoryEntry): void {
    getDb()
      .prepare(
        'INSERT INTO memories (id, content, tags, source, agent_id, tier, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        entry.id,
        entry.content,
        JSON.stringify(entry.tags),
        entry.source,
        this.agentId ?? DEFAULT_AGENT_ID,
        'recent',
        entry.createdAt,
        entry.updatedAt
      );
  }

  /** BM25 needs a flat text per document; tags are repeated to give them a mild boost. */
  private searchableText(entry: MemoryEntry): string {
    const tags = entry.tags.join(' ');
    return `${entry.content} ${tags} ${tags}`;
  }

  private reindex(): void {
    this.index.build(this.entries.map((e) => this.searchableText(e)));
  }

  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  add(content: string, tags: string[] = [], source: string = 'agent'): MemoryEntry {
    const entry: MemoryEntry = {
      id: this.generateId(),
      content,
      tags,
      source,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.entries.unshift(entry);
    this.insertEntry(entry);
    this.reindex();
    return entry;
  }

  get(id: string): MemoryEntry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  update(
    id: string,
    updates: Partial<Pick<MemoryEntry, 'content' | 'tags'>>
  ): MemoryEntry | undefined {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx === -1) return undefined;
    this.entries[idx] = { ...this.entries[idx], ...updates, updatedAt: Date.now() };
    const e = this.entries[idx];
    getDb()
      .prepare('UPDATE memories SET content = ?, tags = ?, updated_at = ? WHERE id = ?')
      .run(e.content, JSON.stringify(e.tags), e.updatedAt, id);
    this.reindex();
    return e;
  }

  delete(id: string): boolean {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    this.entries.splice(idx, 1);
    this.embeddings.delete(id);
    getDb().prepare('DELETE FROM memories WHERE id = ?').run(id);
    this.reindex();
    return true;
  }

  list(limit: number = 50): MemoryEntry[] {
    return this.entries.slice(0, limit);
  }

  /** Lexical search only. Always available, no network. */
  searchLexical(query: string, limit: number = 10): MemorySearchHit[] {
    return this.index
      .search(query, limit)
      .map((hit) => ({
        ...this.entries[hit.index],
        score: hit.score,
        matchType: 'bm25' as const
      }))
      .filter((hit) => hit.id !== undefined);
  }

  /**
   * Hybrid search: BM25 always runs; when an embedding model is configured the
   * semantic score is blended in. Falls back silently to lexical-only.
   */
  async search(query: string, limit: number = 10): Promise<MemorySearchHit[]> {
    const lexical = this.searchLexical(query, Math.max(limit * 3, 20));
    if (lexical.length === 0 && !embeddingClient.isAvailable()) return [];

    const vectors = await embeddingClient.embed([
      query,
      ...this.entries.map((e) => e.content)
    ]);

    if (!vectors) {
      return lexical.slice(0, limit);
    }

    const [queryVec, ...docVecs] = vectors;

    // Normalize BM25 scores into 0..1 so they can be blended with cosine.
    const maxBm25 = lexical.reduce((m, h) => Math.max(m, h.score), 0);
    const bm25ById = new Map<string, number>();
    for (const hit of lexical) {
      bm25ById.set(hit.id, maxBm25 > 0 ? hit.score / maxBm25 : 0);
    }

    const scored: MemorySearchHit[] = this.entries.map((entry, i) => {
      const docVec = docVecs[i];
      const semantic = docVec ? Math.max(0, cosineSimilarity(queryVec, docVec)) : 0;
      const lexicalScore = bm25ById.get(entry.id) || 0;
      const score = lexicalScore * (1 - SEMANTIC_WEIGHT) + semantic * SEMANTIC_WEIGHT;

      return {
        ...entry,
        score,
        matchType: lexicalScore > 0 && semantic > 0 ? ('hybrid' as const) : semantic > 0 ? ('semantic' as const) : ('bm25' as const)
      };
    });

    return scored
      .filter((h) => h.score > 0.01)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  getSearchMode(): { mode: 'hybrid' | 'lexical'; detail: string } {
    if (embeddingClient.isAvailable()) {
      return { mode: 'hybrid', detail: 'BM25 + semantic embeddings' };
    }
    return {
      mode: 'lexical',
      detail: embeddingClient.getDisabledReason() || 'BM25 lexical search'
    };
  }

  buildTools(): ToolDefinition[] {
    const service = this;

    return [
      defineTool({
        name: 'memory_add',
        label: 'Memory: Add',
        description:
          'Add a new memory entry to the long-term knowledge base. Use this to store important information, facts, preferences, or insights that should be remembered across sessions.',
        parameters: Type.Object({
          content: Type.String({ description: 'The content to remember' }),
          tags: Type.Optional(
            Type.Array(Type.String(), { description: 'Optional tags for categorization' })
          ),
          source: Type.Optional(Type.String({ description: 'Source of the memory (default: agent)' }))
        }),
        async execute(_id, params) {
          const entry = service.add(params.content, params.tags || [], params.source || 'agent');
          return {
            content: [
              { type: 'text', text: `Memory saved (ID: ${entry.id})\n\n${entry.content}` }
            ],
            details: { entry }
          };
        }
      }),

      defineTool({
        name: 'memory_search',
        label: 'Memory: Search',
        description:
          'Search the long-term memory for relevant information. Use this when you need to recall past conversations, facts, preferences, or previously stored knowledge.',
        parameters: Type.Object({
          query: Type.String({ description: 'Search query' }),
          limit: Type.Optional(Type.Number({ description: 'Max results (default: 10)' }))
        }),
        async execute(_id, params) {
          const results = await service.search(params.query, params.limit || 10);
          if (results.length === 0) {
            return {
              content: [{ type: 'text', text: `No memories found for: ${params.query}` }],
              details: { results: [] }
            };
          }
          const text = results
            .map(
              (r, i) =>
                `[${i + 1}] (${r.matchType}, score ${r.score.toFixed(2)}) ${r.content}\n    tags: ${
                  r.tags.join(', ') || 'none'
                }\n    id: ${r.id}`
            )
            .join('\n\n');
          return {
            content: [
              { type: 'text', text: `Found ${results.length} memory entries:\n\n${text}` }
            ],
            details: { results }
          };
        }
      }),

      defineTool({
        name: 'memory_list',
        label: 'Memory: List',
        description: 'List recent memory entries from the knowledge base.',
        parameters: Type.Object({
          limit: Type.Optional(Type.Number({ description: 'Max entries (default: 50)' }))
        }),
        async execute(_id, params) {
          const entries = service.list(params.limit || 50);
          if (entries.length === 0) {
            return {
              content: [{ type: 'text', text: 'No memories stored yet.' }],
              details: { entries: [] }
            };
          }
          const text = entries
            .map(
              (e, i) =>
                `[${i + 1}] ${e.content.slice(0, 100)}${
                  e.content.length > 100 ? '...' : ''
                }\n    tags: ${e.tags.join(', ') || 'none'}\n    id: ${e.id}`
            )
            .join('\n\n');
          return {
            content: [{ type: 'text', text: `${entries.length} memories:\n\n${text}` }],
            details: { entries }
          };
        }
      }),

      defineTool({
        name: 'memory_delete',
        label: 'Memory: Delete',
        description: 'Delete a memory entry by ID.',
        parameters: Type.Object({
          id: Type.String({ description: 'Memory entry ID to delete' })
        }),
        async execute(_id, params) {
          const deleted = service.delete(params.id);
          return {
            content: [
              {
                type: 'text',
                text: deleted ? `Memory ${params.id} deleted.` : `Memory ${params.id} not found.`
              }
            ],
            details: { deleted, id: params.id }
          };
        }
      })
    ] as unknown as ToolDefinition[];
  }
}

export const memoryService = new MemoryService();
