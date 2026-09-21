import type { IpcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { workspaceManager } from '../workspace/WorkspaceManager';
import { agentRuntime } from '../agent/AgentRuntime';
import { settingsManager } from '../settings/SettingsManager';
import { modelManager } from '../models/ModelManager';
import { mcpManager } from '../mcp/McpManager';
import {
  WORKSPACE_SELECT,
  WORKSPACE_GET_CURRENT,
  WORKSPACE_LIST_RECENT,
  AGENT_SEND_MESSAGE,
  AGENT_ABORT,
  AGENT_NEW_SESSION,
  AGENT_SWITCH_SESSION,
  AGENT_DELETE_SESSION,
  AGENT_LIST_SESSIONS,
  AGENT_GET_SESSION_MESSAGES,
  AGENT_GET_STATUS,
  SETTINGS_GET,
  SETTINGS_SET,
  SETTINGS_RESET,
  MODELS_LIST,
  MODELS_ADD,
  MODELS_UPDATE,
  MODELS_DELETE,
  MODELS_SET_ACTIVE,
  MODELS_GET_ACTIVE,
  MODELS_TEST,
  MCP_LIST,
  MCP_ADD,
  MCP_UPDATE,
  MCP_DELETE,
  MCP_START,
  MCP_STOP,
  MCP_RESTART,
  MCP_GET_STATUS,
  MCP_LIST_TOOLS
} from '../../shared/ipc-channels';
import type { AppSettings, ModelConfig, MCPConfig } from '../../shared/types';

export function registerIpcHandlers(
  ipcMain: IpcMain,
  getMainWindow: () => BrowserWindow | null
): void {
  // Workspace handlers
  ipcMain.handle(WORKSPACE_SELECT, async () => {
    return workspaceManager.selectDirectory(getMainWindow());
  });

  ipcMain.handle(WORKSPACE_GET_CURRENT, () => {
    return workspaceManager.getCurrent();
  });

  ipcMain.handle(WORKSPACE_LIST_RECENT, () => {
    return workspaceManager.listRecent();
  });

  // Agent handlers
  ipcMain.handle(AGENT_NEW_SESSION, async (_e, workspacePath: string) => {
    agentRuntime.setMainWindow(getMainWindow());
    return agentRuntime.newSession(workspacePath);
  });

  ipcMain.handle(AGENT_SWITCH_SESSION, async (_e, sessionId: string) => {
    agentRuntime.setMainWindow(getMainWindow());
    await agentRuntime.switchSession(sessionId);
  });

  ipcMain.handle(AGENT_DELETE_SESSION, (_e, sessionId: string) => {
    agentRuntime.deleteSession(sessionId);
  });

  ipcMain.handle(AGENT_LIST_SESSIONS, () => {
    return agentRuntime.listSessions();
  });

  ipcMain.handle(AGENT_GET_SESSION_MESSAGES, (_e, sessionId: string) => {
    return agentRuntime.getSessionMessages(sessionId);
  });

  ipcMain.handle(AGENT_GET_STATUS, () => {
    return agentRuntime.getStatus();
  });

  ipcMain.handle(AGENT_SEND_MESSAGE, async (_e, content: string) => {
    agentRuntime.setMainWindow(getMainWindow());
    await agentRuntime.sendMessage(content);
  });

  ipcMain.handle(AGENT_ABORT, async () => {
    await agentRuntime.abort();
  });

  // Settings handlers
  ipcMain.handle(SETTINGS_GET, () => {
    return settingsManager.get();
  });

  ipcMain.handle(SETTINGS_SET, (_e, partial: Partial<AppSettings>) => {
    return settingsManager.set(partial);
  });

  ipcMain.handle(SETTINGS_RESET, () => {
    return settingsManager.reset();
  });

  // Model handlers
  ipcMain.handle(MODELS_LIST, () => {
    return modelManager.list();
  });

  ipcMain.handle(MODELS_ADD, (_e, model: Omit<ModelConfig, 'id'>) => {
    return modelManager.add(model);
  });

  ipcMain.handle(MODELS_UPDATE, (_e, id: string, updates: Partial<ModelConfig>) => {
    return modelManager.update(id, updates);
  });

  ipcMain.handle(MODELS_DELETE, (_e, id: string) => {
    return modelManager.delete(id);
  });

  ipcMain.handle(MODELS_SET_ACTIVE, (_e, id: string) => {
    modelManager.setActive(id);
  });

  ipcMain.handle(MODELS_GET_ACTIVE, () => {
    return modelManager.getActive();
  });

  ipcMain.handle(MODELS_TEST, (_e, id: string) => {
    return modelManager.testConnection(id);
  });

  // MCP handlers
  ipcMain.handle(MCP_LIST, () => {
    return mcpManager.list();
  });

  ipcMain.handle(MCP_ADD, (_e, config: Omit<MCPConfig, 'id'>) => {
    return mcpManager.add(config);
  });

  ipcMain.handle(MCP_UPDATE, (_e, id: string, updates: Partial<MCPConfig>) => {
    return mcpManager.update(id, updates);
  });

  ipcMain.handle(MCP_DELETE, (_e, id: string) => {
    return mcpManager.remove(id);
  });

  ipcMain.handle(MCP_START, async (_e, id: string) => {
    mcpManager.setMainWindow(getMainWindow());
    await mcpManager.start(id);
  });

  ipcMain.handle(MCP_STOP, async (_e, id: string) => {
    await mcpManager.stop(id);
  });

  ipcMain.handle(MCP_RESTART, async (_e, id: string) => {
    mcpManager.setMainWindow(getMainWindow());
    await mcpManager.restart(id);
  });

  ipcMain.handle(MCP_GET_STATUS, (_e, id: string) => {
    return mcpManager.getStatus(id);
  });

  ipcMain.handle(MCP_LIST_TOOLS, (_e, id: string) => {
    return mcpManager.listTools(id);
  });
}
