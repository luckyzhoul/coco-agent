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

  // 会话按 Agent 隔离：只显示当前 Agent 的会话。
  const sessions = activeAgentId
    ? allSessions.filter((s) => (s.agentId ?? null) === activeAgentId)
    : allSessions;

  const groups = useMemo(() => groupSessions(sessions), [sessions]);

  const activeAgent = agents.find((a) => a.id === activeAgentId);

  const [isCreating, setIsCreating] = useState(false);
  const [showMcpSection, setShowMcpSection] = useState(false);
  const [showSkillsSection, setShowSkillsSection] = useState(false);
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

  // 轮询浏览器状态（Agent 可能自行打开）
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
    <div className="flex h-full w-64 flex-col border-r border-border bg-panel">
      {/* 顶栏：标题 + 新建 + 设置 */}
      <div className="flex items-center gap-1 px-3 pb-1 pt-3">
        <h1 className="title-serif flex-1 text-[13px] tracking-widest text-foreground/85">对话</h1>
        <button
          onClick={handleNewSession}
          disabled={isCreating}
          title="新建会话"
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40"
        >
          ＋
        </button>
        <button
          onClick={onOpenSettings}
          title="设置"
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          ⚙
        </button>
      </div>

      {/* Agent 选择 */}
      <div className="px-3 pb-2">
        <select
          value={activeAgentId ?? ''}
          onChange={(e) => handleSwitchAgent(e.target.value)}
          title={activeAgent?.description || '当前助手'}
          className="w-full cursor-pointer rounded-md border border-border/70 bg-background/60 px-2 py-1.5 text-xs outline-none"
        >
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
      </div>

      {/* 搜索 */}
      <div className="px-3 pb-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索会话与消息…"
          className="w-full rounded-md border border-border/70 bg-background/60 px-2.5 py-1.5 text-xs outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/40"
        />
      </div>

      {/* 会话列表 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {searchQuery.trim() ? (
          searchResults.length === 0 ? (
            <p className="px-2 py-6 text-center text-[11px] text-muted-foreground">没有找到匹配内容</p>
          ) : (
            <div className="space-y-0.5">
              {searchResults.map((result) => (
                <button
                  key={result.session.id}
                  onClick={() => handleSwitchSession(result.session)}
                  className="w-full rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-accent/40"
                >
                  <span className="block truncate text-[13px] font-medium">{result.session.title}</span>
                  {result.matches.map((m) => (
                    <span
                      key={m.messageId}
                      className="mt-0.5 block truncate text-[11px] text-muted-foreground/80"
                    >
                      {m.snippet}
                    </span>
                  ))}
                </button>
              ))}
            </div>
          )
        ) : sessions.length === 0 ? (
          <p className="px-2 py-8 text-center text-[11px] leading-relaxed text-muted-foreground/70">
            还没有对话
            <br />
            点上方 ＋ 开始
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mb-2">
              <div className="px-2.5 py-1 text-[10px] tracking-wider text-muted-foreground/60">
                {group.label}
              </div>
              <div className="space-y-0.5">{group.items.map(renderSession)}</div>
            </div>
          ))
        )}
      </div>

      {/* MCP */}
      <div className="border-t border-border px-3 py-2">
        <button
          onClick={() => setShowMcpSection(!showMcpSection)}
          className="flex w-full items-center gap-2 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="opacity-60">{showMcpSection ? '▾' : '▸'}</span>
          <span>MCP 服务</span>
          <span className="ml-auto tabular-nums">
            {runningMcpCount}/{mcpServers.length}
          </span>
        </button>
        {showMcpSection && (
          <div className="mt-1.5 space-y-0.5">
            {mcpServers.length === 0 ? (
              <p className="px-2 py-1 text-[11px] text-muted-foreground/60">尚未配置 MCP 服务</p>
            ) : (
              mcpServers.slice(0, 5).map((server) => (
                <div key={server.id} className="flex items-center gap-2 px-2 py-0.5 text-[11px]">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      server.enabled ? 'bg-primary/70' : 'bg-muted-foreground/30'
                    }`}
                  />
                  <span className="truncate text-muted-foreground">{server.name}</span>
                </div>
              ))
            )}
            {mcpServers.length > 5 && (
              <p className="px-2 text-[11px] text-muted-foreground/60">还有 {mcpServers.length - 5} 个</p>
            )}
          </div>
        )}
      </div>

      {/* 技能 */}
      <div className="border-t border-border px-3 py-2">
        <button
          onClick={() => setShowSkillsSection(!showSkillsSection)}
          className="flex w-full items-center gap-2 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="opacity-60">{showSkillsSection ? '▾' : '▸'}</span>
          <span>技能</span>
          <span className="ml-auto tabular-nums">{skills.length}</span>
        </button>
        {showSkillsSection && (
          <div className="mt-1.5 space-y-0.5">
            {skills.length === 0 ? (
              <p className="px-2 py-1 text-[11px] text-muted-foreground/60">暂无可用技能</p>
            ) : (
              skills.slice(0, 5).map((skill) => (
                <div
                  key={skill.name}
                  className="truncate px-2 py-0.5 text-[11px] text-muted-foreground"
                  title={skill.description}
                >
                  {skill.name}
                </div>
              ))
            )}
            {skills.length > 5 && (
              <p className="px-2 text-[11px] text-muted-foreground/60">还有 {skills.length - 5} 个</p>
            )}
          </div>
        )}
      </div>

      {/* 底部：浏览器状态 + 设置 */}
      <div className="space-y-1 border-t border-border p-2">
        {browserStatus.open && (
          <div className="flex items-center gap-2 rounded-md px-2 py-1 text-[11px]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
            <span className="min-w-0 flex-1 truncate text-muted-foreground" title={browserStatus.url}>
              浏览器运行中
            </span>
            <button
              onClick={handleToggleBrowserVisible}
              className="text-muted-foreground transition-colors hover:text-foreground"
              title={browserStatus.visible ? '隐藏浏览器' : '显示浏览器'}
            >
              {browserStatus.visible ? '隐藏' : '显示'}
            </button>
            <button
              onClick={handleCloseBrowser}
              className="text-muted-foreground transition-colors hover:text-destructive"
              title="关闭浏览器"
            >
              ✕
            </button>
          </div>
        )}
        <button
          onClick={onOpenSettings}
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          <span>⚙</span>
          <span>设置</span>
        </button>
      </div>
    </div>
  );
}
