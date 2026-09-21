import * as fs from 'node:fs';
import * as path from 'node:path';
import { PI_RUNTIME_DIR } from '../paths';
import type { ModelConfig } from '../../shared/types';

/**
 * Pi SDK discovers models exclusively from <agentDir>/models.json and their
 * credentials from <agentDir>/auth.json. Neither env vars nor our own settings
 * are consulted, so the active model list must be materialised into those two
 * files before a session is created.
 */

interface PiModelDefinition {
  id: string;
  name?: string;
  reasoning?: boolean;
}

interface PiProviderConfig {
  name?: string;
  baseUrl?: string;
  api: string;
  models: PiModelDefinition[];
}

interface PiModelsConfig {
  providers: Record<string, PiProviderConfig>;
}

interface PiAuthConfig {
  [providerId: string]: { type: 'api_key'; key: string };
}

/** Which protocol adapter the model speaks. */
function apiFor(provider: ModelConfig['provider']): string {
  switch (provider) {
    case 'anthropic':
      return 'anthropic-messages';
    // DeepSeek, Ark and Ollama all expose an OpenAI-compatible /chat/completions.
    case 'openai-compatible':
    case 'ark':
    case 'ollama':
      return 'openai-completions';
  }
}

function normalizeBaseUrl(model: ModelConfig): string {
  const raw = (model.baseUrl || '').replace(/\/+$/, '');
  if (model.provider === 'ollama') {
    // Ollama's OpenAI-compatible surface lives under /v1.
    return raw.endsWith('/v1') ? raw : `${raw || 'http://localhost:11434'}/v1`;
  }
  if (model.provider === 'anthropic') {
    return raw || 'https://api.anthropic.com';
  }
  return raw;
}

export function providerIdFor(model: ModelConfig): string {
  return `coco-${model.id}`;
}

/**
 * Write models.json + auth.json reflecting the given model list.
 * Keys go to auth.json so credential storage stays separate from model wiring.
 */
export function syncPiModelConfig(models: ModelConfig[], activeModelId: string | null): void {
  fs.mkdirSync(PI_RUNTIME_DIR, { recursive: true });

  const providers: PiModelsConfig['providers'] = {};
  const auth: PiAuthConfig = {};

  for (const model of models) {
    const providerId = providerIdFor(model);
    const baseUrl = normalizeBaseUrl(model);
    if (!baseUrl) continue;

    providers[providerId] = {
      name: model.name,
      baseUrl,
      api: apiFor(model.provider),
      models: [
        {
          id: model.model,
          name: model.name,
          reasoning: model.provider === 'anthropic' ? true : undefined
        }
      ]
    };

    if (model.apiKey) {
      auth[providerId] = { type: 'api_key', key: model.apiKey };
    }
  }

  const modelsPath = path.join(PI_RUNTIME_DIR, 'models.json');
  const authPath = path.join(PI_RUNTIME_DIR, 'auth.json');

  fs.writeFileSync(modelsPath, JSON.stringify({ providers }, null, 2));

  // Ollama needs no credential; keep an empty auth.json so the file always parses.
  fs.writeFileSync(authPath, JSON.stringify(auth, null, 2));

  void activeModelId;
}
