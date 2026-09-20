import { app, dialog } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { WorkspaceInfo } from '../../shared/types';

const RECENT_WORKSPACES_FILE = 'recent-workspaces.json';
const MAX_RECENT = 10;

export class WorkspaceManager {
  private currentWorkspace: WorkspaceInfo | null = null;
  private recentWorkspaces: WorkspaceInfo[] = [];
  private dataDir: string;

  constructor() {
    this.dataDir = path.join(app.getPath('userData'), 'cocoagent');
    this.ensureDataDir();
    this.loadRecentWorkspaces();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private getRecentFilePath(): string {
    return path.join(this.dataDir, RECENT_WORKSPACES_FILE);
  }

  private loadRecentWorkspaces(): void {
    try {
      const file = this.getRecentFilePath();
      if (fs.existsSync(file)) {
        const data = fs.readFileSync(file, 'utf-8');
        this.recentWorkspaces = JSON.parse(data);
      }
    } catch {
      this.recentWorkspaces = [];
    }
  }

  private saveRecentWorkspaces(): void {
    try {
      fs.writeFileSync(
        this.getRecentFilePath(),
        JSON.stringify(this.recentWorkspaces, null, 2)
      );
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
