import { ArchiveManager } from './ArchiveManager';
import { TrashManager } from './TrashManager';

/** 会话管理：归档对话 + 回收站。 */
export function SessionSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-medium mb-1">会话管理</h3>
        <p className="text-sm text-muted-foreground">
          管理归档与回收站中的对话。侧边栏删除的对话会进入回收站，可在其中恢复或彻底删除。
        </p>
      </div>

      <ArchiveManager />

      <div className="border-t border-border/50 pt-6">
        <TrashManager />
      </div>
    </div>
  );
}
