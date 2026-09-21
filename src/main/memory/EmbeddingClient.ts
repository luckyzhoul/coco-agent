import { modelManager } from '../models/ModelManager';

interface EmbeddingResponse {
  data?: { embedding: number[]; index: number }[];
}

/**
 * Thin client for OpenAI-compatible /embeddings endpoints.
 *
 * Deliberately fail-soft: any provider that does not expose embeddings, has no
 * key, or is unreachable simply yields null so callers fall back to BM25. This
 * matters for the offline / local-model deployment target.
 */
export class EmbeddingClient {
  private cache = new Map<string, number[]>();
  private disabledReason: string | null = null;

  isAvailable(): boolean {
    return this.disabledReason === null && this.resolveConfig() !== null;
  }

  getDisabledReason(): string | null {
    if (this.disabledReason) return this.disabledReason;
    if (!this.resolveConfig()) {
      return 'No embedding model configured. Set one in Settings → Models.';
    }
    return null;
  }

  private resolveConfig(): { baseUrl: string; apiKey: string; model: string } | null {
    const active = modelManager.getActive();
    if (!active) return null;
    if (!active.embeddingModel) return null;
    if (!active.baseUrl) return null;
    // Ollama exposes embeddings at /api/embeddings rather than the OpenAI shape.
    if (active.provider === 'ollama') return null;
    if (!active.apiKey) return null;

    return {
      baseUrl: active.baseUrl.replace(/\/+$/, ''),
      apiKey: active.apiKey,
      model: active.embeddingModel
    };
  }

  async embed(texts: string[]): Promise<number[][] | null> {
    const config = this.resolveConfig();
    if (!config) return null;

    const results: (number[] | null)[] = texts.map((t) => this.cache.get(t) ?? null);
    const missing = texts
      .map((text, i) => ({ text, i }))
      .filter(({ i }) => results[i] === null);

    if (missing.length === 0) {
      return results as number[][];
    }

    try {
      const resp = await fetch(`${config.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          input: missing.map((m) => m.text)
        })
      });

      if (!resp.ok) {
        this.disabledReason = `Embedding request failed (HTTP ${resp.status}).`;
        return null;
      }

      const json = (await resp.json()) as EmbeddingResponse;
      if (!json.data || json.data.length !== missing.length) {
        this.disabledReason = 'Embedding response shape was unexpected.';
        return null;
      }

      for (const item of json.data) {
        const target = missing[item.index];
        if (!target) continue;
        this.cache.set(target.text, item.embedding);
        results[target.i] = item.embedding;
      }

      return results as number[][];
    } catch (err) {
      this.disabledReason =
        err instanceof Error ? `Embedding request failed: ${err.message}` : 'Embedding request failed.';
      return null;
    }
  }

  clearCache(): void {
    this.cache.clear();
    this.disabledReason = null;
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export const embeddingClient = new EmbeddingClient();
