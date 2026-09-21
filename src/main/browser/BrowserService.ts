import { BrowserWindow } from 'electron';

export interface BrowserElement {
  index: number;
  tag: string;
  type?: string;
  text: string;
  name?: string;
  value?: string;
  href?: string;
}

export interface BrowserSnapshot {
  url: string;
  title: string;
  text: string;
  elements: BrowserElement[];
}

const SNAPSHOT_SCRIPT = `(() => {
  const SELECTOR = 'a, button, input, select, textarea, [role="button"], [role="link"], [role="textbox"], [onclick], [contenteditable="true"]';
  const nodes = Array.from(document.querySelectorAll(SELECTOR));
  const out = [];
  let i = 0;
  for (const el of nodes) {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const visible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    if (!visible) continue;
    el.setAttribute('data-coco-idx', String(i));
    out.push({
      index: i,
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || undefined,
      text: (el.innerText || el.textContent || '').trim().slice(0, 120),
      name: el.getAttribute('name') || el.getAttribute('aria-label') || el.getAttribute('placeholder') || undefined,
      value: ('value' in el ? String(el.value) : '').slice(0, 120) || undefined,
      href: el.getAttribute('href') || undefined
    });
    i++;
    if (i >= 200) break;
  }
  return {
    url: location.href,
    title: document.title,
    text: (document.body ? document.body.innerText : '').slice(0, 6000),
    elements: out
  };
})()`;

export class BrowserService {
  private window: BrowserWindow | null = null;
  private visible = false;

  private ensureWindow(): BrowserWindow {
    if (this.window && !this.window.isDestroyed()) {
      return this.window;
    }

    this.window = new BrowserWindow({
      width: 1200,
      height: 800,
      show: this.visible,
      paintWhenInitiallyHidden: true,
      backgroundColor: '#ffffff',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        javascript: true,
        partition: 'persist:cocoagent-browser'
      }
    });

    this.window.on('closed', () => {
      this.window = null;
    });

    return this.window;
  }

  isOpen(): boolean {
    return !!this.window && !this.window.isDestroyed();
  }

  isVisible(): boolean {
    return this.visible;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (this.window && !this.window.isDestroyed()) {
      if (visible) {
        this.window.show();
      } else {
        this.window.hide();
      }
    }
  }

  getUrl(): string {
    if (!this.window || this.window.isDestroyed()) return '';
    return this.window.webContents.getURL();
  }

  async open(url: string): Promise<BrowserSnapshot> {
    const win = this.ensureWindow();

    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Navigation timeout for ${normalized}`));
      }, 30000);

      const onLoad = () => {
        cleanup();
        resolve();
      };

      const onFail = (_e: unknown, code: number, desc: string) => {
        cleanup();
        reject(new Error(`Navigation failed (${code}): ${desc}`));
      };

      const cleanup = () => {
        clearTimeout(timeout);
        win.webContents.off('did-finish-load', onLoad);
        win.webContents.off('did-fail-load', onFail);
      };

      win.webContents.on('did-finish-load', onLoad);
      win.webContents.on('did-fail-load', onFail);
      win.loadURL(normalized).catch((err) => {
        cleanup();
        reject(err);
      });
    });

    // Give the page a moment to settle (SPA hydration)
    await new Promise((r) => setTimeout(r, 400));

    return this.snapshot();
  }

  async snapshot(): Promise<BrowserSnapshot> {
    const win = this.window;
    if (!win || win.isDestroyed()) {
      throw new Error('Browser is not open. Call browser_open first.');
    }
    const result = await win.webContents.executeJavaScript(SNAPSHOT_SCRIPT, true);
    return result as BrowserSnapshot;
  }

  async click(index: number): Promise<BrowserSnapshot> {
    const win = this.window;
    if (!win || win.isDestroyed()) {
      throw new Error('Browser is not open. Call browser_open first.');
    }

    const script = `(() => {
      const el = document.querySelector('[data-coco-idx="${index}"]');
      if (!el) return { ok: false, error: 'Element ${index} not found' };
      el.scrollIntoView({ block: 'center' });
      el.focus();
      el.click();
      return { ok: true };
    })()`;

    const res = (await win.webContents.executeJavaScript(script, true)) as {
      ok: boolean;
      error?: string;
    };

    if (!res.ok) {
      throw new Error(res.error || `Failed to click element ${index}`);
    }

    await new Promise((r) => setTimeout(r, 600));
    return this.snapshot();
  }

  async fill(index: number, value: string): Promise<BrowserSnapshot> {
    const win = this.window;
    if (!win || win.isDestroyed()) {
      throw new Error('Browser is not open. Call browser_open first.');
    }

    const script = `(() => {
      const el = document.querySelector('[data-coco-idx="${index}"]');
      if (!el) return { ok: false, error: 'Element ${index} not found' };
      el.scrollIntoView({ block: 'center' });
      el.focus();
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
        || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      if (setter && 'value' in el) {
        setter.call(el, ${JSON.stringify(value)});
      } else {
        el.textContent = ${JSON.stringify(value)};
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true };
    })()`;

    const res = (await win.webContents.executeJavaScript(script, true)) as {
      ok: boolean;
      error?: string;
    };

    if (!res.ok) {
      throw new Error(res.error || `Failed to fill element ${index}`);
    }

    return this.snapshot();
  }

  async screenshot(): Promise<string> {
    const win = this.window;
    if (!win || win.isDestroyed()) {
      throw new Error('Browser is not open. Call browser_open first.');
    }
    const image = await win.webContents.capturePage();
    return image.toPNG().toString('base64');
  }

  async getText(): Promise<string> {
    const win = this.window;
    if (!win || win.isDestroyed()) {
      throw new Error('Browser is not open. Call browser_open first.');
    }
    const text = await win.webContents.executeJavaScript(
      `document.body ? document.body.innerText : ''`,
      true
    );
    return String(text);
  }

  async close(): Promise<void> {
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy();
    }
    this.window = null;
  }
}

export const browserService = new BrowserService();
