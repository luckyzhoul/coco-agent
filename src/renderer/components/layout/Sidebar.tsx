import React, { useEffect, useMemo, useState } from 'react';
import { useIpcRenderer } from '../../hooks/useIpcRenderer';
import { useSessionStore } from '../../stores/useSessionStore';
import { useChatStore } from '../../stores/useChatStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useAgentStore } from '../../stores/useAgentStore';
import type { SessionInfo } from '@shared/types';

interface SidebarProps {
  onOpenSettings: () => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** 置顶 → 今天 → 本周 → 更早 */
function groupSessions(sessions: SessionInfo[]): { label: string; items: SessionInfo[] }[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  // Week starts on Monday.
  const mondayOffset = (now.getDay() + 6) % 7;
  const startOfWeek = startOfToday - mondayOffset * DAY_MS;

  const groups: { label: string; items: SessionInfo[] }[] = [
    { label: '置顶', items: [] },
    { label: '今天', items: [] },
    { label: '本周', items: [] },
    { label: '更早', items: [] }
  ];

  for (const session of sessions) {
    if (session.pinned) groups[0].items.push(session);
    else if (session.updatedAt >= startOfToday) groups[1].items.push(session);
    else if (session.updatedAt >= startOfWeek) groups[2].items.push(session);
    else groups[3].items.push(session);
  }

  return groups.filter((group) => group.items.length > 0);
}

function formatTime(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
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

  const sessions = activeAgentId
    ? allSessions.filter((s) => (s.agentId ?? null) === activeAgentId)
    : allSessions;

  const groups = useMemo(() => groupSessions(sessions), [sessions]);

  const activeAgent = agents.find((a) => a.id === activeAgentId);

  const [isCreating, setIsCreating] = useState(false);
  const [showMcpSection, setShowMcpSection] = useState(true);
  const [showSkillsSection, setShowSkillsSection] = useState(true);
  const [showSessionsSection, setShowSessionsSection] = useState(true);
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
    const updated = await ipc.agent.listSessions();
    setSessions(updated);
    setActiveSession(null);
    setMessages([]);
  };

