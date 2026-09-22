import React, { useEffect, useRef, useState } from 'react';
import { useIpcRenderer } from '../../hooks/useIpcRenderer';

const NO_DRAG = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;
import { useUiStore } from '../../stores/useUiStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useAgentStore } from '../../stores/useAgentStore';
import {
  CloseIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SparkleIcon,
  WrenchIcon,
  PinIcon,
  CheckIcon,
  RefreshCwIcon,
  Folder2Icon,
  DownloadIcon
} from '../layout/icons';
import type { SkillInfo, AgentInfo } from '@shared/types';

type TabType = 'all' | string; // 'all' 或 agentId

const AVATAR_COLORS = [
  '#5B7FA6', '#8B6F9E', '#C27D6A', '#6B9E8F',
  '#D4A373', '#7D8CC4', '#A67C52', '#5F9EA0'
];

function hashColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function AgentAvatar({ agent, size = 'md' }: { agent: AgentInfo; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-12 h-12 text-lg' : 'w-10 h-10 text-sm';
  const color = hashColor(agent.id);
  const initial = agent.name.charAt(0).toUpperCase();
  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center text-white font-medium shrink-0`}
      style={{ backgroundColor: color }}
    >
      {initial}
    </div>
  );
}

// ==================== AgentTabBar ====================
function AgentTabBar({
  agents,
  activeTab,
  onTabChange
}: {
  agents: AgentInfo[];
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateScrollState();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState);
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [agents.length]);

  const scrollBy = (delta: number) => {
    scrollerRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };

  return (
    <div className="flex items-center gap-1 px-4 py-3 border-b border-border/50">
      <button
        onClick={() => scrollBy(-140)}
        disabled={!canScrollLeft}
        className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors shrink-0 ${
          canScrollLeft ? 'text-muted-foreground hover:bg-accent hover:text-foreground' : 'text-muted-foreground/30 cursor-not-allowed'
        }`}
        style={NO_DRAG}
      >
        <ChevronLeftIcon className="w-4 h-4" />
      </button>

      <div
        ref={scrollerRef}
        className="flex items-center gap-2 flex-1 overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <button
          onClick={() => onTabChange('all')}
          className={`flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-colors shrink-0 ${
            activeTab === 'all'
              ? 'text-foreground'
              : 'text-muted-foreground/60 hover:text-foreground/80'
          }`}
          style={NO_DRAG}
        >
          <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 shrink-0 ${
            activeTab === 'all' ? 'border-primary/60 bg-accent/40' : 'border-transparent bg-input/40'
          }`}>
            <WrenchIcon className="w-4 h-4 text-muted-foreground/70" />
          </div>
          <span className="text-[11px] font-medium whitespace-nowrap">全部技能</span>
        </button>

        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => onTabChange(agent.id)}
            className={`flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-colors shrink-0 ${
              activeTab === agent.id
                ? 'text-foreground'
                : 'text-muted-foreground/60 hover:text-foreground/80'
            }`}
            style={NO_DRAG}
          >
            <div className={`rounded-full border-2 shrink-0 ${
              activeTab === agent.id ? 'border-primary/60' : 'border-transparent'
            }`}>
              <AgentAvatar agent={agent} />
            </div>
            <span className="text-[11px] font-medium whitespace-nowrap max-w-[60px] truncate">
              {agent.name}
            </span>
          </button>
        ))}
      </div>

      <button
        onClick={() => scrollBy(140)}
        disabled={!canScrollRight}
        className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors shrink-0 ${
          canScrollRight ? 'text-muted-foreground hover:bg-accent hover:text-foreground' : 'text-muted-foreground/30 cursor-not-allowed'
        }`}
        style={NO_DRAG}
      >
        <ChevronRightIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

