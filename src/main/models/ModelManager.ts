import { settingsManager } from '../settings/SettingsManager';
import type { ModelConfig } from '../../shared/types';

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

  async testConnection(id: string): Promise<boolean> {
    const models = settingsManager.getModels();
    const model = models.find(m => m.id === id);
    if (!model) return false;

    try {
      const result = await this.simpleApiTest(model);
      return result;
    } catch {
      return false;
    }
  }

  private async simpleApiTest(model: ModelConfig): Promise<boolean> {
    if (!model.apiKey || !model.baseUrl) {
      return false;
    }

    try {
      const url = model.baseUrl.replace(/\/$/, '') + '/models';
      const resp = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${model.apiKey}`
        }
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  // Build env vars for Pi SDK based on active model
  getModelEnvVars(): Record<string, string> {
    const active = this.getActive();
    if (!active) return {};

    const env: Record<string, string> = {};

    switch (active.provider) {
      case 'openai-compatible':
        env.OPENAI_API_KEY = active.apiKey || '';
        env.OPENAI_BASE_URL = active.baseUrl || '';
        break;
      case 'anthropic':
        env.ANTHROPIC_API_KEY = active.apiKey || '';
        env.ANTHROPIC_BASE_URL = active.baseUrl || '';
        break;
      case 'ollama':
        env.OLLAMA_BASE_URL = active.baseUrl || 'http://localhost:11434';
        break;
      case 'ark':
        env.ARK_API_KEY = active.apiKey || '';
        env.ARK_BASE_URL = active.baseUrl || '';
        break;
    }

    return env;
  }

  getModelNameForPi(): string | null {
    const active = this.getActive();
    return active?.model || null;
  }
}

export const modelManager = new ModelManager();
