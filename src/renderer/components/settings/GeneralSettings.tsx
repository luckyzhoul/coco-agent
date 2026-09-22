import { useEffect, useState } from 'react';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useSessionStore } from '../../stores/useSessionStore';

interface AppPaths {
  home: string;
  piRuntime: string;
  dbFile: string;
  skillsDir: string;
  homeOverridden: boolean;
}

export function GeneralSettings() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const setCurrentWorkspace = useSessionStore((s) => s.setCurrentWorkspace);
  const [appPaths, setAppPaths] = useState<AppPaths | null>(null);

  useEffect(() => {
    window.electronAPI.app.getPaths().then(setAppPaths).catch(() => {});
  }, []);

  if (!settings) return null;

  const handlePickDefaultSpace = async () => {
    const selected = await window.electronAPI.workspace.select();
    if (!selected) return;
    const info = await window.electronAPI.workspace.setDefault(selected.path);
    await updateSettings({ defaultWorkspacePath: info.path });
    setCurrentWorkspace(info);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-medium mb-1">外观</h3>
        <p className="text-sm text-muted-foreground mb-4">
          自定义 CocoAgent 的外观与风格。
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm">主题</label>
            <select
              value={settings.theme}
              onChange={(e) => updateSettings({ theme: e.target.value as typeof settings.theme })}
              className="bg-background border border-input rounded-md px-3 py-1.5 text-sm"
            >
              <option value="light">浅色（暖米纸）</option>
              <option value="dark">深色</option>
              <option value="system">跟随系统</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm">字体大小</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="12"
                max="20"
                value={settings.fontSize}
                onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground w-10">
                {settings.fontSize}px
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <h3 className="text-base font-medium mb-1">项目空间</h3>
        <p className="text-sm text-muted-foreground mb-4">
          新建会话默认使用这个目录；已有会话各自绑定创建时的项目空间。
        </p>

        <div className="flex items-center gap-2">
          <code className="flex-1 bg-background border border-border rounded-md px-3 py-1.5 text-xs font-mono truncate">
            {settings.defaultWorkspacePath || '~/Desktop/CocoSpace'}
          </code>
          <button
            onClick={handlePickDefaultSpace}
            className="px-3 py-1.5 rounded-md text-sm border border-input hover:bg-accent transition-colors shrink-0"
          >
            选择目录
          </button>
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <h3 className="text-base font-medium mb-1">行为</h3>
        <p className="text-sm text-muted-foreground mb-4">
          控制 Agent 的行为方式。
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm">自动批准工具</div>
              <div className="text-xs text-muted-foreground">
                自动批准所有工具调用
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.autoApproveTools}
              onChange={(e) => updateSettings({ autoApproveTools: e.target.checked })}
              className="w-4 h-4"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm">默认思考深度</label>
            <select
              value={settings.defaultThinkingLevel}
              onChange={(e) => updateSettings({ defaultThinkingLevel: e.target.value })}
              className="bg-background border border-input rounded-md px-3 py-1.5 text-sm"
            >
              <option value="off">关闭</option>
              <option value="minimal">最低</option>
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
            </select>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <h3 className="text-base font-medium mb-1">数据目录</h3>
        <p className="text-sm text-muted-foreground mb-4">
          CocoAgent 的所有数据都存放在 <code className="bg-muted px-1 rounded">COCO_HOME</code> 下。
          可通过 <code className="bg-muted px-1 rounded">COCO_HOME</code> 环境变量覆盖。
        </p>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-background border border-border rounded-md px-3 py-1.5 text-xs font-mono truncate">
              {appPaths?.home || '…'}
            </code>
            {appPaths?.homeOverridden && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground shrink-0">
                来自环境变量
              </span>
            )}
            <button
              onClick={() => window.electronAPI.app.openHome()}
              className="px-3 py-1.5 rounded-md text-sm border border-input hover:bg-accent transition-colors shrink-0"
            >
              打开
            </button>
          </div>

          <div className="text-xs text-muted-foreground space-y-1 pt-1">
            <div>
              数据库（设置 / 会话 / 记忆）：{' '}
              <code className="bg-muted px-1 rounded">{appPaths?.dbFile}</code>
            </div>
            <div>
              技能： <code className="bg-muted px-1 rounded">{appPaths?.skillsDir}</code>
            </div>
            <div>
              Pi SDK 运行时：{' '}
              <code className="bg-muted px-1 rounded">{appPaths?.piRuntime}</code>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <h3 className="text-base font-medium mb-1">关于</h3>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>CocoAgent v0.1.0</p>
          <p>由 Pi SDK 驱动的本地桌面 AI Agent</p>
        </div>
      </div>
    </div>
  );
}
