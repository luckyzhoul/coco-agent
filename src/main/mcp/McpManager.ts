import type { BrowserWindow } from 'electron';
import { MCP_EVENT_STATUS_CHANGED } from '../../shared/ipc-channels';
import type { MCPConfig } from '../../shared/types';
import { settingsManager } from '../settings/SettingsManager';
import { McpServer } from './McpServer';

export class McpManager {
  private servers = new Map<string, McpServer>();
  private mainWindow: BrowserWindow | null = null;

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  getServer(id: string): McpServer | undefined {
    return this.servers.get(id);
  }

  private emitStatusChange(id: string): void {
    const server = this.servers.get(id);
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(MCP_EVENT_STATUS_CHANGED, {
        id,
        running: server?.running || false,
        error: server?.error || undefined
      });
    }
  }

  list(): MCPConfig[] {
    return settingsManager.getMcpServers();
  }

  add(config: Omit<MCPConfig, 'id'>): MCPConfig[] {
    const newConfig: MCPConfig = {
      ...config,
      id: `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    };
    return settingsManager.addMcpServer(newConfig);
  }

  update(id: string, updates: Partial<MCPConfig>): MCPConfig[] {
    // If server is running, stop it first
    const server = this.servers.get(id);
    if (server) {
      server.stop().catch(() => {});
      this.servers.delete(id);
    }
    return settingsManager.updateMcpServer(id, updates);
  }

  remove(id: string): MCPConfig[] {
    const server = this.servers.get(id);
    if (server) {
      server.stop().catch(() => {});
      this.servers.delete(id);
    }
    return settingsManager.deleteMcpServer(id);
  }

  async start(id: string): Promise<void> {
    const configs = settingsManager.getMcpServers();
    const config = configs.find(c => c.id === id);
    if (!config) {
      throw new Error(`MCP server not found: ${id}`);
    }

    let server = this.servers.get(id);
    if (server && server.running) return;

    if (!server) {
      server = new McpServer(config);
      server.setStatusChangeCallback(() => this.emitStatusChange(id));
      this.servers.set(id, server);
    }

    await server.start();
  }

  async stop(id: string): Promise<void> {
    const server = this.servers.get(id);
    if (!server) return;
    await server.stop();
  }

  async restart(id: string): Promise<void> {
    const server = this.servers.get(id);
    if (!server) {
      await this.start(id);
      return;
    }
    await server.restart();
  }

  getStatus(id: string): { running: boolean; error?: string } {
    const server = this.servers.get(id);
    if (!server) {
      return { running: false };
    }
    return {
      running: server.running,
      error: server.error || undefined
    };
  }

  listTools(id: string): unknown[] {
    const server = this.servers.get(id);
    if (!server || !server.running) return [];
    return server.getTools();
  }

  async startAllEnabled(): Promise<void> {
    const configs = settingsManager.getMcpServers();
    for (const config of configs) {
      if (config.enabled) {
        try {
          await this.start(config.id);
        } catch (err) {
          console.error(`Failed to start MCP server ${config.name}:`, err);
        }
      }
    }
  }

  async stopAll(): Promise<void> {
    for (const [id, server] of this.servers) {
      try {
        await server.stop();
      } catch {
        // Best effort
      }
    }
    this.servers.clear();
  }
}

export const mcpManager = new McpManager();
