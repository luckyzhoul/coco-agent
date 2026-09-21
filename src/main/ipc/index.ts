import type { IpcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { workspaceManager } from '../workspace/WorkspaceManager';
import { agentRuntime } from '../agent/AgentRuntime';
import { settingsManager } from '../settings/SettingsManager';
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
  SETTINGS_RESET
} from '../../shared/ipc-channels';
import type { AppSettings } from '../../shared/types';

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
}
