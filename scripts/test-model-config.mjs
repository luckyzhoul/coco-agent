import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ModelRuntime } from '@earendil-works/pi-coding-agent';

function makeFiles(dir, providers, auth) {
  fs.writeFileSync(path.join(dir, 'models.json'), JSON.stringify({ providers }, null, 2));
  fs.writeFileSync(path.join(dir, 'auth.json'), JSON.stringify(auth ?? {}, null, 2));
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coco-model-test-'));
const modelsPath = path.join(dir, 'models.json');
const authPath = path.join(dir, 'auth.json');

function report(label, ok, err) {
  console.log(`${ok ? 'ok  :' : 'FAIL:'} ${label}${err ? ` -> ${err}` : ''}`);
}

try {
  // OpenAI-compatible provider
  makeFiles(dir, {
    'coco-test': {
      name: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com/v1',
      api: 'openai-completions',
      models: [{ id: 'deepseek-chat', name: 'DeepSeek Chat' }]
    }
  }, { 'coco-test': { type: 'api_key', key: 'sk-test' } });

  const rt = await ModelRuntime.create({ authPath, modelsPath });
  const m = rt.getModel('coco-test', 'deepseek-chat');
  report('openai-compatible model resolves', !!m);
  report('no compose error', rt.getError() === undefined, rt.getError());
  report('auth recognized', rt.hasConfiguredAuth('coco-test'));

  // anthropic + ollama variants
  makeFiles(dir, {
    'coco-anth': { baseUrl: 'https://api.anthropic.com', api: 'anthropic-messages', models: [{ id: 'claude-1', name: 'Claude' }] },
    'coco-ollama': { baseUrl: 'http://localhost:11434', api: 'openai-completions', models: [{ id: 'llama3', name: 'Llama3' }] }
  }, { 'coco-anth': { type: 'api_key', key: 'sk-anth' } });

  const rt2 = await ModelRuntime.create({ authPath, modelsPath });
  report('anthropic model resolves', !!rt2.getModel('coco-anth', 'claude-1'), rt2.getError());
  report('ollama model resolves (no key)', !!rt2.getModel('coco-ollama', 'llama3'), rt2.getError());

  console.log('\nDONE');
} catch (e) {
  console.error('FATAL:', e?.message ?? e);
  process.exit(2);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}