import { settingsManager } from '../settings/SettingsManager';
import type { ModelConfig, ModelTestResult } from '../../shared/types';

function generateId(): string {
  return `model_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export class ModelManager {
  list(): ModelConfig[] {
    return settingsManager.getModels();
  }

  add(model: Omit<ModelConfig, 'id'>): ModelConfig[] {
    const newModel: ModelConfig = {
      ...model,
      id: generateId()
    };
    return settingsManager.addModel(newModel);
  }

  update(id: string, updates: Partial<ModelConfig>): ModelConfig[] {
    return settingsManager.updateModel(id, updates);
  }

  delete(id: string): ModelConfig[] {
    return settingsManager.deleteModel(id);
  }

  setActive(id: string): void {
    settingsManager.setActiveModel(id);
  }

  getActive(): ModelConfig | null {
    return settingsManager.getActiveModel();
  }

  /**
   * Send a real minimal chat completion so a green result means the exact
   * combination of base URL + key + model id actually works, not merely that
   * some endpoint answered.
   */
  async testConnection(id: string): Promise<ModelTestResult> {
    const models = settingsManager.getModels();
    const model = models.find(m => m.id === id);

    if (!model) {
      return { ok: false, message: 'Model config not found.' };
    }
    if (!model.baseUrl) {
      return { ok: false, message: 'Base URL is not set.' };
    }
    if (model.provider !== 'ollama' && !model.apiKey) {
      return { ok: false, message: 'API key is not set.' };
    }

    const started = Date.now();
    const baseUrl = model.baseUrl.replace(/\/+$/, '');

    try {
      if (model.provider === 'anthropic') {
        return await this.testAnthropic(model, baseUrl, started);
      }
      return await this.testOpenAiCompatible(model, baseUrl, started);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        message: `Request failed: ${detail}`,
        latencyMs: Date.now() - started
      };
    }
  }

  private async testOpenAiCompatible(
    model: ModelConfig,
    baseUrl: string,
    started: number
  ): Promise<ModelTestResult> {
    // Ollama serves its OpenAI-compatible API under /v1.
    const base = model.provider === 'ollama' && !baseUrl.endsWith('/v1')
      ? `${baseUrl}/v1`
      : baseUrl;

    const resp = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(model.apiKey ? { Authorization: `Bearer ${model.apiKey}` } : {})
      },
      body: JSON.stringify({
        model: model.model,
        messages: [{ role: 'user', content: 'Reply with the single word: pong' }],
        max_tokens: 16,
        stream: false
      }),
      signal: AbortSignal.timeout(30000)
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      return {
        ok: false,
        message: `HTTP ${resp.status}${body ? ` — ${body.slice(0, 200)}` : ''}`,
        latencyMs: Date.now() - started
      };
    }

    const json = (await resp.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const reply = json.choices?.[0]?.message?.content?.trim() || '';

    return {
      ok: true,
      message: `Connected. Model replied.`,
      reply: reply || '(empty response)',
      latencyMs: Date.now() - started
    };
  }

  private async testAnthropic(
    model: ModelConfig,
    baseUrl: string,
    started: number
  ): Promise<ModelTestResult> {
    const resp = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': model.apiKey || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model.model,
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Reply with the single word: pong' }]
      }),
      signal: AbortSignal.timeout(30000)
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      return {
        ok: false,
        message: `HTTP ${resp.status}${body ? ` — ${body.slice(0, 200)}` : ''}`,
        latencyMs: Date.now() - started
      };
    }

    const json = (await resp.json()) as {
      content?: { type: string; text?: string }[];
    };
    const reply = (json.content || [])
      .filter(c => c.type === 'text')
      .map(c => c.text || '')
      .join('')
      .trim();

    return {
      ok: true,
      message: 'Connected. Model replied.',
      reply: reply || '(empty response)',
      latencyMs: Date.now() - started
    };
  }
}

export const modelManager = new ModelManager();
