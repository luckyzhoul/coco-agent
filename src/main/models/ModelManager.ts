import { settingsManager } from '../settings/SettingsManager';
import { chatComplete } from './chatClient';
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

    try {
      const reply = await chatComplete(model, 'Reply with the single word: pong', 16, 30000);
      return {
        ok: true,
        message: 'Connected. Model replied.',
        reply,
        latencyMs: Date.now() - started
      };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        message: `Request failed: ${detail}`,
        latencyMs: Date.now() - started
      };
    }
  }
}

export const modelManager = new ModelManager();
