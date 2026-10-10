/**
 * Central tool-call classifier — the mode-level gate for every assembled tool.
 *
 * Architecture mirror of openhanako's session-permission-mode classifier: all
 * tools stay assembled in every security level (stable prompt cache), and each
 * call is classified at execution time against the live level. The four modes
 * map to openhanako's SESSION_PERMISSION_MODES:
 *
 * - readonly (只读模式):   observation tools pass, every mutation is denied
 *                          outright, with a message telling the model which
 *                          layer blocked it and how to get unlocked.
 * - ask (操作前询问):      observation tools pass, every mutation is held for
 *                          per-call user confirmation.
 * - auto (自动审核,默认):  app-internal side effects are regular work and
 *                          pass; anything reaching outside the app boundary
 *                          (browser/computer control, unknown MCP verbs) is
 *                          held for review. We use a human prompt as the
 *                          reviewer where openhanako uses an LLM judge — a
 *                          desktop user is present, and a human is strictly
 *                          more reliable.
 * - full (完整权限):       everything passes.
 *
 * File/shell tools (write/edit/bash/powershell) are expected to be gated by
 * security/writeGuard instead, which adds path-zone awareness on top of the
 * mode; they should never be routed through this classifier.
 *
 * Pure logic — no Electron imports — so it is unit-testable directly.
 */

import type { SecurityLevel } from './pathPolicy';

export type GateAction = 'allow' | 'deny' | 'prompt';

export interface GateDecision {
  action: GateAction;
  /** Populated for deny (the model-facing unlock hint) and useful for prompts. */
  reason?: string;
}

/** Result of the wired gate (see enforceToolGate). */
export interface ToolGateResult {
  blocked: boolean;
  message?: string;
}

/** Dependency-injected gate interface consumed by the tool builders. */
export interface ToolGate {
  enforce(
    toolName: string,
    input: Record<string, unknown>,
    description: string
  ): Promise<ToolGateResult>;
}

/**
 * Read-only observation — allowed in EVERY mode, mirroring openhanako's
 * INFORMATION_TOOLS ("平时可只读访问系统普通文件").
 */
export const INFORMATION_TOOLS: ReadonlySet<string> = new Set([
  'read',
  'ls',
  'find',
  'grep',
  'memory_search',
  'memory_list',
  'browser_open',
  'browser_snapshot',
  'browser_get_text',
  'browser_screenshot',
  'computer_screenshot',
  'computer_list_windows'
]);

/**
 * Mutations scoped inside the app's own data. At `auto` these are regular
 * work (openhanako lets SIDE_EFFECT_TOOLS pass in AUTO); the memory store and
 * the agent browser session are app-internal surfaces.
 */
export const INTERNAL_SIDE_EFFECT_TOOLS: ReadonlySet<string> = new Set([
  'memory_add',
  'memory_delete',
  'memory_compile',
  'browser_close'
]);

/**
 * Control primitives reaching beyond the app: the agent's browser page and
 * the user's desktop. At `auto` these are cross-boundary and held for review.
 */
export const EXTERNAL_SIDE_EFFECT_TOOLS: ReadonlySet<string> = new Set([
  'browser_click',
  'browser_fill',
  'computer_click',
  'computer_type',
  'computer_key'
]);

/**
 * Gated by security/writeGuard with path-zone awareness — never routed here.
 * Listed so the classifier's contract about them stays explicit.
 */
export const FILE_SHELL_TOOLS: ReadonlySet<string> = new Set([
  'write',
  'edit',
  'bash',
  'powershell'
]);

/** MCP verbs that are safe to auto-allow at `auto` (same policy as before). */
const MCP_SAFE_VERBS = /(list|get|search|read|describe|count|status)/i;

const READONLY_UNLOCK_HINT =
  '如需放开，请让用户把输入框左侧的安全级别切换为「自动审核」「操作前询问」或「完整权限」。';

/**
 * Classify a tool call against the live security level. Name-based only —
 * path-level decisions belong to writeGuard, tool-input decisions to the
 * approval dialog.
 */
export function classifyToolCall(level: SecurityLevel, toolName: string): GateDecision {
  if (level === 'full') return { action: 'allow' };

  if (INFORMATION_TOOLS.has(toolName)) return { action: 'allow' };

  if (level === 'readonly') {
    return {
      action: 'deny',
      reason: `当前是只读模式，工具「${toolName}」被安全层拦截（layer: readonly_mode）。${READONLY_UNLOCK_HINT}`
    };
  }

  if (level === 'ask') {
    return { action: 'prompt' };
  }

  // auto（自动审核）— Codex-style boundary: in-app side effects are regular
  // work; cross-boundary and unknown tools are held for review.
  if (INTERNAL_SIDE_EFFECT_TOOLS.has(toolName)) return { action: 'allow' };
  if (EXTERNAL_SIDE_EFFECT_TOOLS.has(toolName)) {
    return {
      action: 'prompt',
      reason: `「${toolName}」会操作浏览器或用户桌面，属于应用边界之外的动作，需用户确认。`
    };
  }
  if (toolName.startsWith('mcp__')) {
    const verb = toolName.split('__')[2] || '';
    if (MCP_SAFE_VERBS.test(verb)) return { action: 'allow' };
    return {
      action: 'prompt',
      reason: `MCP 工具「${toolName}」不是明确的只读操作，需用户确认。`
    };
  }

  // Unknown tool (or a file/shell tool wrongly routed here): conservative
  // answer is a human review, never a silent allow.
  return {
    action: 'prompt',
    reason: `工具「${toolName}」未纳入安全分类，需用户确认。`
  };
}
