import React, { useState } from 'react';
import { useSettingsStore } from '../../stores/useSettingsStore';
import type { ModelConfig, ModelProvider, ModelTestResult } from '@shared/types';

export function ModelsSettings() {
  const models = useSettingsStore((s) => s.models);
  const activeModelId = useSettingsStore((s) => s.activeModelId);
  const addModel = useSettingsStore((s) => s.addModel);
  const deleteModel = useSettingsStore((s) => s.deleteModel);
  const setActiveModel = useSettingsStore((s) => s.setActiveModel);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newModel, setNewModel] = useState({
    name: '',
    provider: 'openai-compatible' as ModelProvider,
    model: '',
    baseUrl: '',
    apiKey: '',
    embeddingModel: ''
  });

  const handleAdd = async () => {
    if (!newModel.name || !newModel.model) return;
    await addModel(newModel);
    setNewModel({ name: '', provider: 'openai-compatible', model: '', baseUrl: '', apiKey: '', embeddingModel: '' });
    setShowAddForm(false);
  };

  const providerLabels: Record<ModelProvider, string> = {
    'openai-compatible': 'OpenAI Compatible',
    'anthropic': 'Anthropic',
    'ollama': 'Ollama (Local)',
    'ark': 'Ark (豆包)'
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-medium mb-1">Models</h3>
          <p className="text-sm text-muted-foreground">
            Configure AI models for the agent to use.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm hover:opacity-90 transition-opacity"
        >
          + Add Model
        </button>
      </div>

      {showAddForm && (
        <div className="bg-background border border-border rounded-lg p-4 space-y-4">
          <h4 className="text-sm font-medium">Add New Model</h4>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Display Name</label>
              <input
                type="text"
                value={newModel.name}
                onChange={(e) => setNewModel({ ...newModel, name: e.target.value })}
                placeholder="My DeepSeek"
                className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Provider</label>
              <select
                value={newModel.provider}
                onChange={(e) => setNewModel({ ...newModel, provider: e.target.value as ModelProvider })}
                className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
              >
                {Object.entries(providerLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Model ID</label>
              <input
                type="text"
                value={newModel.model}
                onChange={(e) => setNewModel({ ...newModel, model: e.target.value })}
                placeholder="deepseek-chat"
                className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Base URL</label>
              <input
                type="text"
                value={newModel.baseUrl}
                onChange={(e) => setNewModel({ ...newModel, baseUrl: e.target.value })}
                placeholder="https://api.deepseek.com/v1"
                className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
              />
            </div>

            <div className="col-span-2">
              <label className="text-xs text-muted-foreground block mb-1">API Key</label>
              <input
                type="password"
                value={newModel.apiKey}
                onChange={(e) => setNewModel({ ...newModel, apiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
              />
            </div>

            <div className="col-span-2">
              <label className="text-xs text-muted-foreground block mb-1">
                Embedding Model (optional — enables semantic memory search)
              </label>
              <input
                type="text"
                value={newModel.embeddingModel}
                onChange={(e) => setNewModel({ ...newModel, embeddingModel: e.target.value })}
                placeholder="text-embedding-3-small"
                className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 rounded-md text-sm border border-input hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm hover:opacity-90 transition-opacity"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Model list */}
      <div className="space-y-2">
        {models.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No models configured. Add one to get started.
          </div>
        ) : (
          models.map((model) => (
            <ModelItem
              key={model.id}
              model={model}
              isActive={model.id === activeModelId}
              onSetActive={() => setActiveModel(model.id)}
              onDelete={() => deleteModel(model.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ModelItem({
  model,
  isActive,
  onSetActive,
  onDelete
}: {
  model: ModelConfig;
  isActive: boolean;
  onSetActive: () => void;
  onDelete: () => void;
}) {
  const providerLabels: Record<ModelProvider, string> = {
    'openai-compatible': 'OpenAI Compatible',
    'anthropic': 'Anthropic',
    'ollama': 'Ollama',
    'ark': 'Ark'
  };

  const [testResult, setTestResult] = useState<ModelTestResult | null>(null);
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await window.electronAPI.models.test(model.id);
      setTestResult(result);
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : String(err)
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className={`p-3 rounded-lg border ${
      isActive ? 'border-primary/50 bg-primary/5' : 'border-border bg-background'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <div>
            <div className="text-sm font-medium">{model.name}</div>
            <div className="text-xs text-muted-foreground">
              {providerLabels[model.provider]} · {model.model}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isActive ? (
            <span className="text-xs text-primary font-medium">Active</span>
          ) : (
            <button
              onClick={onSetActive}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Set Active
            </button>
          )}
          <button
            onClick={handleTest}
            disabled={testing}
            className="text-xs px-2 py-1 rounded border border-input hover:bg-accent disabled:opacity-50 transition-colors"
          >
            {testing ? 'Testing…' : 'Test'}
          </button>
          <button
            onClick={onDelete}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {testResult && (
        <div
          className={`mt-2 rounded-md px-3 py-2 text-xs ${
            testResult.ok
              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}
        >
          <div className="font-medium">
            {testResult.ok ? '✓ ' : '✕ '}
            {testResult.message}
            {typeof testResult.latencyMs === 'number' && ` (${testResult.latencyMs}ms)`}
          </div>
          {testResult.reply && (
            <div className="mt-1 font-mono opacity-80">“{testResult.reply}”</div>
          )}
        </div>
      )}
    </div>
  );
}

