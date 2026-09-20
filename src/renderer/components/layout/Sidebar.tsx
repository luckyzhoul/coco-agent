import React, { useEffect, useState } from 'react';
import { useIpcRenderer } from '../../hooks/useIpcRenderer';
import { useSessionStore } from '../../stores/useSessionStore';
import { useChatStore } from '../../stores/useChatStore';
import type { SessionInfo } from '@shared/types';

export function Sidebar() {
  const ipc = useIpcRenderer();
  const sessions = useSessionStore((s) => s.sessions);
  const currentWorkspace = useSessionStore((s) => s.currentWorkspace);
  const setSessions = useSessionStore((s) => s.setSessions);
  const setCurrentWorkspace = useSessionStore((s) => s.setCurrentWorkspace);
  const setRecentWorkspaces = useSessionStore((s) => s.setRecentWorkspaces);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const setActiveSession = useChatStore((s) => s.setActiveSession);
  const setMessages = useChatStore((s) => s.setMessages);

  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    ipc.agent.listSessions().then((s) => setSessions(s));
    ipc.workspace.getCurrent().then((ws) => setCurrentWorkspace(ws));
    ipc.workspace.listRecent().then((ws) => setRecentWorkspaces(ws));
  }, [ipc, setSessions, setCurrentWorkspace, setRecentWorkspaces]);

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

  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-card">
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

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        <div className="mb-2 px-2 text-xs font-medium text-muted-foreground">
          Sessions
        </div>
        <div className="space-y-1">
          {sessions.length === 0 ? (
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
    </div>
  );
}
