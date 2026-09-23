import type { SessionInfo } from "@shared/types";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useIpcRenderer } from "../../hooks/useIpcRenderer";
import { useAgentStore } from "../../stores/useAgentStore";
import { useChatStore } from "../../stores/useChatStore";
import { useSessionStore } from "../../stores/useSessionStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useUiStore } from "../../stores/useUiStore";
import { AgentAvatar } from "../chat/AgentAvatar";
import {
  ActivityIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CloseIcon,
  PlugIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  WrenchIcon,
} from "./icons";

interface SidebarProps {
  onOpenSettings: () => void;
}

function formatRelativeTime(ts: number): string {
  const now = new Date();
  const date = new Date(ts);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (date.toDateString() === now.toDateString()) {
    if (diffMins < 1) return "刚刚";
    if (diffMins < 60) return `${diffMins} 分钟前`;
    return `${diffHours} 小时前`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return "昨天";
  }

  if (diffDays < 7) {
    return `${diffDays} 天前`;
  }

  return date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

function groupSessionsByTime(sessions: SessionInfo[]): {
  today: SessionInfo[];
  thisWeek: SessionInfo[];
  earlier: SessionInfo[];
} {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000; // 7天内（含今天）

  const today: SessionInfo[] = [];
  const thisWeek: SessionInfo[] = [];
  const earlier: SessionInfo[] = [];

  for (const s of sessions) {
    if (s.updatedAt >= todayStart) {
      today.push(s);
    } else if (s.updatedAt >= weekStart) {
      thisWeek.push(s);
    } else {
      earlier.push(s);
    }
  }

  return { today, thisWeek, earlier };
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
  const loadMcpServers = useSettingsStore((s) => s.loadMcpServers);
  const agents = useAgentStore((s) => s.agents);
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const loadAgents = useAgentStore((s) => s.loadAgents);
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent);
  const toggleSkillsModal = useUiStore((s) => s.toggleSkillsModal);

  const activeAgent = agents.find((a) => a.id === activeAgentId) ?? null;

  const [isCreating, setIsCreating] = useState(false);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const agentPickerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    {
      session: SessionInfo;
      matches: { messageId: string; role: string; snippet: string }[];
    }[]
  >([]);
  const [browserStatus, setBrowserStatus] = useState<{
    open: boolean;
    visible: boolean;
    url: string;
  }>({ open: false, visible: false, url: "" });

  const activeSessions = useMemo(
    () => allSessions.filter((s) => !s.archived),
    [allSessions],
  );

  const grouped = useMemo(
    () => groupSessionsByTime(activeSessions),
    [activeSessions],
  );

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
      ipc.browser
        .getStatus()
        .then(setBrowserStatus)
        .catch(() => {});
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
    setBrowserStatus({ open: false, visible: false, url: "" });
  };

  useEffect(() => {
    ipc.agent.listSessions().then((s) => setSessions(s));
    ipc.workspace.getCurrent().then((ws) => setCurrentWorkspace(ws));
    ipc.workspace.listRecent().then((ws) => setRecentWorkspaces(ws));
    loadAgents();
    loadMcpServers();
  }, [
    ipc,
    setSessions,
    setCurrentWorkspace,
    setRecentWorkspaces,
    loadAgents,
    loadMcpServers,
  ]);

  // 点击外部关闭 Agent 选择器
  useEffect(() => {
    if (!showAgentPicker) return;
    const handler = (e: MouseEvent) => {
      if (
        agentPickerRef.current &&
        !agentPickerRef.current.contains(e.target as Node)
      ) {
        setShowAgentPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAgentPicker]);

  const handleSelectAgent = async (id: string) => {
    if (id === activeAgentId) {
      setShowAgentPicker(false);
      return;
    }
    await setActiveAgent(id);
    setShowAgentPicker(false);
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
      console.error("创建会话失败：", err);
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
      if (
        meta?.workspacePath &&
        meta.workspacePath !== currentWorkspace?.path
      ) {
        setCurrentWorkspace({
          path: meta.workspacePath,
          name:
            meta.workspacePath.split(/[/\\]/).filter(Boolean).pop() ||
            meta.workspacePath,
        });
      }
      const msgs = await ipc.agent.getSessionMessages(session.id);
      setMessages(msgs);
    } catch (err) {
      console.error("切换会话失败：", err);
    }
  };

  const handleDeleteSession = async (
    e: React.MouseEvent,
    session: SessionInfo,
  ) => {
    e.stopPropagation();
    if (!window.confirm(`确定删除会话「${session.title}」吗？此操作不可撤销。`))
      return;
    await ipc.agent.deleteSession(session.id);
    const updated = await ipc.agent.listSessions();
    setSessions(updated);
    if (session.id === activeSessionId) {
      setActiveSession(null);
      setMessages([]);
    }
  };

  const runningMcpCount = mcpServers.filter((s) => s.enabled).length;

  const renderSessionItem = (session: SessionInfo) => {
    const sessionAgent = agents.find((a) => a.id === session.agentId);
    const workspaceName = session.workspacePath
      ? session.workspacePath
          .split(/[/\\]/)
          .filter(Boolean)
          .pop() || session.workspacePath
      : "";
    return (
      <button
        key={session.id}
        onClick={() => handleSwitchSession(session)}
        className={`group w-full rounded-xl px-2.5 py-2 text-left transition-colors ${
          session.id === activeSessionId
            ? "bg-accent/70 text-foreground"
            : "text-foreground/80 hover:bg-accent/40"
        }`}
      >
        <div className="flex items-start gap-2">
          <AgentAvatar
            name={sessionAgent?.name || "CocoAgent"}
            agentId={sessionAgent?.id || "main"}
            size="md"
            className="mt-0.5"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="truncate text-sm font-medium">
                {session.title}
              </span>
            </div>
            <div className="truncate text-[11px] text-muted-foreground mt-0.5">
              {sessionAgent?.name || "CocoAgent"} ·{" "}
              {workspaceName || "未选择空间"} ·{" "}
              {formatRelativeTime(session.updatedAt)}
            </div>
          </div>
          <span className="flex shrink-0 self-center items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <span
              onClick={(e) => handleDeleteSession(e, session)}
              title="删除会话"
              className="flex items-center justify-center rounded p-1 text-muted-foreground hover:text-destructive"
            >
              <CloseIcon className="w-6 h-6" />
            </span>
          </span>
        </div>
      </button>
    );
  };

  return (
    <div className="flex h-full w-full flex-col border-r border-border/60 bg-card/40 backdrop-blur-sm">
      {/* Agent 切换器 */}
      <div className="px-3 pt-3 pb-2 relative" ref={agentPickerRef}>
        <button
          onClick={() => setShowAgentPicker(!showAgentPicker)}
          className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 hover:bg-accent/50 transition-colors text-left"
        >
          <AgentAvatar
            name={activeAgent?.name || "CocoAgent"}
            agentId={activeAgent?.id || "main"}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-foreground truncate">
              {activeAgent?.name || "CocoAgent"}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              {activeAgent?.description || "点击切换助手"}
            </div>
          </div>
          <ChevronDownIcon
            className="text-muted-foreground shrink-0 transition-transform"
            style={{
              transform: showAgentPicker ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        </button>

        {/* 下拉面板 */}
        {showAgentPicker && (
          <div className="absolute top-full left-3 right-3 mt-1 z-50 bg-card border border-border/60 rounded-xl shadow-lifted overflow-hidden">
            <div className="max-h-60 overflow-y-auto py-1">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => handleSelectAgent(agent.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                    agent.id === activeAgentId
                      ? "bg-accent/60 text-foreground"
                      : "text-foreground/80 hover:bg-accent/40"
                  }`}
                >
                  <AgentAvatar name={agent.name} agentId={agent.id} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate flex items-center gap-1.5">
                      {agent.name}
                      {agent.id === activeAgentId && (
                        <span className="text-[10px] text-primary font-normal">
                          当前
                        </span>
                      )}
                    </div>
                    {agent.description && (
                      <div className="text-[11px] text-muted-foreground truncate">
                        {agent.description}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div className="border-t border-border/40">
              <button
                onClick={() => {
                  setShowAgentPicker(false);
                  onOpenSettings();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-accent/40 hover:text-foreground transition-colors"
              >
                <SettingsIcon />
                <span>管理助手</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 对话标题栏 */}
      <div className="flex items-center justify-between px-4 pt-1 pb-2">
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

      <div className="px-3 pb-2 space-y-0.5">
        <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors">
          <ActivityIcon />
          <span>助手活动</span>
        </button>
        <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors">
          <ClockIcon />
          <span>任务计划</span>
        </button>
        <button
          onClick={toggleSkillsModal}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
        >
          <WrenchIcon />
          <span>Skills</span>
        </button>
      </div>

      <div className="mx-4 my-2 border-t border-border/50" />

      <div className="flex-1 overflow-y-auto">
        <div className="px-3 pb-3">
          {/* 搜索框 */}
          <div className="px-1 mb-3">
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

          <div className="space-y-3">
              {/* 搜索结果 */}
              {searchQuery.trim() ? (
                searchResults.length === 0 ? (
                  <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                    没有匹配结果
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {searchResults.map((result) => (
                      <button
                        key={result.session.id}
                        onClick={() => handleSwitchSession(result.session)}
                        className={`w-full rounded-xl px-3 py-2 text-left transition-colors ${
                          result.session.id === activeSessionId
                            ? "bg-accent/70 text-foreground"
                            : "text-foreground/80 hover:bg-accent/40"
                        }`}
                      >
                        <div className="truncate text-sm font-medium">
                          {result.session.title}
                        </div>
                        {result.matches.map((m) => (
                          <div
                            key={m.messageId}
                            className="truncate text-xs text-muted-foreground/80 mt-0.5"
                          >
                            {m.snippet}
                          </div>
                        ))}
                      </button>
                    ))}
                  </div>
                )
              ) : activeSessions.length === 0 ? (
                <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                  暂无对话
                </div>
              ) : (
                <>
                  {/* 今天 */}
                  {grouped.today.length > 0 && (
                    <div className="space-y-0.5">
                      <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                        今天
                      </div>
                      {grouped.today.map(renderSessionItem)}
                    </div>
                  )}

                  {/* 本周 */}
                  {grouped.thisWeek.length > 0 && (
                    <div className="space-y-0.5">
                      <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                        本周
                      </div>
                      {grouped.thisWeek.map(renderSessionItem)}
                    </div>
                  )}

                  {/* 更早 */}
                  {grouped.earlier.length > 0 && (
                    <div className="space-y-0.5">
                      <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                        更早
                      </div>
                      {grouped.earlier.map(renderSessionItem)}
                    </div>
                  )}
                </>
              )}
          </div>
        </div>
      </div>

      <div className="border-t border-border/50 p-2 space-y-1">
        {browserStatus.open && (
          <div className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span
              className="truncate flex-1 text-muted-foreground"
              title={browserStatus.url}
            >
              浏览器运行中
            </span>
            <button
              onClick={handleToggleBrowserVisible}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title={browserStatus.visible ? "隐藏浏览器" : "显示浏览器"}
            >
              {browserStatus.visible ? "隐藏" : "显示"}
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