// ==================== GlobalSkillsPanel ====================
function GlobalSkillsPanel() {
  const ipc = useIpcRenderer();
  const skills = useSettingsStore((s) => s.skills);
  const loadSkills = useSettingsStore((s) => s.loadSkills);
  const [isDragging, setIsDragging] = useState(false);
  const [detail, setDetail] = useState<{ skill: SkillInfo; content: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0] as File & { path?: string };
    if (!file?.path) return;
    setBusy('install');
    try {
      await ipc.skills.installFromSource(file.path);
      await loadSkills();
    } catch (err) {
      console.error('安装失败：', err);
    } finally {
      setBusy(null);
    }
  };

  const handleInstallFolder = async () => {
    setBusy('install');
    try {
      await ipc.skills.install();
      await loadSkills();
    } catch (err) {
      console.error('安装失败：', err);
    } finally {
      setBusy(null);
    }
  };

  const handleView = async (skill: SkillInfo) => {
    try {
      const content = await ipc.skills.getContent(skill.name);
      if (content !== null) setDetail({ skill, content });
    } catch (err) {
      console.error('读取技能失败：', err);
    }
  };

  const handleUninstall = async (skill: SkillInfo) => {
    if (!window.confirm(`确定卸载技能「${skill.name}」吗？`)) return;
    try {
      await ipc.skills.uninstall(skill.name);
      await loadSkills();
    } catch (err) {
      console.error('卸载失败：', err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-5">
      {/* 拖拽安装区 */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-6 text-center mb-5 transition-colors ${
          isDragging
            ? 'border-primary/60 bg-primary/5'
            : 'border-border/60 hover:border-border hover:bg-accent/20'
        }`}
      >
        <div className="flex flex-col items-center gap-2">
          <DownloadIcon className="w-6 h-6 text-muted-foreground/50" />
          <span className="text-sm text-muted-foreground/70">
            {busy === 'install' ? '安装中…' : '拖入技能文件夹安装，或点击选择'}
          </span>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={handleInstallFolder}
          disabled={busy === 'install'}
          className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-1.5"
        >
          <Folder2Icon className="w-3.5 h-3.5" />
          从文件夹安装
        </button>
        <button
          onClick={() => { loadSkills(); }}
          className="px-3 py-1.5 text-xs rounded-md border border-input hover:bg-accent transition-colors flex items-center gap-1.5"
        >
          <RefreshCwIcon className="w-3.5 h-3.5" />
          重新加载
        </button>
        <button
          onClick={() => ipc.skills.openDir()}
          className="px-3 py-1.5 text-xs rounded-md border border-input hover:bg-accent transition-colors"
        >
          打开技能目录
        </button>
      </div>

      {/* 技能列表 */}
      <div className="space-y-2">
        {skills.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground/60">
            暂无技能，拖入文件夹或从目录安装
          </div>
        ) : (
          skills.map((skill) => (
            <div
              key={skill.name}
              className="flex items-start gap-3 p-3 rounded-xl border border-border/60 bg-card/40 hover:bg-accent/30 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-accent/50 flex items-center justify-center shrink-0 mt-0.5">
                <WrenchIcon className="w-4 h-4 text-muted-foreground/70" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">{skill.name}</span>
                  <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-accent/60 text-muted-foreground/80">
                    {skill.source === 'built-in' ? '内置' : skill.source === 'global' ? '全局' : '项目'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">
                  {skill.description || '暂无描述'}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleView(skill)}
                  className="px-2 py-1 text-xs rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  查看
                </button>
                {skill.source === 'global' && (
                  <button
                    onClick={() => handleUninstall(skill)}
                    className="px-2 py-1 text-xs rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    卸载
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 详情弹窗 */}
      {detail && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60] backdrop-blur-sm"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-card border border-border rounded-lg w-[700px] max-h-[80vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h3 className="text-base font-semibold">{detail.skill.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{detail.skill.path}</p>
              </div>
              <button
                onClick={() => setDetail(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <pre className="text-xs font-mono whitespace-pre-wrap bg-background border border-border rounded-md p-3">
                {detail.content}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== AgentSkillsPanel ====================
function AgentSkillsPanel({ agent }: { agent: AgentInfo }) {
  const ipc = useIpcRenderer();
  const [skills, setSkills] = useState<Array<SkillInfo & { enabled: boolean }>>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const list = await ipc.agentSkills.list(agent.id);
      setSkills(list);
    } catch (err) {
      console.error('加载技能失败：', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [agent.id, ipc]);

  const handleToggle = async (skill: SkillInfo & { enabled: boolean }) => {
    try {
      if (skill.enabled) {
        await ipc.agentSkills.disable(agent.id, skill.name);
      } else {
        await ipc.agentSkills.enable(agent.id, skill.name);
      }
      setSkills((prev) =>
        prev.map((s) =>
          s.name === skill.name ? { ...s, enabled: !s.enabled } : s
        )
      );
    } catch (err) {
      console.error('切换技能失败：', err);
    }
  };

  const enabledCount = skills.filter((s) => s.enabled).length;

  return (
    <div className="flex-1 overflow-y-auto p-5">
      {/* Agent 信息 */}
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/50">
        <AgentAvatar agent={agent} size="lg" />
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-foreground">{agent.name}</h3>
          <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">
            {agent.description || '暂无描述'}
          </p>
          <p className="text-xs text-muted-foreground/50 mt-1">
            已启用 {enabledCount} / {skills.length} 个技能
          </p>
        </div>
      </div>

      {/* 技能列表 */}
      {loading ? (
        <div className="text-center py-8 text-xs text-muted-foreground/60">加载中…</div>
      ) : skills.length === 0 ? (
        <div className="text-center py-8 text-xs text-muted-foreground/60">
          暂无可用技能，先到「全部技能」中安装
        </div>
      ) : (
        <div className="space-y-2">
          {skills.map((skill) => (
            <div
              key={skill.name}
              className="flex items-start gap-3 p-3 rounded-xl border border-border/60 bg-card/40 hover:bg-accent/20 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-accent/50 flex items-center justify-center shrink-0 mt-0.5">
                <WrenchIcon className="w-4 h-4 text-muted-foreground/70" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">{skill.name}</span>
                  {skill.source !== 'built-in' && (
                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-accent/60 text-muted-foreground/80">
                      {skill.source === 'global' ? '全局' : '项目'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">
                  {skill.description || '暂无描述'}
                </p>
              </div>
              {/* 开关 */}
              <button
                onClick={() => handleToggle(skill)}
                className={`relative w-10 h-6 rounded-full transition-colors shrink-0 mt-1 ${
                  skill.enabled ? 'bg-primary' : 'bg-muted'
                }`}
                title={skill.enabled ? '禁用' : '启用'}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                    skill.enabled ? 'left-[18px]' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== SkillsModal ====================
export function SkillsModal() {
  const ipc = useIpcRenderer();
  const open = useUiStore((s) => s.skillsModalOpen);
  const setOpen = useUiStore((s) => s.setSkillsModalOpen);
  const agents = useAgentStore((s) => s.agents);
  const loadAgents = useAgentStore((s) => s.loadAgents);
  const [activeTab, setActiveTab] = useState<TabType>('all');

  useEffect(() => {
    if (open) {
      loadAgents();
      setActiveTab('all');
    }
  }, [open, loadAgents]);

  if (!open) return null;

  const activeAgent = agents.find((a) => a.id === activeTab);

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-chat-assistant border border-border/60 rounded-2xl w-[720px] max-h-[80vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <SparkleIcon className="w-5 h-5 text-primary/70" />
            技能管理
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            style={NO_DRAG}
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Agent Tab Bar */}
        <AgentTabBar agents={agents} activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Content */}
        {activeTab === 'all' ? (
          <GlobalSkillsPanel />
        ) : activeAgent ? (
          <AgentSkillsPanel agent={activeAgent} />
        ) : null}
      </div>
    </div>
  );
}
