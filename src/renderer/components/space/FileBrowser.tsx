import { useMemo } from 'react';
import { useSpaceStore } from '../../stores/useSpaceStore';
import { ChevronIcon, FileIcon, FolderIcon, SearchIcon, SortIcon } from './icons';

function formatTime(ms: number): string {
  if (!ms) return '';
  const date = new Date(ms);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

function formatSize(bytes: number, isDir: boolean): string {
  if (isDir) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function FileBrowser() {
  const root = useSpaceStore((s) => s.root);
  const currentDir = useSpaceStore((s) => s.currentDir);
  const entries = useSpaceStore((s) => s.entries);
  const sort = useSpaceStore((s) => s.sort);
  const showHidden = useSpaceStore((s) => s.showHidden);
  const filter = useSpaceStore((s) => s.filter);
  const loading = useSpaceStore((s) => s.loading);
  const browse = useSpaceStore((s) => s.browse);
  const openFile = useSpaceStore((s) => s.openFile);
  const setSort = useSpaceStore((s) => s.setSort);
  const setFilter = useSpaceStore((s) => s.setFilter);
  const toggleHidden = useSpaceStore((s) => s.toggleHidden);

  const visible = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const filtered = entries.filter((entry) => {
      if (!showHidden && entry.name.startsWith('.')) return false;
      if (query && !entry.name.toLowerCase().includes(query)) return false;
      return true;
    });

    if (sort === 'time') {
      return [...filtered].sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return b.mtime - a.mtime;
      });
    }
    return filtered;
  }, [entries, filter, showHidden, sort]);

  // Breadcrumb segments relative to the project space root.
  const crumbs = useMemo(() => {
    if (!root || !currentDir) return [];
    const rootPath = root.path.replace(/[/\\]+$/, '');
    if (currentDir === rootPath) return [];
    const rest = currentDir.slice(rootPath.length).replace(/^[/\\]+/, '');
    const segments: { name: string; path: string }[] = [];
    let acc = rootPath;
    for (const part of rest.split(/[/\\]+/).filter(Boolean)) {
      acc = `${acc}/${part}`;
      segments.push({ name: part, path: acc });
    }
    return segments;
  }, [root, currentDir]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar */}
      <div className="space-y-2 px-3 pb-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-background/60 px-2 py-1.5">
          <SearchIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="搜索文件…"
            className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
          />
          <button
            onClick={() => setSort(sort === 'name' ? 'time' : 'name')}
            title={sort === 'name' ? '按名称排序' : '按时间排序'}
            className="flex shrink-0 items-center gap-1 rounded px-1 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <SortIcon className="h-3 w-3" />
            {sort === 'name' ? '名称' : '时间'}
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <button
            onClick={() => root && browse(root.path)}
            className="truncate transition-colors hover:text-foreground"
            title={root?.path}
          >
            {root?.name ?? '未选择项目空间'}
          </button>
          {crumbs.map((crumb) => (
            <span key={crumb.path} className="flex min-w-0 items-center gap-2">
              <ChevronIcon className="h-2.5 w-2.5 shrink-0 opacity-60" />
              <button
                onClick={() => browse(crumb.path)}
                className="truncate transition-colors hover:text-foreground"
              >
                {crumb.name}
              </button>
            </span>
          ))}
          <button
            onClick={toggleHidden}
            className={`ml-auto shrink-0 rounded px-1.5 py-0.5 transition-colors hover:bg-accent ${
              showHidden ? 'text-accent-foreground' : ''
            }`}
            title={showHidden ? '隐藏以 . 开头的文件' : '显示以 . 开头的文件'}
          >
            {showHidden ? '隐藏文件：显示' : '隐藏文件：隐藏'}
          </button>
        </div>
      </div>

      {/* Entries */}
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5">
        {loading && visible.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">加载中…</p>
        ) : visible.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            {filter.trim() ? '没有匹配的文件' : '这个文件夹是空的'}
          </p>
        ) : (
          visible.map((entry) => (
            <button
              key={entry.path}
              onClick={() => openFile(entry)}
              className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent/60"
              title={entry.path}
            >
              {entry.isDir ? (
                <FolderIcon className="h-3.5 w-3.5 shrink-0 text-primary/70" />
              ) : (
                <FileIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
              )}
              <span className="min-w-0 flex-1 truncate text-foreground/90">{entry.name}</span>
              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100">
                {formatSize(entry.size, entry.isDir) || formatTime(entry.mtime)}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
