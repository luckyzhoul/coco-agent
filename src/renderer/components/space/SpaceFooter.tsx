import { useSettingsStore } from '../../stores/useSettingsStore';
import { useSpaceStore } from '../../stores/useSpaceStore';

function Row({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-14 shrink-0 text-muted-foreground/60">{label}</span>
      <span className="min-w-0 flex-1 truncate text-right text-foreground/80" title={title ?? value}>
        {value}
      </span>
    </div>
  );
}

export function SpaceFooter() {
  const root = useSpaceStore((s) => s.root);
  const entries = useSpaceStore((s) => s.entries);
  const tabs = useSpaceStore((s) => s.tabs);
  const activeTabPath = useSpaceStore((s) => s.activeTabPath);
  const models = useSettingsStore((s) => s.models);
  const activeModelId = useSettingsStore((s) => s.activeModelId);

  const model = models.find((m) => m.id === activeModelId);
  const activeTab = tabs.find((t) => t.path === activeTabPath);

  return (
    <div className="shrink-0 space-y-1 border-t border-border bg-card/40 px-3 py-2 text-[11px]">
      <Row label="工作目录" value={root?.name ?? '未选择'} title={root?.path} />
      {activeTab && <Row label="当前文件" value={activeTab.name} title={activeTab.path} />}
      <Row label="模型" value={model?.name ?? '未配置'} />
      <Row label="文件" value={`${entries.length} 项 · 已开 ${tabs.length}`} />
    </div>
  );
}
