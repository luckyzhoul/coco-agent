import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAgentEvent, useIpcRenderer } from "../../hooks/useIpcRenderer";
import { useChatStore } from "../../stores/useChatStore";
import type { CompactionEventPayload } from "@shared/types";
import {
  formatPercent,
  formatTokens,
  ringProgress,
  type ContextUsage,
} from "./usageFormat";

const POLL_INTERVAL_MS = 5000;
const WARNING_PERCENT = 80;

/**
 * 上下文用量圆环：hover 显示用量 tooltip，点击弹出压缩菜单。
 * 用量来自 SDK 的 session.getContextUsage()，压缩后未产生新回复前 tokens 为 null（空环）。
 */
export function ContextUsageIndicator() {
  const ipc = useIpcRenderer();
  const setError = useChatStore((s) => s.setError);
  const [usage, setUsage] = useState<ContextUsage | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hovered, setHovered] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => {
    ipc.agent
      .getContextUsage()
      .then(setUsage)
      .catch(() => {});
  }, [ipc]);

  // 挂载拉一次 + 定时轮询；压缩结束后立即刷新（压缩后短暂为 null，环灰显）。
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  useAgentEvent("agentCompaction", (data: CompactionEventPayload) => {
    if (data.phase === "end") {
      setBusy(false);
      refresh();
    }
  });

  // 点击菜单外关闭
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  const handleCompact = async (andRemember: boolean) => {
    setShowMenu(false);
    setBusy(true);
    try {
      if (andRemember) {
        await ipc.agent.compactAndRemember();
      } else {
        await ipc.agent.compactContext();
      }
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const progress = ringProgress(usage?.percent ?? null);
  const radius = 6.5;
  const circumference = 2 * Math.PI * radius;
  const warning = (usage?.percent ?? 0) >= WARNING_PERCENT;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
          showMenu ? "bg-accent" : "hover:bg-accent"
        } ${warning ? "text-destructive" : "text-muted-foreground"}`}
        title="上下文用量"
      >
        <svg width="16" height="16" viewBox="0 0 16 16">
          <circle
            cx="8"
            cy="8"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="opacity-20"
          />
          <circle
            cx="8"
            cy="8"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            transform="rotate(-90 8 8)"
          />
        </svg>
      </button>

      {/* Hover tooltip */}
      {hovered && !showMenu && (
        <div className="absolute bottom-full left-0 mb-2 z-50 px-3 py-2 rounded-lg bg-foreground text-background text-xs leading-5 whitespace-nowrap shadow-lifted pointer-events-none">
          <div>上下文 {formatTokens(usage?.contextWindow ?? null)}</div>
          <div>
            已用 {formatTokens(usage?.tokens ?? null)}（
            {formatPercent(usage?.percent ?? null)}）
          </div>
        </div>
      )}

      {/* Compact menu */}
      {showMenu && (
        <div className="absolute bottom-full left-0 mb-1 z-50 min-w-[140px] bg-card border border-border/60 rounded-xl shadow-lifted py-1">
          <button
            onClick={() => handleCompact(false)}
            disabled={busy}
            className="w-full px-3 py-2 text-left text-xs text-foreground/80 hover:bg-accent/40 transition-colors disabled:opacity-50"
          >
            {busy ? "压缩中…" : "压缩"}
          </button>
          <button
            onClick={() => handleCompact(true)}
            disabled={busy}
            className="w-full px-3 py-2 text-left text-xs text-foreground/80 hover:bg-accent/40 transition-colors disabled:opacity-50"
          >
            压缩并更新
          </button>
        </div>
      )}
    </div>
  );
}
