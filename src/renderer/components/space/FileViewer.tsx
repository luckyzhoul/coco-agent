import { useMemo, useRef, useState } from 'react';
import { isTabDirty, useSpaceStore } from '../../stores/useSpaceStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { FileIcon } from './icons';

const EDITOR_FONT =
  "'JetBrains Mono', 'SF Mono', Menlo, Consolas, 'Noto Sans Mono CJK SC', monospace";

function TabStrip() {
  const tabs = useSpaceStore((s) => s.tabs);
  const activeTabPath = useSpaceStore((s) => s.activeTabPath);
  const setActiveTab = useSpaceStore((s) => s.setActiveTab);
  const closeTab = useSpaceStore((s) => s.closeTab);

  if (tabs.length === 0) return null;

  return (
    <div className="flex shrink-0 items-stretch gap-0.5 overflow-x-auto border-b border-border px-1.5 pt-1.5">
      {tabs.map((tab) => {
        const active = tab.path === activeTabPath;
        const dirty = isTabDirty(tab);
        return (
          <div
            key={tab.path}
            className={`group flex max-w-[180px] shrink-0 items-center gap-1.5 rounded-t-md border border-b-0 px-2 py-1 text-[11px] transition-colors ${
              active
                ? 'border-border bg-card text-foreground'
                : 'border-transparent text-muted-foreground hover:bg-accent/50'
            }`}
          >
            <button onClick={() => setActiveTab(tab.path)} className="flex min-w-0 items-center gap-1.5" title={tab.path}>
              <FileIcon className="h-3 w-3 shrink-0 opacity-60" />
              <span className="truncate">{tab.name}</span>
            </button>
            <button
              onClick={() => {
                if (dirty && !window.confirm(`「${tab.name}」有未保存的修改，确定关闭吗？`)) return;
                closeTab(tab.path);
              }}
              className="shrink-0 rounded px-0.5 text-muted-foreground/60 transition-colors hover:text-destructive"
              title="关闭"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function FileViewer() {
  const tabs = useSpaceStore((s) => s.tabs);
  const activeTabPath = useSpaceStore((s) => s.activeTabPath);
  const updateContent = useSpaceStore((s) => s.updateContent);
  const saveTab = useSpaceStore((s) => s.saveTab);

  const [saving, setSaving] = useState(false);
  const gutterRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const tab = tabs.find((t) => t.path === activeTabPath) ?? null;

  // The level lives in settings, so changing it in Settings updates the
  // editor immediately instead of only on the next session.
  const level = useSettingsStore((s) => s.settings?.securityLevel ?? 'workspace');

  const readOnly = level === 'readonly';
  const editable = !!tab && !tab.binary && !tab.tooLarge && !readOnly;
  const dirty = tab ? isTabDirty(tab) : false;

  const lineCount = useMemo(() => (tab ? tab.content.split('\n').length : 0), [tab]);

  const handleSave = async () => {
    if (!tab || !dirty || !editable) return;
    setSaving(true);
    await saveTab(tab.path);
    setSaving(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      handleSave();
    }
  };

  // Keep the line-number gutter aligned with the textarea's scroll offset.
  const syncScroll = () => {
    if (gutterRef.current && textareaRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  if (!tab) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <p className="text-center text-xs leading-relaxed text-muted-foreground/70">
          点击上方文件查看内容
          <br />
          在这里也能直接编辑并保存
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TabStrip />

      {/* File toolbar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5">
        <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground" title={tab.path}>
          {tab.path}
        </span>
        {readOnly && (
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            只读级别
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={!editable || !dirty || saving}
          className="shrink-0 rounded-md border border-border px-2 py-0.5 text-[11px] transition-colors enabled:hover:bg-accent enabled:hover:text-accent-foreground disabled:opacity-40"
          title={editable ? '保存（⌘/Ctrl + S）' : '当前不可编辑'}
        >
          {saving ? '保存中…' : dirty ? '保存' : '已保存'}
        </button>
      </div>

      {/* Content */}
      {tab.binary ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-center text-xs text-muted-foreground/70">
            这是二进制文件，暂不支持预览
          </p>
        </div>
      ) : tab.tooLarge ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-center text-xs leading-relaxed text-muted-foreground/70">
            文件过大（超过 2 MB）
            <br />
            请在系统中打开查看
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div
            ref={gutterRef}
            className="shrink-0 select-none overflow-hidden border-r border-border/60 bg-card/40 py-2 text-right text-[11px] leading-[1.55rem] text-muted-foreground/45"
            style={{ fontFamily: EDITOR_FONT }}
          >
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i} className="px-2">
                {i + 1}
              </div>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            value={tab.content}
            readOnly={!editable}
            spellCheck={false}
            onChange={(e) => updateContent(tab.path, e.target.value)}
            onScroll={syncScroll}
            onKeyDown={handleKeyDown}
            className="min-w-0 flex-1 resize-none bg-transparent px-3 py-2 text-[11.5px] leading-[1.55rem] text-foreground/90 outline-none read-only:text-muted-foreground/80"
            style={{ fontFamily: EDITOR_FONT, tabSize: 2 }}
          />
        </div>
      )}
    </div>
  );
}
