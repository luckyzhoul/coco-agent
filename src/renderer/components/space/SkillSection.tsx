import React, { useCallback, useEffect, useState } from 'react';
import type { FileEntry, SkillInfo } from '@shared/types';
import { useSpaceStore } from '../../stores/useSpaceStore';

function messageOf(err: unknown): string {
  if (err instanceof Error) {
    // Electron wraps IPC errors; strip the noisy prefix.
    return err.message.replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/, '');
  }
  return String(err);
}

interface SkillSectionProps {
  onClose: () => void;
}

/**
 * Project-space skills card: manages the skills that live inside the current
 * project space (<space>/.coco/skills). These apply to every agent while a
 * session is bound to the space and are separate from the global skills
 * managed in the sidebar's skills modal. Rendered as a floating card over
 * the panel content, toggled from the header's 「项目技能」 pill.
 */
export function SkillSection({ onClose }: SkillSectionProps) {
  const root = useSpaceStore((s) => s.root);
  const openFile = useSpaceStore((s) => s.openFile);

  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await window.electronAPI.skills.listProject();
      setSkills(list);
      setError(null);
    } catch (err) {
      setError(messageOf(err));
    }
  }, []);

  // The card only exists while open; reload whenever it appears or the
  // project space changes — the skills follow the space.
  useEffect(() => {
    load();
  }, [root?.path, load]);

  const installSource = async (source: string) => {
    setBusy(true);
    try {
      await window.electronAPI.skills.installToProjectFromSource(source);
      await load();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const handleInstallFolder = async () => {
    try {
      const result = await window.electronAPI.skills.installToProject();
      if (result) await load();
    } catch (err) {
      setError(messageOf(err));
    }
  };

  const handleDelete = async (skill: SkillInfo) => {
    if (!window.confirm(`确定删除项目技能「${skill.name}」吗？`)) return;
    try {
      setSkills(await window.electronAPI.skills.deleteProject(skill.name));
      setError(null);
    } catch (err) {
      setError(messageOf(err));
    }
  };

  /** Open the skill's SKILL.md in the file viewer (already inside the space). */
  const handleView = (skill: SkillInfo) => {
    const entry: FileEntry = {
      name: 'SKILL.md',
      path: `${skill.path}/SKILL.md`,
      isDir: false,
      size: 0,
      mtime: 0
    };
    openFile(entry);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0] as File & { path?: string };
    if (!file?.path) return;
    await installSource(file.path);
  };

  if (!root) return null;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragging(false);
      }}
      onDrop={handleDrop}
      className={`absolute inset-x-2 top-2 z-10 flex max-h-[65%] min-h-0 flex-col rounded-xl border bg-background shadow-md transition-colors ${
        dragging ? 'border-dashed border-primary/60 bg-accent/30' : 'border-border'
      }`}
    >
      {/* 题头：技能跟随工作台 */}
      <div className="relative shrink-0 px-4 pb-1 pt-3.5">
        <div className="text-center">
          <span className="title-serif rule-title text-[11px] text-muted-foreground/80">
            技能跟随工作台
          </span>
        </div>
        <button
          onClick={onClose}
          className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
          title="收起项目技能"
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* 列表 / 空态 */}
      <div className="min-h-40 flex-1 overflow-y-auto px-4 pb-2 pt-2">
        {error && (
          <p className="mb-2 rounded-md bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
            {error}
          </p>
        )}
        {busy ? (
          <p className="py-8 text-center text-xs text-muted-foreground/70">安装中…</p>
        ) : skills.length === 0 ? (
          <div className="flex h-full min-h-36 flex-col items-center justify-center gap-1.5 text-center">
            <p className="text-sm text-foreground/80">当前文件夹没有项目技能</p>
            <p className="text-xs text-muted-foreground/60">拖入文件夹或 .zip 安装技能</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {skills.map((skill) => (
              <div
                key={skill.name}
                className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-2.5 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 truncate text-xs font-medium text-foreground">
                      {skill.name}
                    </span>
                    {!skill.loaded && (
                      <span className="shrink-0 rounded bg-destructive/10 px-1 py-0.5 text-[10px] leading-none text-destructive">
                        缺少 description
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground/70">
                    {skill.description || 'Agent 无法调用此技能'}
                  </p>
                </div>
                <button
                  onClick={() => handleView(skill)}
                  className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  查看
                </button>
                <button
                  onClick={() => handleDelete(skill)}
                  className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部操作行 */}
      <div className="flex shrink-0 items-center gap-1 border-t border-border/60 px-3 py-2">
        <button
          onClick={handleInstallFolder}
          disabled={busy}
          className="rounded-md px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
          title="从文件夹加载技能（须包含 SKILL.md）"
        >
          加载
        </button>
        <button
          onClick={() => window.electronAPI.skills.openProjectDir()}
          className="rounded-md px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="打开项目技能目录"
        >
          打开目录
        </button>
        <span className="flex-1" />
        {skills.length > 0 && (
          <span className="text-[10px] text-muted-foreground/50">{skills.length} 个技能</span>
        )}
      </div>
    </div>
  );
}