  const handleNewSession = async () => {
    setIsCreating(true);
    try {
      // 新会话默认落在当前项目空间；没有就退回默认空间（~/Desktop/CocoSpace）。
      const workspace = currentWorkspace ?? (await ipc.workspace.getDefault());
      if (!currentWorkspace) setCurrentWorkspace(workspace);

      const sessionId = await ipc.agent.newSession(workspace.path);
      setActiveSession(sessionId);
      setMessages([]);

      const updated = await ipc.agent.listSessions();
      setSessions(updated);
    } catch (err) {
      console.error('创建会话失败：', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSwitchSession = async (session: SessionInfo) => {
    if (session.id === activeSessionId) return;

    try {
      const meta = await ipc.agent.switchSession(session.id);
      setActiveSession(session.id);
      // 会话与项目空间绑定：切会话即切空间（主进程的 cwd / PathGuard 已跟随）。
      if (meta?.workspacePath && meta.workspacePath !== currentWorkspace?.path) {
        setCurrentWorkspace({
          path: meta.workspacePath,
          name: meta.workspacePath.split(/[/\\]/).filter(Boolean).pop() || meta.workspacePath
        });
      }
      const msgs = await ipc.agent.getSessionMessages(session.id);
      setMessages(msgs);
    } catch (err) {
      console.error('切换会话失败：', err);
    }
  };

  const handleTogglePin = async (e: React.MouseEvent, session: SessionInfo) => {
    e.stopPropagation();
    const updated = await ipc.agent.setPinned(session.id, !session.pinned);
    setSessions(updated);
  };

  const handleDeleteSession = async (e: React.MouseEvent, session: SessionInfo) => {
    e.stopPropagation();
    if (!window.confirm(`确定删除会话「${session.title}」吗？此操作不可撤销。`)) return;
    await ipc.agent.deleteSession(session.id);
    const updated = await ipc.agent.listSessions();
    setSessions(updated);
    if (session.id === activeSessionId) {
      setActiveSession(null);
      setMessages([]);
    }
  };

  const runningMcpCount = mcpServers.filter((s) => s.enabled).length;

  const renderSession = (session: SessionInfo) => {
    const active = session.id === activeSessionId;
    return (
      <button
        key={session.id}
        onClick={() => handleSwitchSession(session)}
        className={`group flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
          active ? 'bg-accent/80 text-foreground' : 'text-foreground/80 hover:bg-accent/40'
        }`}
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1">
            {session.pinned && <span className="shrink-0 text-[10px] text-primary">📌</span>}
            <span className="truncate text-[13px] font-medium">{session.title}</span>
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground/80">
            {formatTime(session.updatedAt)} · {session.messageCount} 条
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <span
            onClick={(e) => handleTogglePin(e, session)}
            title={session.pinned ? '取消置顶' : '置顶'}
            className="rounded p-0.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            📌
          </span>
          <span
            onClick={(e) => handleDeleteSession(e, session)}
            title="删除会话"
            className="rounded p-0.5 text-[11px] text-muted-foreground hover:text-destructive"
          >
            ✕
          </span>
        </span>
      </button>
    );
  };

  return (
    <div className="flex h-full w-64 flex-col border-r border-border/60 bg-card/40 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 pt-2 pb-3">
        <span className="text-sm font-medium text-foreground/80">对话</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewSession}
            disabled={isCreating}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="新建对话"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </button>
          <button
            onClick={onOpenSettings}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="设置"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="收起侧栏"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-3 pb-3">
        <div className="flex items-center gap-2 rounded-xl bg-input/60 px-3 py-2 text-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#5B7FA6]">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="truncate flex-1 text-left text-foreground/80">
            {currentWorkspace?.name || '选择工作台'}
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-500/70" />
        </div>
      </div>

      <div className="px-3 pb-2 space-y-0.5">
        <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
          </svg>
          <span>助手活动</span>
        </button>
        <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" strokeLinecap="round" />
          </svg>
          <span>任务计划</span>
        </button>
        <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" strokeLinejoin="round" />
          </svg>
          <span>Skills</span>
        </button>
      </div>

      <div className="mx-4 my-2 border-t border-border/50" />

      <div className="flex-1 overflow-y-auto">
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2 mb-2 px-2">
            <button
              onClick={() => setShowSessionsSection(!showSessionsSection)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                style={{ transform: showSessionsSection ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
              >
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="text-xs font-medium text-muted-foreground">搜索聊天记录</span>
          </div>

          <div className="px-1 mb-2">
            <div className="relative">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索聊天记录"
                className="w-full bg-input/50 border border-transparent rounded-xl pl-8 pr-3 py-1.5 text-xs outline-none placeholder:text-muted-foreground/50 focus:border-border/60 focus:bg-chat-assistant transition-colors"
              />
            </div>
          </div>

          {showSessionsSection && (
            <div className="space-y-0.5">
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                置顶
              </div>

              <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                今天
              </div>

              {searchQuery.trim() ? (
                searchResults.length === 0 ? (
                  <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                    没有匹配结果
                  </div>
                ) : (
                  searchResults.map((result) => (
                    <button
                      key={result.session.id}
                      onClick={() => handleSwitchSession(result.session)}
                      className={`w-full rounded-xl px-3 py-2 text-left transition-colors ${
                        result.session.id === activeSessionId
                          ? 'bg-accent/70 text-foreground'
                          : 'text-foreground/80 hover:bg-accent/40'
                      }`}
                    >
                      <div className="truncate text-sm font-medium">{result.session.title}</div>
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
                  暂无对话
                </div>
              ) : (
                sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => handleSwitchSession(session)}
                    className={`w-full rounded-xl px-3 py-2 text-left transition-colors ${
                      session.id === activeSessionId
                        ? 'bg-accent/70 text-foreground'
                        : 'text-foreground/80 hover:bg-accent/40'
                    }`}
                  >
                    <div className="truncate text-sm font-medium">{session.title}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {activeAgent?.name || 'CocoAgent'} · {formatTime(session.updatedAt)}
                    </div>
                  </button>
                ))
              )}

              <div className="px-2 py-1 mt-2 text-xs font-medium text-muted-foreground">
                本周
              </div>
            </div>
          )}
        </div>

        <div className="px-3 pb-3 border-t border-border/40 pt-3">
          <button
            onClick={() => setShowMcpSection(!showMcpSection)}
            className="flex w-full items-center gap-2 mb-2 px-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              style={{ transform: showMcpSection ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
            >
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>🔌 MCP</span>
            <span className="ml-auto text-xs text-muted-foreground/70">
              {runningMcpCount}/{mcpServers.length} 运行中
            </span>
          </button>

          {showMcpSection && (
            <div className="space-y-0.5">
              {mcpServers.length === 0 ? (
                <div className="px-2 py-2 text-center text-xs text-muted-foreground/60">
                  暂无 MCP 服务器
                </div>
              ) : (
                mcpServers.slice(0, 5).map((server) => (
                  <div
                    key={server.id}
                    className="flex items-center gap-2 px-2 py-1 text-xs"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      server.enabled ? 'bg-emerald-500' : 'bg-muted'
                    }`} />
                    <span className="truncate text-muted-foreground">
                      {server.name}
                    </span>
                  </div>
                ))
              )}
              {mcpServers.length > 5 && (
                <div className="px-2 py-1 text-xs text-muted-foreground/60">
                  +{mcpServers.length - 5} 更多
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-3 pb-3 border-t border-border/40 pt-3">
          <button
            onClick={() => setShowSkillsSection(!showSkillsSection)}
            className="flex w-full items-center gap-2 mb-2 px-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              style={{ transform: showSkillsSection ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
            >
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>🧩 Skills</span>
            <span className="ml-auto text-xs text-muted-foreground/70">{skills.length} 已加载</span>
          </button>

          {showSkillsSection && (
            <div className="space-y-0.5">
              {skills.length === 0 ? (
                <div className="px-2 py-2 text-center text-xs text-muted-foreground/60">
                  未找到技能
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
                  +{skills.length - 5} 更多
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border/50 p-2 space-y-1">
        {browserStatus.open && (
          <div className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="truncate flex-1 text-muted-foreground" title={browserStatus.url}>
              浏览器运行中
            </span>
            <button
              onClick={handleToggleBrowserVisible}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title={browserStatus.visible ? '隐藏浏览器' : '显示浏览器'}
            >
              {browserStatus.visible ? '隐藏' : '显示'}
            </button>
            <button
              onClick={handleCloseBrowser}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="关闭浏览器"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
