import React, { useState } from 'react';
import { useSettingsStore } from '../../stores/useSettingsStore';
import type { MCPConfig } from '@shared/types';

export function McpSettings() {
  const mcpServers = useSettingsStore((s) => s.mcpServers);
  const addMcpServer = useSettingsStore((s) => s.addMcpServer);
  const deleteMcpServer = useSettingsStore((s) => s.deleteMcpServer);
  const startMcpServer = useSettingsStore((s) => s.startMcpServer);
  const stopMcpServer = useSettingsStore((s) => s.stopMcpServer);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newServer, setNewServer] = useState({
    name: '',
    type: 'stdio' as MCPConfig['type'],
    command: '',
    args: '',
    enabled: true
  });

  const handleAdd = async () => {
    if (!newServer.name || !newServer.command) return;
    await addMcpServer({
      ...newServer,
      args: newServer.args ? newServer.args.split(' ').filter(Boolean) : undefined
    });
    setNewServer({ name: '', type: 'stdio', command: '', args: '', enabled: true });
    setShowAddForm(false);
  };

  const handleToggle = async (server: MCPConfig) => {
    const mcp = useSettingsStore.getState().mcpServers.find(s => s.id === server.id);
    const isRunning = mcp?.enabled; // Simplified for now
    if (isRunning) {
      await stopMcpServer(server.id);
    } else {
      await startMcpServer(server.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-medium mb-1">MCP 服务</h3>
          <p className="text-sm text-muted-foreground">
            管理 Model Context Protocol 服务。
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm hover:opacity-90 transition-opacity"
        >
          + 添加服务
        </button>
      </div>

      {showAddForm && (
        <div className="bg-background border border-border rounded-lg p-4 space-y-4">
          <h4 className="text-sm font-medium">添加 MCP 服务</h4>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">名称</label>
              <input
                type="text"
                value={newServer.name}
                onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                placeholder="filesystem"
                className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">传输类型</label>
              <select
                value={newServer.type}
                onChange={(e) => setNewServer({ ...newServer, type: e.target.value as MCPConfig['type'] })}
                className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
              >
                <option value="stdio">标准 IO（本地进程）</option>
                <option value="sse">Server-Sent Events</option>
                <option value="streamable-http">Streamable HTTP</option>
              </select>
            </div>

            {newServer.type === 'stdio' && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">命令</label>
                  <input
                    type="text"
                    value={newServer.command}
                    onChange={(e) => setNewServer({ ...newServer, command: e.target.value })}
                    placeholder="npx"
                    className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">参数（以空格分隔）</label>
                  <input
                    type="text"
                    value={newServer.args}
                    onChange={(e) => setNewServer({ ...newServer, args: e.target.value })}
                    placeholder="-y @modelcontextprotocol/server-filesystem /path/to/files"
                    className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
                  />
                </div>
              </>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="mcp-enabled"
                checked={newServer.enabled}
                onChange={(e) => setNewServer({ ...newServer, enabled: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="mcp-enabled" className="text-sm">
                启动时启用
              </label>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 rounded-md text-sm border border-input hover:bg-accent transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleAdd}
              className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm hover:opacity-90 transition-opacity"
            >
              添加
            </button>
          </div>
        </div>
      )}

      {/* Server list */}
      <div className="space-y-2">
        {mcpServers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            尚未配置任何 MCP 服务。
          </div>
        ) : (
          mcpServers.map((server) => (
            <McpServerItem
              key={server.id}
              server={server}
              onStart={() => startMcpServer(server.id)}
              onStop={() => stopMcpServer(server.id)}
              onDelete={() => deleteMcpServer(server.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function McpServerItem({
  server,
  onStart,
  onStop,
  onDelete
}: {
  server: MCPConfig;
  onStart: () => void;
  onStop: () => void;
  onDelete: () => void;
}) {
  const [status, setStatus] = useState<'stopped' | 'running'>('stopped');

  const handleToggle = () => {
    if (status === 'running') {
      onStop();
      setStatus('stopped');
    } else {
      onStart();
      setStatus('running');
    }
  };

  const statusColor = status === 'running' ? 'bg-emerald-500' : 'bg-muted';
  const statusText = status === 'running' ? '运行中' : '已停止';

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${statusColor}`} />
        <div>
          <div className="text-sm font-medium">{server.name}</div>
          <div className="text-xs text-muted-foreground">
            {server.type} · {server.command || server.url}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">{statusText}</span>
        <button
          onClick={handleToggle}
          className="text-xs px-2 py-1 rounded border border-input hover:bg-accent transition-colors"
        >
          {status === 'running' ? '停止' : '启动'}
        </button>
        <button
          onClick={onDelete}
          className="text-xs text-destructive hover:text-destructive/80 transition-colors"
        >
          删除
        </button>
      </div>
    </div>
  );
}
