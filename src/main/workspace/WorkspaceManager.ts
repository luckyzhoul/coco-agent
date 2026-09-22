import { dialog } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { WorkspaceInfo } from '../../shared/types';
import { getDb } from '../db';
import { settingsManager } from '../settings/SettingsManager';
import { builtinDefaultPath, expandHome } from './spacePaths';

const MAX_RECENT = 10;

export class WorkspaceManager {
  private currentWorkspace: WorkspaceInfo | null = null;
  private recentWorkspaces: WorkspaceInfo[] = [];

  constructor() {
    this.loadRecentWorkspaces();
  }

  private loadRecentWorkspaces(): void {
    try {
      const rows = getDb()
        .prepare('SELECT path, name FROM recent_workspaces ORDER BY last_used DESC')
        .all() as unknown as { path: string; name: string }[];
      this.recentWorkspaces = rows.map((r) => ({ path: r.path, name: r.name }));
    } catch {
      this.recentWorkspaces = [];
    }
  }

  private saveRecentWorkspaces(): void {
    try {
      const db = getDb();
      const now = Date.now();
      db.exec('DELETE FROM recent_workspaces');
      const stmt = db.prepare(
        'INSERT INTO recent_workspaces (path, name, last_used) VALUES (?, ?, ?)'
      );
      for (const w of this.recentWorkspaces) {
        stmt.run(w.path, w.name, now);
      }
    } catch {
      // Non-fatal
    }
  }

  private isDirectory(dirPath: string): boolean {
    try {
      return fs.statSync(dirPath).isDirectory();
    } catch {
      return false;
    }
  }

  /** Create the directory (and parents) if missing; returns false on failure. */
  private ensureDir(dirPath: string): boolean {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      return true;
    } catch {
      return false;
    }
  }

  private toInfo(dirPath: string): WorkspaceInfo {
    return { path: dirPath, name: path.basename(dirPath) || dirPath };
  }

  /** The configured default project space, falling back to the built-in one. */
  getDefaultPath(): string {
    const configured = expandHome(settingsManager.get().defaultWorkspacePath);
    return configured || builtinDefaultPath();
  }

  /** The default project space, created on disk if needed. */
  ensureDefault(): WorkspaceInfo {
    const dirPath = this.getDefaultPath();
    this.ensureDir(dirPath);
    return this.toInfo(dirPath);
  }

  /**
   * Restore the project space on launch: last used if still valid, otherwise
   * the default (created if missing). Called once from the main entry point.
   */
  init(): WorkspaceInfo {
    const last = settingsManager.get().lastWorkspacePath;
    if (last && this.isDirectory(last)) {
      const info = this.toInfo(last);
      this.setCurrent(info);
      return info;
    }
    const info = this.ensureDefault();
    this.setCurrent(info);
    return info;
  }

  async selectDirectory(parentWindow: Electron.BrowserWindow | null): Promise<WorkspaceInfo | null> {
    const result = await dialog.showOpenDialog(parentWindow!, {
      title: '选择项目空间目录',
      buttonLabel: '使用此目录',
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const dirPath = result.filePaths[0];
    if (!this.isDirectory(dirPath)) {
      throw new Error(`无效的目录：${dirPath}`);
    }

    const info = this.toInfo(dirPath);
    this.setCurrent(info);
    return info;
  }

  /** Point the app at a new project space (used by the space switcher). */
  setCurrentPath(dirPath: string): WorkspaceInfo {
    const expanded = expandHome(dirPath);
    if (!this.ensureDir(expanded) || !this.isDirectory(expanded)) {
      throw new Error(`无法使用该目录：${dirPath}`);
    }
    const info = this.toInfo(expanded);
    this.setCurrent(info);
    return info;
  }

  /** Change the default project space used by new sessions. */
  setDefault(dirPath: string): WorkspaceInfo {
    const expanded = expandHome(dirPath);
    if (!this.ensureDir(expanded) || !this.isDirectory(expanded)) {
      throw new Error(`无法使用该目录：${dirPath}`);
    }
    settingsManager.set({ defaultWorkspacePath: expanded });
    const info = this.toInfo(expanded);
    this.setCurrent(info);
    return info;
  }

  getCurrent(): WorkspaceInfo | null {
    return this.currentWorkspace;
  }

  setCurrent(workspace: WorkspaceInfo): void {
    if (!this.isDirectory(workspace.path)) {
      throw new Error(`无效的项目空间路径：${workspace.path}`);
    }
    this.currentWorkspace = workspace;
    settingsManager.set({ lastWorkspacePath: workspace.path });
    this.addToRecent(workspace);
  }

  listRecent(): WorkspaceInfo[] {
    return this.recentWorkspaces;
  }

  private addToRecent(workspace: WorkspaceInfo): void {
    this.recentWorkspaces = this.recentWorkspaces.filter(
      w => w.path !== workspace.path
    );
    this.recentWorkspaces.unshift(workspace);
    this.recentWorkspaces = this.recentWorkspaces.slice(0, MAX_RECENT);
    this.saveRecentWorkspaces();
  }
}

export const workspaceManager = new WorkspaceManager();
