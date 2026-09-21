import { dialog } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { WorkspaceInfo } from '../../shared/types';
import { getDb } from '../db';

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

  private validatePath(dirPath: string): boolean {
    try {
      const stat = fs.statSync(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  async selectDirectory(parentWindow: Electron.BrowserWindow | null): Promise<WorkspaceInfo | null> {
    const result = await dialog.showOpenDialog(parentWindow!, {
      title: 'Select Workspace Directory',
      properties: ['openDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const dirPath = result.filePaths[0];
    if (!this.validatePath(dirPath)) {
      throw new Error(`Invalid directory: ${dirPath}`);
    }

    const info: WorkspaceInfo = {
      path: dirPath,
      name: path.basename(dirPath) || dirPath
    };

    this.currentWorkspace = info;
    this.addToRecent(info);
    return info;
  }

  getCurrent(): WorkspaceInfo | null {
    return this.currentWorkspace;
  }

  setCurrent(workspace: WorkspaceInfo): void {
    if (!this.validatePath(workspace.path)) {
      throw new Error(`Invalid workspace path: ${workspace.path}`);
    }
    this.currentWorkspace = workspace;
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
