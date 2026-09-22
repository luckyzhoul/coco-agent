import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import path from 'node:path';
import { initCocoHome } from './paths';
import { initDb } from './db';
import { registerIpcHandlers } from './ipc';
import { workspaceManager } from './workspace/WorkspaceManager';

// paths.ts already bootstraps COCO_HOME at import time (imports are hoisted,
// so this runs before the module body anyway). Kept explicit for readability.
initCocoHome();
initDb();

// Restore the project space before the window opens, so the renderer's first
// getCurrent() call already has an answer.
workspaceManager.init();

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#F8F4EC',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  });

  Menu.setApplicationMenu(null);

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Pass window reference to agent runtime for event emission
  import('./agent/AgentRuntime').then(({ agentRuntime }) => {
    agentRuntime.setMainWindow(mainWindow);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  registerIpcHandlers(ipcMain, () => mainWindow);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
