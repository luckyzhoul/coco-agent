import { useEffect, useMemo, useState } from 'react';
import {
  AGENT_ICON_KEYS,
  builtinIcon,
  type BuiltinAgentIconKey,
} from '@shared/agentIcons';
import {
  AGENT_TEMPLATES,
  DEFAULT_TEMPLATE_ID,
  TEMPLATE_NONE_ID,
  getAgentTemplate,
} from '@shared/agentTemplates';
import { useAgentStore } from '../../stores/useAgentStore';
import { AgentAvatar } from '../chat/AgentAvatar';
import { CheckIcon } from '../layout/icons';

const ICON_LABELS: Record<BuiltinAgentIconKey, string> = {
  owl: '猫头鹰',
  whale: '鲸鱼',
  fox: '狐狸',
  cat: '猫',
  mountain: '山峦',
  star: '星星',
  leaf: '叶子',
  sun: '太阳',
};

/** Create-form fields prefilled from a template ('none' leaves them blank). */
function blankAgent(templateId: string) {
  const tpl = getAgentTemplate(templateId);
  return {
    name: '',
    description: tpl?.description ?? '',
    persona: tpl?.persona ?? '',
    icon: tpl?.icon ?? '',
  };
}

/**
 * Role templates are a one-shot snapshot: picking one copies its description,
 * persona and icon onto the agent. `none` clears all three.
 */
