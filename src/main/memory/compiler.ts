import { Type } from '@sinclair/typebox';
import { defineTool } from '@earendil-works/pi-coding-agent';
import { modelManager } from '../models/ModelManager';
import { chatComplete } from '../models/chatClient';
import type { MemoryService } from './MemoryService';

const COMPILE_PROMPT = `You are consolidating an agent's memory.

Below are short-term memory entries, oldest first. Distill them into ONE
compact long-term summary that preserves every fact, preference, decision,
and open question that could matter later.

Rules:
- Merge duplicates; drop transient chatter and anything already obvious.
- Keep concrete details (names, numbers, paths, decisions) — do not generalise them away.
- Write it as plain prose or short bullet lines, under 300 words.
- Output ONLY the summary text, no preamble.

Memory entries:
`;

const DEFAULT_BATCH = 10;
const MAX_BATCH = 50;

/**
 * `memory_compile` — distills the oldest N recent memories into a single
 * long-term entry using the active model, then removes the sources.
 *
 * Recent memories are for fast recall; long-term is the durable form. The raw
 * text remains recoverable from the session transcript either way.
 */
export function buildCompileTool(service: MemoryService) {
  return defineTool({
    name: 'memory_compile',
    label: 'Memory: Compile',
    description:
      'Consolidate short-term memories into one long-term summary using the active model. ' +
      'Use this when there are many recent memory entries worth keeping but not worth keeping ' +
      'individually — e.g. after a long working session. The compiled entries are removed and ' +
      'replaced by the summary.',
    parameters: Type.Object({
      limit: Type.Optional(
        Type.Number({
          description: `How many of the oldest recent entries to compile (default ${DEFAULT_BATCH}, max ${MAX_BATCH})`
        })
      )
    }),
    async execute(_id, params) {
      const limit = Math.min(Math.max(1, params.limit ?? DEFAULT_BATCH), MAX_BATCH);

      const batch = service.listByTier('recent', limit);
      if (batch.length === 0) {
        return {
          content: [
            { type: 'text', text: 'No recent memories to compile.' }
          ],
          details: { compiled: 0 } as Record<string, unknown>
        };
      }

      const model = modelManager.getActive();
      if (!model) {
        return {
          content: [
            {
              type: 'text',
              text: 'No model configured. Set one in Settings → Models, then retry memory_compile.'
            }
          ],
          details: { compiled: 0, error: 'no_model' } as Record<string, unknown>
        };
      }

      const listing = batch
        .map((e, i) => `[${i + 1}] (${new Date(e.createdAt).toISOString()}) ${e.content}`)
        .join('\n\n');

      let summary: string;
      try {
        summary = await chatComplete(model, COMPILE_PROMPT + listing, 700);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text', text: `Compilation failed: ${message}` }],
          details: { compiled: 0, error: message } as Record<string, unknown>
        };
      }

      const entry = service.compile(
        summary,
        batch.map((e) => e.id)
      );

      const details: Record<string, unknown> = { compiled: batch.length, entry };
      return {
        content: [
          {
            type: 'text',
            text: `Compiled ${batch.length} recent memories into one long-term entry (ID: ${entry.id}).\n\n${summary}`
          }
        ],
        details
      };
    }
  });
}
