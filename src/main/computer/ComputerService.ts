import { desktopCapturer, screen } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface WindowInfo {
  id: string;
  title: string;
  app?: string;
}

export interface ScreenInfo {
  width: number;
  height: number;
  scaleFactor: number;
}

export class ComputerService {
  getScreenInfo(): ScreenInfo {
    const primary = screen.getPrimaryDisplay();
    return {
      width: primary.size.width,
      height: primary.size.height,
      scaleFactor: primary.scaleFactor
    };
  }

  async screenshot(): Promise<string> {
    const { width, height } = this.getScreenInfo();

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width, height }
    });

    if (sources.length === 0) {
      throw new Error(
        'No screen sources available. On Linux, screen capture requires a running display server.'
      );
    }

    return sources[0].thumbnail.toPNG().toString('base64');
  }

  async listWindows(): Promise<WindowInfo[]> {
    const platform = process.platform;

    if (platform === 'linux') {
      return this.listWindowsLinux();
    }
    if (platform === 'darwin') {
      return this.listWindowsMac();
    }
    return this.listWindowsWindows();
  }

  private async listWindowsLinux(): Promise<WindowInfo[]> {
    try {
      const { stdout } = await execFileAsync('wmctrl', ['-l']);
      return stdout
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const parts = line.split(/\s+/);
          const id = parts[0];
          const title = parts.slice(3).join(' ');
          return { id, title };
        });
    } catch {
      throw new Error(
        'Window listing on Linux requires wmctrl. Install it with: sudo apt install wmctrl'
      );
    }
  }

  private async listWindowsMac(): Promise<WindowInfo[]> {
    try {
      const script = `tell application "System Events" to get name of every process whose visible is true`;
      const { stdout } = await execFileAsync('osascript', ['-e', script]);
      return stdout
        .trim()
        .split(', ')
        .filter(Boolean)
        .map((name, i) => ({ id: String(i), title: name, app: name }));
    } catch {
      throw new Error('Window listing on macOS requires Accessibility permission.');
    }
  }

  private async listWindowsWindows(): Promise<WindowInfo[]> {
    try {
      const ps = `Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object Id,MainWindowTitle | ConvertTo-Json`;
      const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', ps]);
      const parsed = JSON.parse(stdout || '[]');
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      return arr.map((w: { Id: number; MainWindowTitle: string }) => ({
        id: String(w.Id),
        title: w.MainWindowTitle
      }));
    } catch {
      throw new Error('Window listing failed on Windows.');
    }
  }

  async click(x: number, y: number): Promise<void> {
    if (process.platform === 'linux') {
      await this.requireLinuxTool();
      await execFileAsync('xdotool', ['mousemove', String(x), String(y), 'click', '1']);
      return;
    }
    if (process.platform === 'darwin') {
      await execFileAsync('osascript', [
        '-e',
        `tell application "System Events" to click at {${x}, ${y}}`
      ]);
      return;
    }
    throw new Error('Click is not supported on this platform yet.');
  }

  async type(text: string): Promise<void> {
    if (process.platform === 'linux') {
      await this.requireLinuxTool();
      await execFileAsync('xdotool', ['type', '--delay', '20', text]);
      return;
    }
    if (process.platform === 'darwin') {
      const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      await execFileAsync('osascript', [
        '-e',
        `tell application "System Events" to keystroke "${escaped}"`
      ]);
      return;
    }
    throw new Error('Typing is not supported on this platform yet.');
  }

  async key(keyCombo: string): Promise<void> {
    if (process.platform === 'linux') {
      await this.requireLinuxTool();
      await execFileAsync('xdotool', ['key', keyCombo]);
      return;
    }
    if (process.platform === 'darwin') {
      await execFileAsync('osascript', [
        '-e',
        `tell application "System Events" to key code ${keyCombo}`
      ]);
      return;
    }
    throw new Error('Key press is not supported on this platform yet.');
  }

  private async requireLinuxTool(): Promise<void> {
    try {
      await execFileAsync('which', ['xdotool']);
    } catch {
      throw new Error(
        'Input control on Linux requires xdotool. Install it with: sudo apt install xdotool'
      );
    }
  }
}

export const computerService = new ComputerService();
