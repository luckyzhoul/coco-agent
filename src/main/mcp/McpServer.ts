import { spawn, type ChildProcess } from 'node:child_process';
import type { MCPConfig } from '../../shared/types';

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

type RpcResponse = {
  jsonrpc: string;
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
};

type RpcNotification = {
  jsonrpc: string;
  method: string;
  params?: unknown;
};

export class McpServer {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private buffer = '';
  private _running = false;
  private _error: string | null = null;
  private tools: McpTool[] = [];
  private serverInfo: { name: string; version: string } | null = null;
  private onStatusChange: (() => void) | null = null;

  constructor(public config: MCPConfig) {}

  get running(): boolean {
    return this._running;
  }

  get error(): string | null {
    return this._error;
  }

  getTools(): McpTool[] {
    return this.tools;
  }

  getServerInfo(): { name: string; version: string } | null {
    return this.serverInfo;
  }

  setStatusChangeCallback(cb: () => void): void {
    this.onStatusChange = cb;
  }

  async start(): Promise<void> {
    if (this._running) return;
    if (this.config.type !== 'stdio') {
      throw new Error(`Unsupported MCP transport type: ${this.config.type}`);
    }
    if (!this.config.command) {
      throw new Error('MCP command is required for stdio transport');
    }

    this._error = null;
    this.buffer = '';

    const env = {
      ...process.env,
      ...(this.config.env || {})
    };

    this.process = spawn(this.config.command, this.config.args || [], {
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      this.handleStdout(data.toString());
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      console.debug(`[MCP ${this.config.name}] stderr: ${data.toString().trim()}`);
    });

    this.process.on('error', (err) => {
      this._error = err.message;
      this._running = false;
      this.onStatusChange?.();
    });

    this.process.on('exit', (code) => {
      this._running = false;
      if (code !== 0 && code !== null) {
        this._error = `Process exited with code ${code}`;
      }
      this.rejectAllPending(new Error(`MCP server ${this.config.name} exited`));
      this.onStatusChange?.();
    });

    this._running = true;
    this.onStatusChange?.();

    try {
      await this.initialize();
      await this.listTools();
    } catch (err) {
      this._error = err instanceof Error ? err.message : String(err);
      await this.stop();
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (!this.process || !this._running) {
      this._running = false;
      return;
    }

    return new Promise((resolve) => {
      const proc = this.process!;
      const timeout = setTimeout(() => {
        proc.kill('SIGKILL');
      }, 5000);

      proc.on('exit', () => {
        clearTimeout(timeout);
        this._running = false;
        this.process = null;
        this.rejectAllPending(new Error('MCP server stopped'));
        this.onStatusChange?.();
        resolve();
      });

      proc.stdin?.end();
      proc.kill('SIGTERM');
    });
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  private async initialize(): Promise<void> {
    const result = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'cocoagent',
        version: '0.1.0'
      }
    }) as { serverInfo: { name: string; version: string }; capabilities: unknown };

    this.serverInfo = result.serverInfo;

    // Send initialized notification
    this.sendNotification('notifications/initialized', {});
  }

  private async listTools(): Promise<void> {
    const result = await this.sendRequest('tools/list', {}) as { tools: McpTool[] };
    this.tools = result.tools || [];
  }

  private sendRequest(method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this._running || !this.process?.stdin?.writable) {
        reject(new Error('MCP server is not running'));
        return;
      }

      const id = ++this.requestId;
      this.pendingRequests.set(id, { resolve, reject });

      const message = JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params
      });

      this.process.stdin.write(message + '\n');
    });
  }

  private sendNotification(method: string, params: unknown): void {
    if (!this._running || !this.process?.stdin?.writable) return;

    const message = JSON.stringify({
      jsonrpc: '2.0',
      method,
      params
    });

    this.process.stdin.write(message + '\n');
  }

  private handleStdout(data: string): void {
    this.buffer += data;
    let newlineIndex;

    while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);

      if (!line) continue;

      try {
        const message = JSON.parse(line);
        this.handleMessage(message);
      } catch {
        // Skip malformed lines
        console.debug(`[MCP ${this.config.name}] invalid JSON: ${line.slice(0, 100)}`);
      }
    }
  }

  private handleMessage(message: RpcResponse | RpcNotification): void {
    if ('id' in message) {
      // Response
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
      }
    } else if ('method' in message) {
      // Notification from server - log for now
      console.debug(`[MCP ${this.config.name}] notification: ${message.method}`);
    }
  }

  private rejectAllPending(error: Error): void {
    for (const [, pending] of this.pendingRequests) {
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }
}
