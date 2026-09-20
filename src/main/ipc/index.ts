import type { IpcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { workspaceManager } from '../workspace/WorkspaceManager';
import {
  WORKSPACE_SELECT,
  WORKSPACE_GET_CURRENT,
  WORKSPACE_LIST_RECENT
} from '../../shared/ipc-channels';

export function registerIpcHandlers(
  ipcMain: IpcMain,
  getMainWindow: () => BrowserWindow | null
): void {
  ipcMain.handle(WORKSPACE_SELECT, async () => {
    return workspaceManager.selectDirectory(getMainWindow());
  });

  ipcMain.handle(WORKSPACE_GET_CURRENT, () => {
    return workspaceManager.getCurrent();
  });

  ipcMain.handle(WORKSPACE_LIST_RECENT, () => {
    return workspaceManager.listRecent();
  });
}
