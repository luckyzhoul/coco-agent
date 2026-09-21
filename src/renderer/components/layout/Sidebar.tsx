import React, { useEffect, useState } from 'react';
import { useIpcRenderer } from '../../hooks/useIpcRenderer';
import { useSessionStore } from '../../stores/useSessionStore';
import { useChatStore } from '../../stores/useChatStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useAgentStore } from '../../stores/useAgentStore';
import type { SessionInfo } from '@shared/types';

interface SidebarProps {
  onOpenSettings: () => void;
}

export function Sidebar({ onOpenSettings }: SidebarProps) {
  const ipc = useIpcRenderer();
  const allSessions = useSessionStore((s) => s.sessions);
  const currentWorkspace = useSessionStore((s) => s.currentWorkspace);
  const setSessions = useSessionStore((s) => s.setSessions);
  const setCurrentWorkspace = useSessionStore((s) => s.setCurrentWorkspace);
  const setRecentWorkspaces = useSessionStore((s) => s.setRecentWorkspaces);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const setActiveSession = useChatStore((s) => s.setActiveSession);
  const setMessages = useChatStore((s) => s.setMessages);
  const mcpServers = useSettingsStore((s) => s.mcpServers);
  const skills = useSettingsStore((s) => s.skills);
  const loadMcpServers = useSettingsStore((s) => s.loadMcpServers);
  const loadSkills = useSettingsStore((s) => s.loadSkills);
  const agents = useAgentStore((s) => s.agents);
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const loadAgents = useAgentStore((s) => s.loadAgents);
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent);

  // Sessions are agent-scoped: only show the active agent's.
  const sessions = activeAgentId
    ? allSessions.filter((s) => (s.agentId ?? null) === activeAgentId)
    : allSessions;

  const activeAgent = agents.find((a) => a.id === activeAgentId);

  const [isCreating, setIsCreating] = useState(false);
  const [showMcpSection, setShowMcpSection] = useState(true);
  const [showSkillsSection, setShowSkillsSection] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    { session: SessionInfo; matches: { messageId: string; role: string; snippet: string }[] }[]
  >([]);
  const [browserStatus, setBrowserStatus] = useState<{
    open: boolean;
    visible: boolean;
    url: string;
  }>({ open: false, visible: false, url: '' });

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      ipc.agent.searchSessions(query).then(setSearchResults);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, ipc]);

  // Poll agent-browser status
  useEffect(() => {
    const poll = () => {
      ipc.browser.getStatus().then(setBrowserStatus).catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [ipc]);

  const handleToggleBrowserVisible = async () => {
    const next = !browserStatus.visible;
    await ipc.browser.setVisible(next);
    setBrowserStatus((s) => ({ ...s, visible: next }));
  };

  const handleCloseBrowser = async () => {
    await ipc.browser.close();
    setBrowserStatus({ open: false, visible: false, url: '' });
  };

  useEffect(() => {
    ipc.agent.listSessions().then((s) => setSessions(s));
    ipc.workspace.getCurrent().then((ws) => setCurrentWorkspace(ws));
    ipc.workspace.listRecent().then((ws) => setRecentWorkspaces(ws));
    loadAgents();
    loadMcpServers();
    loadSkills();
  }, [ipc, setSessions, setCurrentWorkspace, setRecentWorkspaces, loadAgents, loadMcpServers, loadSkills]);

  const handleSwitchAgent = async (id: string) => {
    if (id === activeAgentId) return;
    await setActiveAgent(id);
    // Sessions are filtered by agent on the client, but the list may have
    // changed on disk (e.g. a session was created under another agent).
    const updated = await ipc.agent.listSessions();
    setSessions(updated);
    setActiveSession(null);
    setMessages([]);
  };

  const handleNewSession = async () => {
    let workspace = currentWorkspace;

    if (!workspace) {
      const selected = await ipc.workspace.select();
      if (!selected) return;
      workspace = selected;
      setCurrentWorkspace(selected);
    }

    setIsCreating(true);
    try {
      const sessionId = await ipc.agent.newSession(workspace.path);
      setActiveSession(sessionId);
      setMessages([]);

      const updated = await ipc.agent.listSessions();
      setSessions(updated);
    } catch (err) {
      console.error('Failed to create session:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSwitchSession = async (session: SessionInfo) => {
    if (session.id === activeSessionId) return;

    try {
      await ipc.agent.switchSession(session.id);
      setActiveSession(session.id);
      const msgs = await ipc.agent.getSessionMessages(session.id);
      setMessages(msgs);
    } catch (err) {
      console.error('Failed to switch session:', err);
    }
  };

  const handleSelectWorkspace = async () => {
    const selected = await ipc.workspace.select();
    if (selected) {
      setCurrentWorkspace(selected);
    }
  };

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString();
  };

  const runningMcpCount = mcpServers.filter(s => s.enabled).length;

  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-card">
      {/* Agent selector */}
      <div className="border-b border-border p-3">
        <select
          value={activeAgentId ?? ''}
          onChange={(e) => handleSwitchAgent(e.target.value)}
          title={activeAgent?.description || 'Active agent'}
          className="w-full bg-background border border-input rounded-md px-2 py-1.5 text-sm cursor-pointer"
        >
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              🎭 {agent.name}
            </option>
          ))}
        </select>
      </div>

      {/* Workspace selector */}
      <div className="border-b border-border p-3">
        <button
          onClick={handleSelectWorkspace}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
        >
          <span>📁</span>
          <span className="truncate flex-1 text-left">
            {currentWorkspace?.name || 'Select workspace'}
          </span>
          <span className="text-muted-foreground">⋯</span>
        </button>
      </div>

      {/* New session button */}
      <div className="p-3">
        <button
          onClick={handleNewSession}
          disabled={isCreating}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <span>+</span>
          New Chat
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Session list */}
        <div className="px-2 pb-3">
          <div className="mb-2 px-2 text-xs font-medium text-muted-foreground">
            Sessions
          </div>

          {/* Search input */}
          <div className="px-1 mb-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sessions..."
              className="w-full bg-background border border-input rounded-md px-2 py-1 text-xs outline-none placeholder:text-muted-foreground/60 focus:border-primary/50"
            />
          </div>

          <div className="space-y-1">
            {searchQuery.trim() ? (
              searchResults.length === 0 ? (
                <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                  No matches
                </div>
              ) : (
                searchResults.map((result) => (
                  <button
                    key={result.session.id}
                    onClick={() => handleSwitchSession(result.session)}
                    className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                      result.session.id === activeSessionId
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                    }`}
                  >
                    <div className="truncate font-medium">{result.session.title}</div>
                    {result.matches.map((m) => (
                      <div
                        key={m.messageId}
                        className="truncate text-xs text-muted-foreground/80 mt-0.5"
                      >
                        {m.snippet}
                      </div>
                    ))}
                  </button>
                ))
              )
            ) : sessions.length === 0 ? (
              <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                No sessions yet
              </div>
            ) : (
              sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => handleSwitchSession(session)}
                  className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                    session.id === activeSessionId
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  }`}
                >
                  <div className="truncate font-medium">{session.title}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {formatTime(session.updatedAt)} · {session.messageCount} msgs
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* MCP section */}
        <div className="px-2 pb-3 border-t border-border pt-3">
          <button
            onClick={() => setShowMcpSection(!showMcpSection)}
            className="flex w-full items-center gap-2 mb-2 px-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>{showMcpSection ? '▼' : '▶'}</span>
            <span>🔌 MCP</span>
            <span className="ml-auto text-xs">
              {runningMcpCount}/{mcpServers.length} running
            </span>
          </button>

          {showMcpSection && (
            <div className="space-y-1">
              {mcpServers.length === 0 ? (
                <div className="px-2 py-2 text-center text-xs text-muted-foreground/60">
                  No MCP servers
                </div>
              ) : (
                mcpServers.slice(0, 5).map((server) => (
                  <div
                    key={server.id}
                    className="flex items-center gap-2 px-2 py-1 text-xs"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      server.enabled ? 'bg-green-400' : 'bg-muted'
                    }`} />
                    <span className="truncate text-muted-foreground">
                      {server.name}
                    </span>
                  </div>
                ))
              )}
              {mcpServers.length > 5 && (
                <div className="px-2 py-1 text-xs text-muted-foreground/60">
                  +{mcpServers.length - 5} more
                </div>
              )}
            </div>
          )}
        </div>

        {/* Skills section */}
        <div className="px-2 pb-3 border-t border-border pt-3">
          <button
            onClick={() => setShowSkillsSection(!showSkillsSection)}
            className="flex w-full items-center gap-2 mb-2 px-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>{showSkillsSection ? '▼' : '▶'}</span>
            <span>🧩 Skills</span>
            <span className="ml-auto text-xs">{skills.length} loaded</span>
          </button>

          {showSkillsSection && (
            <div className="space-y-1">
              {skills.length === 0 ? (
                <div className="px-2 py-2 text-center text-xs text-muted-foreground/60">
                  No skills found
                </div>
              ) : (
                skills.slice(0, 5).map((skill) => (
                  <div
                    key={skill.name}
                    className="px-2 py-1 text-xs text-muted-foreground truncate"
                    title={skill.description}
                  >
                    {skill.name}
                  </div>
                ))
              )}
              {skills.length > 5 && (
                <div className="px-2 py-1 text-xs text-muted-foreground/60">
                  +{skills.length - 5} more
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer: Browser control + Settings */}
      <div className="border-t border-border p-2 space-y-1">
        {browserStatus.open && (
          <div className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="truncate flex-1 text-muted-foreground" title={browserStatus.url}>
              Browser active
            </span>
            <button
              onClick={handleToggleBrowserVisible}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title={browserStatus.visible ? 'Hide browser' : 'Show browser'}
            >
              {browserStatus.visible ? '🙈' : '👁'}
            </button>
            <button
              onClick={handleCloseBrowser}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Close browser"
            >
              ✕
            </button>
          </div>
        )}
        <button
          onClick={onOpenSettings}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <span>⚙️</span>
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}
