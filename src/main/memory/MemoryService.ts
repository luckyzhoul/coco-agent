import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';
import { Type } from '@sinclair/typebox';
import { defineTool } from '@earendil-works/pi-coding-agent';
import type { ToolDefinition } from '@earendil-works/pi-coding-agent';

interface MemoryEntry {
  id: string;
  content: string;
  tags: string[];
  source: string;
  createdAt: number;
  updatedAt: number;
}

export class MemoryService {
  private filePath: string;
  private entries: MemoryEntry[] = [];

  constructor() {
    const dataDir = path.join(app.getPath('userData'), 'cocoagent');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.filePath = path.join(dataDir, 'memory.json');
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        this.entries = JSON.parse(data);
      }
    } catch {
      this.entries = [];
    }
  }

  private save(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.entries, null, 2));
    } catch {
      // Non-fatal
    }
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
    this.save();
    return entry;
  }

  get(id: string): MemoryEntry | undefined {
    return this.entries.find(e => e.id === id);
  }

  update(id: string, updates: Partial<Pick<MemoryEntry, 'content' | 'tags'>>): MemoryEntry | undefined {
    const idx = this.entries.findIndex(e => e.id === id);
    if (idx === -1) return undefined;
    this.entries[idx] = {
      ...this.entries[idx],
      ...updates,
      updatedAt: Date.now()
    };
    this.save();
    return this.entries[idx];
  }

  delete(id: string): boolean {
    const idx = this.entries.findIndex(e => e.id === id);
    if (idx === -1) return false;
    this.entries.splice(idx, 1);
    this.save();
    return true;
  }

  search(query: string, limit: number = 10): MemoryEntry[] {
    const queryLower = query.toLowerCase();
    const scored = this.entries.map(entry => {
      let score = 0;
      const contentLower = entry.content.toLowerCase();
      const tagsLower = entry.tags.map(t => t.toLowerCase());

      // Exact match in content
      if (contentLower.includes(queryLower)) score += 10;

      // Tag match
      if (tagsLower.some(t => t.includes(queryLower))) score += 5;

      // Word-level matches
      const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
      for (const word of queryWords) {
        if (contentLower.includes(word)) score += 2;
        if (tagsLower.some(t => t.includes(word))) score += 1;
      }

      return { entry, score };
    });

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.entry);
  }

  list(limit: number = 50): MemoryEntry[] {
    return this.entries.slice(0, limit);
  }

  // Build Pi SDK tool definitions for memory operations
  buildTools(): ToolDefinition[] {
    const service = this;

    return [
      defineTool({
        name: 'memory_add',
        label: 'Memory: Add',
        description: 'Add a new memory entry to long-term knowledge base. Use this to store important information, facts, preferences, or insights that should be remembered across sessions.',
        parameters: Type.Object({
          content: Type.String({ description: 'The content to remember' }),
          tags: Type.Optional(Type.Array(Type.String(), { description: 'Optional tags for categorization' })),
          source: Type.Optional(Type.String({ description: 'Source of the memory (default: agent)' }))
        }),
        async execute(_id, params) {
          const entry = service.add(params.content, params.tags || [], params.source || 'agent');
          return {
            content: [{ type: 'text', text: `Memory saved (ID: ${entry.id})\n\n${entry.content}` }],
            details: { entry }
          };
        }
      }),

      defineTool({
        name: 'memory_search',
        label: 'Memory: Search',
        description: 'Search the long-term memory for relevant information. Use this when you need to recall past conversations, facts, preferences, or previously stored knowledge.',
        parameters: Type.Object({
          query: Type.String({ description: 'Search query' }),
          limit: Type.Optional(Type.Number({ description: 'Max results (default: 10)' }))
        }),
        async execute(_id, params) {
          const results = service.search(params.query, params.limit || 10);
          if (results.length === 0) {
            return {
              content: [{ type: 'text', text: `No memories found for: ${params.query}` }],
              details: { results: [] }
            };
          }
          const text = results.map((r, i) =>
            `[${i + 1}] ${r.content}\n    tags: ${r.tags.join(', ') || 'none'}\n    id: ${r.id}`
          ).join('\n\n');
          return {
            content: [{ type: 'text', text: `Found ${results.length} memory entries:\n\n${text}` }],
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
          const text = entries.map((e, i) =>
            `[${i + 1}] ${e.content.slice(0, 100)}${e.content.length > 100 ? '...' : ''}\n    tags: ${e.tags.join(', ') || 'none'}\n    id: ${e.id}`
          ).join('\n\n');
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
            content: [{ type: 'text', text: deleted ? `Memory ${params.id} deleted.` : `Memory ${params.id} not found.` }],
            details: { deleted, id: params.id }
          };
        }
      })
    ] as unknown as ToolDefinition[];
  }
}

export const memoryService = new MemoryService();
