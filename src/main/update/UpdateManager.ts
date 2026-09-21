import type { BrowserWindow } from 'electron';
import { app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { UPDATE_EVENT } from '../../shared/ipc-channels';
import type { UpdateStatus } from '../../shared/types';

type UpdaterModule = typeof import('electron-updater');

/**
 * Wraps electron-updater.
 *
 * Deliberately inert when the app is not packaged (dev / `electron-vite dev`),
 * because electron-updater throws outside a packaged build. The feed defaults
 * to the GitHub releases of the configured repo, but can be overridden with a
 * generic feed URL from settings.
 */
export class UpdateManager {
  private mainWindow: BrowserWindow | null = null;
  private updater: import('electron-updater').AppUpdater | null = null;
  private status: UpdateStatus = {
    state: 'idle',
    currentVersion: '0.0.0',
    packaged: false,
    feedConfigured: false
  };
  private feedUrl = '';

  async init(): Promise<void> {
    this.status.currentVersion = app.getVersion();
    this.status.packaged = app.isPackaged;

    if (!app.isPackaged) {
      this.setStatus({
        state: 'unavailable',
        message: 'Auto-update is only available in packaged builds.'
      });
      return;
    }

    let mod: UpdaterModule;
    try {
      mod = await import('electron-updater');
    } catch (err) {
      this.setStatus({
        state: 'error',
        message: `Could not load the updater: ${
          err instanceof Error ? err.message : String(err)
        }`
      });
      return;
    }

    const { autoUpdater } = mod;
    this.updater = autoUpdater;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
      this.setStatus({ state: 'checking', message: 'Checking for updates…' });
    });
    autoUpdater.on('update-available', (info) => {
      this.setStatus({
        state: 'available',
        version: info.version,
        message: `Version ${info.version} is available.`
      });
    });
    autoUpdater.on('update-not-available', () => {
      this.setStatus({ state: 'up-to-date', message: 'You are on the latest version.' });
    });
    autoUpdater.on('download-progress', (progress) => {
      this.setStatus({
        state: 'downloading',
        percent: Math.round(progress.percent),
        message: `Downloading… ${Math.round(progress.percent)}%`
      });
    });
    autoUpdater.on('update-downloaded', (info) => {
      this.setStatus({
        state: 'downloaded',
        version: info.version,
        message: 'Update downloaded. Restart to install.'
      });
    });
    autoUpdater.on('error', (err) => {
      this.setStatus({ state: 'error', message: err?.message || String(err) });
    });

    this.setStatus({ state: 'idle', feedConfigured: this.hasBundledFeed() });
  }

  private hasBundledFeed(): boolean {
    // electron-builder writes app-update.yml next to the app resources when a
    // publish provider is configured (auto-detected from the git remote).
    try {
      return fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'));
    } catch {
      return false;
    }
  }

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  private setStatus(patch: Partial<UpdateStatus>): void {
    this.status = { ...this.status, ...patch };
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(UPDATE_EVENT, this.status);
    }
  }

  getStatus(): UpdateStatus {
    return this.status;
  }

  /** Point the updater at a generic feed. Empty string restores the bundled feed. */
  setFeedUrl(url: string): void {
    this.feedUrl = url.trim();
    if (!this.updater) return;

    if (this.feedUrl) {
      this.updater.setFeedURL({ provider: 'generic', url: this.feedUrl });
    }
    this.setStatus({
      feedConfigured: this.feedUrl.length > 0 || this.hasBundledFeed(),
      feedUrl: this.feedUrl || undefined
    });
  }

  async checkForUpdates(): Promise<UpdateStatus> {
    if (!this.updater) {
      this.setStatus({
        state: 'unavailable',
        message: app.isPackaged
          ? 'Updater is not initialized.'
          : 'Auto-update is only available in packaged builds.'
      });
      return this.status;
    }

    try {
      await this.updater.checkForUpdates();
    } catch (err) {
      this.setStatus({
        state: 'error',
        message: err instanceof Error ? err.message : String(err)
      });
    }
    return this.status;
  }

  async downloadUpdate(): Promise<UpdateStatus> {
    if (!this.updater) {
      return this.status;
    }
    try {
      await this.updater.downloadUpdate();
    } catch (err) {
      this.setStatus({
        state: 'error',
        message: err instanceof Error ? err.message : String(err)
      });
    }
    return this.status;
  }

  quitAndInstall(): void {
    if (!this.updater) return;
    this.updater.quitAndInstall();
  }
}

export const updateManager = new UpdateManager();
