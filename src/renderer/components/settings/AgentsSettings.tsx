import { useEffect, useState } from 'react';
import { useAgentStore } from '../../stores/useAgentStore';
import { CheckIcon } from '../layout/icons';

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

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [persona, setPersonaText] = useState('');
  const [savingPersona, setSavingPersona] = useState(false);
  const [personaSaved, setPersonaSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: '', description: '', persona: '' });

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
  }, [selectedId, getPersona]);

  const selected = agents.find((a) => a.id === selectedId);

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
        persona: newAgent.persona.trim() || undefined
      });
      setSelectedId(agent.id);
      setNewAgent({ name: '', description: '', persona: '' });
      setShowCreate(false);
    });

  const handleDelete = (id: string) =>
    run(async () => {
      await deleteAgent(id);
      if (selectedId === id) setSelectedId(null);
    });

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
            onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
            placeholder="名称，例如 研究助手"
            className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
          />
          <input
            type="text"
            value={newAgent.description}
            onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })}
            placeholder="简短描述（可选）"
            className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
          />
          <textarea
            value={newAgent.persona}
            onChange={(e) => setNewAgent({ ...newAgent, persona: e.target.value })}
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
                className="text-left min-w-0 flex-1"
              >
                <div className="text-sm font-medium flex items-center gap-2">
                  {agent.name}
                  {agent.id === activeAgentId && (
                    <span className="text-xs text-primary font-normal">当前</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {agent.description || '无描述'} · <code>{agent.id}</code>
                </div>
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

      {/* Persona editor */}
      {selected && (
        <div className="border-t border-border pt-6 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium">
                人格 — {selected.name}
              </h4>
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
      )}
    </div>
  );
}
