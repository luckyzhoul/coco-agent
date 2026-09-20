import type { IpcMain } from 'electron';
import type { BrowserWindow } from 'electron';

export function registerIpcHandlers(
  ipcMain: IpcMain,
  getMainWindow: () => BrowserWindow | null
): void {
  console.log('[IPC] Handlers registered (stub)');
  void ipcMain;
  void getMainWindow;
}
