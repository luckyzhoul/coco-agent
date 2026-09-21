import { useEffect, useState } from 'react';
import { useAgentStore } from '../../stores/useAgentStore';

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
          <h3 className="text-base font-medium mb-1">Agents</h3>
          <p className="text-sm text-muted-foreground">
            Each agent has its own persona, memory, and sessions. Agents are stored as folders
            under <code className="bg-muted px-1 rounded">COCO_HOME/agents/</code>.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm hover:opacity-90 transition-opacity"
        >
          + New Agent
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {showCreate && (
        <div className="bg-background border border-border rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-medium">New Agent</h4>
          <input
            type="text"
            value={newAgent.name}
            onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
            placeholder="Name, e.g. Research Assistant"
            className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
          />
          <input
            type="text"
            value={newAgent.description}
            onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })}
            placeholder="Short description (optional)"
            className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
          />
          <textarea
            value={newAgent.persona}
            onChange={(e) => setNewAgent({ ...newAgent, persona: e.target.value })}
            placeholder="Persona (optional) — how should this agent speak and behave?"
            rows={3}
            className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm resize-none"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowCreate(false)}
              className="px-3 py-1.5 rounded-md text-sm border border-input hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!newAgent.name.trim()}
              className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              Create
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
                    <span className="text-xs text-primary font-normal">Active</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {agent.description || 'No description'} · <code>{agent.id}</code>
                </div>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                {agent.id !== activeAgentId && (
                  <button
                    onClick={() => run(() => setActiveAgent(agent.id))}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Set Active
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
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Delete
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
                Persona — {selected.name}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Injected into this agent's system prompt. Markdown supported.
              </p>
            </div>
            <button
              onClick={handleSavePersona}
              disabled={savingPersona}
              className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {savingPersona ? 'Saving…' : personaSaved ? '✓ Saved' : 'Save Persona'}
            </button>
          </div>
          <textarea
            value={persona}
            onChange={(e) => setPersonaText(e.target.value)}
            rows={10}
            placeholder={`e.g.\nYou are a meticulous research assistant. You speak concisely,\nalways cite sources, and ask clarifying questions before\ndiving into a long task.`}
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm font-mono resize-y"
          />
        </div>
      )}
    </div>
  );
}
