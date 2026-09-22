import React, { useState } from 'react';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { CheckIcon, CloseIcon } from '../layout/icons';
import type { ModelConfig, ModelProvider, ModelTestResult } from '@shared/types';

const providerLabels: Record<ModelProvider, string> = {
  'openai-compatible': 'OpenAI 兼容',
  'anthropic': 'Anthropic',
  'ollama': 'Ollama（本地）',
  'ark': 'Ark（豆包）'
};

interface ModelFormValues {
  name: string;
  provider: ModelProvider;
  model: string;
  baseUrl: string;
  apiKey: string;
  embeddingModel: string;
}

function toFormValues(model: ModelConfig): ModelFormValues {
  return {
    name: model.name,
    provider: model.provider,
    model: model.model,
    baseUrl: model.baseUrl || '',
    apiKey: model.apiKey || '',
    embeddingModel: model.embeddingModel || ''
  };
}

const EMPTY_FORM: ModelFormValues = {
  name: '',
  provider: 'openai-compatible',
  model: '',
  baseUrl: '',
  apiKey: '',
  embeddingModel: ''
};

export function ModelForm({
  initial,
  title,
  submitLabel,
  onSave,
  onCancel
}: {
  initial?: ModelFormValues;
  title: string;
  submitLabel: string;
  onSave: (values: ModelFormValues) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<ModelFormValues>(initial || EMPTY_FORM);

  const set = (patch: Partial<ModelFormValues>) => setValues({ ...values, ...patch });
  const canSubmit = values.name.trim() !== '' && values.model.trim() !== '';

  return (
    <div className="bg-background border border-border rounded-lg p-4 space-y-4">
      <h4 className="text-sm font-medium">{title}</h4>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">显示名称</label>
          <input
            type="text"
            value={values.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="我的 DeepSeek"
            className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">提供商</label>
          <select
            value={values.provider}
            onChange={(e) => set({ provider: e.target.value as ModelProvider })}
            className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
          >
            {Object.entries(providerLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">模型 ID</label>
          <input
            type="text"
            value={values.model}
            onChange={(e) => set({ model: e.target.value })}
            placeholder="deepseek-chat"
            className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">基础 URL</label>
          <input
            type="text"
            value={values.baseUrl}
            onChange={(e) => set({ baseUrl: e.target.value })}
            placeholder="https://api.deepseek.com/v1"
            className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
          />
        </div>

        <div className="col-span-2">
          <label className="text-xs text-muted-foreground block mb-1">API 密钥</label>
          <input
            type="password"
            value={values.apiKey}
            onChange={(e) => set({ apiKey: e.target.value })}
            placeholder="sk-..."
            className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
          />
        </div>

        <div className="col-span-2">
          <label className="text-xs text-muted-foreground block mb-1">
            嵌入模型（可选 — 启用语义记忆检索）
          </label>
          <input
            type="text"
            value={values.embeddingModel}
            onChange={(e) => set({ embeddingModel: e.target.value })}
            placeholder="text-embedding-3-small"
            className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-md text-sm border border-input hover:bg-accent transition-colors"
        >
          取消
        </button>
        <button
          onClick={() => canSubmit && onSave(values)}
          disabled={!canSubmit}
          className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

export function ModelsSettings() {
  const models = useSettingsStore((s) => s.models);
  const activeModelId = useSettingsStore((s) => s.activeModelId);
  const addModel = useSettingsStore((s) => s.addModel);
  const updateModel = useSettingsStore((s) => s.updateModel);
  const deleteModel = useSettingsStore((s) => s.deleteModel);
  const setActiveModel = useSettingsStore((s) => s.setActiveModel);

  const [showAddForm, setShowAddForm] = useState(false);

  const handleAdd = async (values: ModelFormValues) => {
    await addModel(values);
    setShowAddForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-medium mb-1">模型</h3>
          <p className="text-sm text-muted-foreground">
            配置 Agent 可用的 AI 模型。
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm hover:opacity-90 transition-opacity"
        >
          + 添加模型
        </button>
      </div>

      {showAddForm && (
        <ModelForm
          title="添加新模型"
          submitLabel="添加"
          onSave={handleAdd}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Model list */}
      <div className="space-y-2">
        {models.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            尚未配置任何模型。添加一个即可开始。
          </div>
        ) : (
          models.map((model) => (
            <ModelItem
              key={model.id}
              model={model}
              isActive={model.id === activeModelId}
              onSetActive={() => setActiveModel(model.id)}
              onUpdate={(values) => updateModel(model.id, values)}
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
  onUpdate,
  onDelete
}: {
  model: ModelConfig;
  isActive: boolean;
  onSetActive: () => void;
  onUpdate: (values: ModelFormValues) => Promise<void>;
  onDelete: () => void;
}) {
  const [testResult, setTestResult] = useState<ModelTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [editing, setEditing] = useState(false);

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

  const handleSave = async (values: ModelFormValues) => {
    await onUpdate(values);
    setEditing(false);
  };

  return (
    <div className={`p-3 rounded-lg border ${
      isActive ? 'border-primary/50 bg-primary/5' : 'border-border bg-background'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <div>
            <div className="text-sm font-medium">{model.name}</div>
            <div className="text-xs text-muted-foreground">
              {providerLabels[model.provider]} · {model.model}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isActive ? (
            <span className="text-xs text-primary font-medium">当前</span>
          ) : (
            <button
              onClick={onSetActive}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              设为当前
            </button>
          )}
          <button
            onClick={() => setEditing(!editing)}
            className="text-xs px-2 py-1 rounded border border-input hover:bg-accent transition-colors"
          >
            编辑
          </button>
          <button
            onClick={handleTest}
            disabled={testing}
            className="text-xs px-2 py-1 rounded border border-input hover:bg-accent disabled:opacity-50 transition-colors"
          >
            {testing ? '测试中…' : '测试'}
          </button>
          <button
            onClick={onDelete}
            className="text-xs text-destructive hover:text-destructive/80 transition-colors"
          >
            删除
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3">
          <ModelForm
            initial={toFormValues(model)}
            title={`编辑「${model.name}」`}
            submitLabel="保存"
            onSave={handleSave}
            onCancel={() => setEditing(false)}
          />
        </div>
      )}

      {testResult && (
        <div
          className={`mt-2 rounded-md px-3 py-2 text-xs ${
            testResult.ok
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600'
              : 'bg-destructive/10 border border-destructive/30 text-destructive'
          }`}
        >
          <div className="font-medium flex items-center gap-1.5">
            {testResult.ok ? <CheckIcon className="w-3.5 h-3.5" /> : <CloseIcon className="w-3.5 h-3.5" />}
            <span>{testResult.message}</span>
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