function TemplatePicker({
  value,
  onPick,
}: {
  value: string;
  onPick: (templateId: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {AGENT_TEMPLATES.map((tpl) => {
          const isActive = value === tpl.id;
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onPick(tpl.id)}
              className={`flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-center transition-colors ${
                isActive
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-border/60 bg-card/40 hover:bg-accent/20'
              }`}
            >
              <AgentAvatar
                name={tpl.name}
                agentId={tpl.id}
                icon={tpl.icon}
                size="lg"
              />
              <div className="text-sm font-medium text-foreground">{tpl.name}</div>
              <div className="text-[11px] leading-snug text-muted-foreground">
                {tpl.description}
              </div>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onPick(TEMPLATE_NONE_ID)}
        className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
          value === TEMPLATE_NONE_ID
            ? 'border-primary/50 bg-primary/5'
            : 'border-border/60 bg-card/40 hover:bg-accent/20'
        }`}
      >
        <span className="w-10 h-10 shrink-0 rounded-full border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">
          无
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">无模板</span>
          <span className="block text-[11px] text-muted-foreground">
            空白人格，使用名称首字母头像
          </span>
        </span>
      </button>
    </div>
  );
}

export function AgentsSettings() {
  const agents = useAgentStore((s) => s.agents);
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const loadAgents = useAgentStore((s) => s.loadAgents);
  const createAgent = useAgentStore((s) => s.createAgent);
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent);
  const deleteAgent = useAgentStore((s) => s.deleteAgent);
  const updateAgent = useAgentStore((s) => s.updateAgent);
  const getPersona = useAgentStore((s) => s.getPersona);
  const setPersona = useAgentStore((s) => s.setPersona);
  const uploadIcon = useAgentStore((s) => s.uploadIcon);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [persona, setPersonaText] = useState('');
  const [savingPersona, setSavingPersona] = useState(false);
  const [personaSaved, setPersonaSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newAgent, setNewAgent] = useState(() => blankAgent(DEFAULT_TEMPLATE_ID));
  const [newTemplateId, setNewTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  useEffect(() => {
    if (!selectedId && activeAgentId) setSelectedId(activeAgentId);
  }, [activeAgentId, selectedId]);

  useEffect(() => {
    if (selectedId) {
      getPersona(selectedId).then(setPersonaText).catch(() => setPersonaText(''));
    }
    setIconPickerOpen(false);
    setPendingTemplateId(null);
  }, [selectedId, getPersona]);

  const selected = agents.find((a) => a.id === selectedId);

  /** Highlight the template whose persona the agent currently carries. */
  const appliedTemplateId = useMemo(() => {
    const body = persona.trim();
    if (!body) return TEMPLATE_NONE_ID;
    return AGENT_TEMPLATES.find((t) => t.persona === body)?.id ?? '';
  }, [persona]);

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSavePersona = () =>
    run(async () => {
      if (!selectedId) return;
      setSavingPersona(true);
      await setPersona(selectedId, persona);
      setSavingPersona(false);
      setPersonaSaved(true);
      setTimeout(() => setPersonaSaved(false), 2000);
    });

  const handleCreate = () =>
    run(async () => {
      if (!newAgent.name.trim()) return;
      const agent = await createAgent({
        name: newAgent.name.trim(),
        description: newAgent.description.trim(),
        persona: newAgent.persona.trim() || undefined,
        icon: newAgent.icon || undefined,
      });
      setSelectedId(agent.id);
      setNewAgent(blankAgent(DEFAULT_TEMPLATE_ID));
      setNewTemplateId(DEFAULT_TEMPLATE_ID);
      setShowCreate(false);
    });

  const handleDelete = (id: string) =>
    run(async () => {
      await deleteAgent(id);
      if (selectedId === id) setSelectedId(null);
    });

  /** Templates prefill the create form; every field stays editable. */
  const pickTemplateForNew = (templateId: string) => {
    setNewTemplateId(templateId);
    setNewAgent((prev) => ({ ...blankAgent(templateId), name: prev.name }));
  };

  const applyPendingTemplate = () =>
    run(async () => {
      if (!selected || !pendingTemplateId) return;
      const tpl = getAgentTemplate(pendingTemplateId);
      const description = tpl?.description ?? '';
      const body = tpl?.persona ?? '';
      await updateAgent(selected.id, { description, icon: tpl?.icon ?? '' });
      await setPersona(selected.id, body);
      setPersonaText(body);
      setPendingTemplateId(null);
    });

  const applyIcon = (icon: string) =>
    run(async () => {
      if (!selected) return;
      await updateAgent(selected.id, { icon });
      setIconPickerOpen(false);
    });

  const handleUploadIcon = () =>
    run(async () => {
      if (!selected) return;
      const updated = await uploadIcon(selected.id);
      if (updated) setIconPickerOpen(false);
    });

  const pendingTemplate = pendingTemplateId
    ? getAgentTemplate(pendingTemplateId)
    : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-medium mb-1">Agent</h3>
          <p className="text-sm text-muted-foreground">
            每个 Agent 拥有独立的人格、记忆和会话。Agent 以文件夹形式存放在
            <code className="bg-muted px-1 rounded">COCO_HOME/agents/</code> 下。
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm hover:opacity-90 transition-opacity"
        >
          + 新建 Agent
        </button>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {showCreate && (
        <div className="bg-background border border-border rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-medium">新建 Agent</h4>
          <input
            type="text"
            value={newAgent.name}
            onChange={(e) =>
              setNewAgent((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder="名称，例如 研究助手"
            className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
          />

          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground">角色模板</div>
            <TemplatePicker value={newTemplateId} onPick={pickTemplateForNew} />
          </div>

          <input
            type="text"
            value={newAgent.description}
            onChange={(e) =>
              setNewAgent((prev) => ({ ...prev, description: e.target.value }))
            }
            placeholder="简短描述（可选）"
            className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
          />
          <textarea
            value={newAgent.persona}
            onChange={(e) =>
              setNewAgent((prev) => ({ ...prev, persona: e.target.value }))
            }
            placeholder="人格设定（可选）— 这个 Agent 该如何说话和行动？"
            rows={3}
            className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm resize-none"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowCreate(false)}
              className="px-3 py-1.5 rounded-md text-sm border border-input hover:bg-accent transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={!newAgent.name.trim()}
              className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              创建
            </button>
          </div>
        </div>
      )}

      {/* Agent list */}
      <div className="space-y-2">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className={`p-3 rounded-lg border ${
              agent.id === selectedId
                ? 'border-primary/50 bg-primary/5'
                : 'border-border bg-background'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => setSelectedId(agent.id)}
                className="text-left min-w-0 flex-1 flex items-center gap-2.5"
              >
                <AgentAvatar
                  name={agent.name}
                  agentId={agent.id}
                  icon={agent.icon}
                  size="md"
                />
                <span className="min-w-0">
                  <span className="text-sm font-medium flex items-center gap-2">
                    {agent.name}
                    {agent.id === activeAgentId && (
                      <span className="text-xs text-primary font-normal">当前</span>
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground truncate">
                    {agent.description || '无描述'} · <code>{agent.id}</code>
                  </span>
                </span>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                {agent.id !== activeAgentId && (
                  <button
                    onClick={() => run(() => setActiveAgent(agent.id))}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    设为当前
                  </button>
                )}
                <input
                  type="text"
                  defaultValue={agent.name}
                  onBlur={(e) => {
                    const name = e.target.value.trim();
                    if (name && name !== agent.name) {
                      run(() => updateAgent(agent.id, { name }));
                    }
                  }}
                  className="w-28 bg-background border border-input rounded px-2 py-1 text-xs"
                />
                {agent.id !== 'main' && (
                  <button
                    onClick={() => handleDelete(agent.id)}
                    className="text-xs text-destructive hover:text-destructive/80 transition-colors"
                  >
                    删除
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="border-t border-border pt-6 space-y-5">
          {/* Icon picker */}
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium">头像 — {selected.name}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                选择内置图标或上传自己的图片；未设置时显示名称首字母。
              </p>
            </div>
            <div className="flex items-center gap-3">
              <AgentAvatar
                name={selected.name}
                agentId={selected.id}
                icon={selected.icon}
                size="lg"
              />
              <button
                onClick={() => setIconPickerOpen(!iconPickerOpen)}
                className="px-3 py-1.5 rounded-md text-sm border border-input hover:bg-accent transition-colors"
              >
                {iconPickerOpen ? '收起' : '更换图标'}
              </button>
            </div>

            {iconPickerOpen && (
              <div className="rounded-lg border border-border bg-background p-3 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {AGENT_ICON_KEYS.map((key) => {
                    const value = builtinIcon(key);
                    const isActive = selected.icon === value;
                    return (
                      <button
                        key={key}
                        type="button"
                        title={ICON_LABELS[key]}
                        onClick={() => applyIcon(value)}
                        className={`rounded-full p-0.5 transition-all ${
                          isActive
                            ? 'ring-2 ring-primary'
                            : 'hover:bg-accent/40'
                        }`}
                      >
                        <AgentAvatar
                          name={selected.name}
                          agentId={key}
                          icon={value}
                          size="md"
                        />
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 pt-3 border-t border-border/60">
                  <button
                    onClick={handleUploadIcon}
                    className="px-3 py-1.5 rounded-md text-sm border border-input hover:bg-accent transition-colors"
                  >
                    上传自定义头像
                  </button>
                  <button
                    onClick={() => applyIcon('')}
                    className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    使用首字母
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Template switcher */}
          <div className="space-y-2">
            <div>
              <h4 className="text-sm font-medium">角色模板</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                应用模板会覆盖该 Agent 当前的描述、人格与图标。
              </p>
            </div>
            <TemplatePicker
              value={pendingTemplateId ?? appliedTemplateId}
              onPick={(id) => setPendingTemplateId(id)}
            />
            {pendingTemplateId && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
                <span className="text-xs text-foreground">
                  {pendingTemplate
                    ? `应用「${pendingTemplate.name}」将覆盖该 Agent 当前的描述、人格与图标。`
                    : '将清空该 Agent 的描述、人格与图标。'}
                </span>
                <span className="flex gap-2">
                  <button
                    onClick={() => setPendingTemplateId(null)}
                    className="px-2.5 py-1 rounded-md text-xs border border-input hover:bg-accent transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={applyPendingTemplate}
                    className="px-2.5 py-1 rounded-md text-xs bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                  >
                    确认应用
                  </button>
                </span>
              </div>
            )}
          </div>

          {/* Persona editor */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium">人格 — {selected.name}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  会注入该 Agent 的系统提示词。支持 Markdown。
                </p>
              </div>
              <button
                onClick={handleSavePersona}
                disabled={savingPersona}
                className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {savingPersona ? '保存中…' : personaSaved ? (
                  <span className="inline-flex items-center gap-1">
                    <CheckIcon className="w-3.5 h-3.5" />
                    已保存
                  </span>
                ) : '保存人格'}
              </button>
            </div>
            <textarea
              value={persona}
              onChange={(e) => setPersonaText(e.target.value)}
              rows={10}
              placeholder={`例如：\n你是一位严谨细致的研究助手。你说话简洁，\n总是引用来源，在着手长任务前会先提出\n澄清性问题。`}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm font-mono resize-y"
            />
          </div>
        </div>
      )}
    </div>
  );
}
