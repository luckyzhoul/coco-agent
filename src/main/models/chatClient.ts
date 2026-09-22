import type { ModelConfig } from '../../shared/types';

/**
 * Minimal one-shot chat completion against a configured model.
 *
 * Used by features that need the model directly (memory compilation) rather
 * than through a full agent session. Handles the same provider shapes as
 * syncPiModelConfig: openai-compatible/ark/ollama via /chat/completions,
 * anthropic via /v1/messages.
 */
export async function chatComplete(
  model: ModelConfig,
  prompt: string,
  maxTokens = 512,
  timeoutMs = 60000
): Promise<string> {
  if (!model.baseUrl) {
    throw new Error('Model has no base URL configured.');
  }
  if (model.provider !== 'ollama' && !model.apiKey) {
    throw new Error('Model has no API key configured.');
  }

  const baseUrl = model.baseUrl.replace(/\/+$/, '');
  const started = Date.now();

  let reply: string;

  if (model.provider === 'anthropic') {
    const resp = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': model.apiKey || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model.model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }]
      }),
      signal: AbortSignal.timeout(timeoutMs)
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`Anthropic request failed (HTTP ${resp.status})${body ? `: ${body.slice(0, 200)}` : ''}`);
    }

    const json = (await resp.json()) as { content?: { type: string; text?: string }[] };
    reply = (json.content || [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text || '')
      .join('')
      .trim();
  } else {
    // openai-compatible, ark, ollama (whose OpenAI surface lives under /v1)
    const base =
      model.provider === 'ollama' && !baseUrl.endsWith('/v1')
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
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        stream: false
      }),
      signal: AbortSignal.timeout(timeoutMs)
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`Chat request failed (HTTP ${resp.status})${body ? `: ${body.slice(0, 200)}` : ''}`);
    }

    const json = (await resp.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    reply = json.choices?.[0]?.message?.content?.trim() || '';
  }

  if (!reply) {
    throw new Error(`Model returned an empty response after ${Date.now() - started}ms.`);
  }
  return reply;
}
