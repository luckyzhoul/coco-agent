import type { BrowserWindow } from 'electron';
import { ipcMain } from 'electron';
import {
  TOOL_APPROVAL_REQUEST,
  TOOL_APPROVAL_RESPONSE
} from '../../shared/ipc-channels';
import type { ToolApprovalRequest, ToolApprovalDecision } from '../../shared/types';

// Tools that always require approval (dangerous operations)
const DANGEROUS_TOOL_PATTERNS = [
  /^bash$/,
  /^write$/,
  /^edit$/,
  /^mcp__.*__.*(delete|remove|destroy|execute|run|send|post|put|patch)/i
];

// Tools that are always safe (read-only)
const SAFE_TOOL_PATTERNS = [
  /^read$/,
  /^ls$/,
  /^find$/,
  /^grep$/,
  /^memory_search$/,
  /^memory_list$/,
  /^mcp__.*__.*(list|get|search|read|describe|count|status)/i
];

interface PendingApproval {
  request: ToolApprovalRequest;
  resolve: (approved: boolean) => void;
  timer: NodeJS.Timeout;
}

export class ApprovalManager {
  private mainWindow: BrowserWindow | null = null;
  private pending = new Map<string, PendingApproval>();
  private autoApproveAll = false;
  private approvedTools = new Set<string>();

  constructor() {
    // Listen for approval responses from renderer
    ipcMain.handle(TOOL_APPROVAL_RESPONSE, (_e, id: string, decision: ToolApprovalDecision) => {
      this.handleResponse(id, decision);
    });
  }

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  setAutoApproveAll(value: boolean): void {
    this.autoApproveAll = value;
  }

  isToolDangerous(toolName: string): boolean {
    return DANGEROUS_TOOL_PATTERNS.some(pattern => pattern.test(toolName));
  }

  isToolSafe(toolName: string): boolean {
    return SAFE_TOOL_PATTERNS.some(pattern => pattern.test(toolName));
  }

  async requireApproval(
    toolName: string,
    toolInput: Record<string, unknown>,
    description: string
  ): Promise<boolean> {
    // Auto-approve everything if enabled
    if (this.autoApproveAll) {
      return true;
    }

    // Auto-approve safe tools
    if (this.isToolSafe(toolName)) {
      return true;
    }

    // Auto-approve if user already approved this specific tool
    if (this.approvedTools.has(toolName)) {
      return true;
    }

    // Dangerous tools always require approval
    const isDangerous = this.isToolDangerous(toolName);

    // For semi-dangerous tools (not in safe list, not in dangerous list),
    // we could have a setting, but for now require approval for everything not safe

    const requestId = `approval_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        // Timeout: deny by default
        const pending = this.pending.get(requestId);
        if (pending) {
          this.pending.delete(requestId);
          resolve(false);
        }
      }, 5 * 60 * 1000); // 5 minute timeout

      const request: ToolApprovalRequest = {
        id: requestId,
        toolName,
        toolInput,
        description,
        isDangerous
      };

      this.pending.set(requestId, { request, resolve, timer });

      // Send request to renderer
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send(TOOL_APPROVAL_REQUEST, request);
      } else {
        // No window, auto-deny
        clearTimeout(timer);
        this.pending.delete(requestId);
        resolve(false);
      }
    });
  }

  private handleResponse(id: string, decision: ToolApprovalDecision): void {
    const pending = this.pending.get(id);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pending.delete(id);

    if (decision === 'approve_all') {
      this.approvedTools.add(pending.request.toolName);
    }

    const approved = decision === 'approve' || decision === 'approve_all';
    pending.resolve(approved);
  }
}

export const approvalManager = new ApprovalManager();
