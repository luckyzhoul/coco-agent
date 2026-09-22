import React, { useEffect, useMemo, useState } from 'react';
import { useIpcRenderer } from '../../hooks/useIpcRenderer';
import { useSessionStore } from '../../stores/useSessionStore';
import { useChatStore } from '../../stores/useChatStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useAgentStore } from '../../stores/useAgentStore';
import {
  PlusIcon,
  SettingsIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PaperclipIcon,
  ActivityIcon,
  ClockIcon,
  WrenchIcon,
  SearchIcon,
  PinIcon,
  CloseIcon,
  PlugIcon
} from './icons';
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
            {session.pinned && <PinIcon className="shrink-0 text-primary" />}
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
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <PinIcon />
          </span>
          <span
            onClick={(e) => handleDeleteSession(e, session)}
            title="删除会话"
            className="rounded p-0.5 text-muted-foreground hover:text-destructive"
          >
            <CloseIcon />
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
            <PlusIcon />
          </button>
          <button
            onClick={onOpenSettings}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="设置"
          >
            <SettingsIcon />
          </button>
          <button
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="收起侧栏"
          >
            <ChevronLeftIcon />
          </button>
        </div>
      </div>

      <div className="px-3 pb-3">
        <div className="flex items-center gap-2 rounded-xl bg-input/60 px-3 py-2 text-sm">
          <PaperclipIcon className="text-[#5B7FA6]" />
          <span className="truncate flex-1 text-left text-foreground/80">
            {currentWorkspace?.name || '选择工作台'}
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-500/70" />
        </div>
      </div>

      <div className="px-3 pb-2 space-y-0.5">
        <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors">
          <ActivityIcon />
          <span>助手活动</span>
        </button>
        <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors">
          <ClockIcon />
          <span>任务计划</span>
        </button>
        <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors">
          <WrenchIcon />
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
              <ChevronRightIcon
                style={{ transform: showSessionsSection ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
              />
            </button>
            <span className="text-xs font-medium text-muted-foreground">搜索聊天记录</span>
          </div>

          <div className="px-1 mb-2">
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
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
            <ChevronRightIcon
              style={{ transform: showMcpSection ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
            />
            <PlugIcon />
            <span>MCP</span>
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
            <ChevronRightIcon
              style={{ transform: showSkillsSection ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
            />
            <WrenchIcon />
            <span>Skills</span>
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
              <CloseIcon className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
