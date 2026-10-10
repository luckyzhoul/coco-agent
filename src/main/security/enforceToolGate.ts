import { pathGuard } from './PathGuard';
import { approvalManager } from '../approval/ApprovalManager';
import { classifyToolCall } from './toolGate';
import type { ToolGate, ToolGateResult } from './toolGate';

/**
 * The live ToolGate handed to every custom tool builder (browser / computer /
 * MCP / memory).
 *
 * The level is read on EVERY call, so switching modes applies to the running
 * session immediately — no session rebuild. Deny decisions (readonly mode)
 * are final and never bypassed by the global auto-approve setting; prompt
 * decisions go through ApprovalManager, where the user's auto-approve
 * preference and the per-tool memory still apply.
 */
export async function enforceToolGate(
  toolName: string,
  input: Record<string, unknown>,
  description: string
): Promise<ToolGateResult> {
  const decision = classifyToolCall(pathGuard.level, toolName);

  if (decision.action === 'allow') return { blocked: false };
  if (decision.action === 'deny') return { blocked: true, message: decision.reason };

  const approved = await approvalManager.requireApproval(toolName, input, description);
  if (!approved) {
    return { blocked: true, message: `用户拒绝了本次操作：${description}` };
  }
  return { blocked: false };
}

/** Shared gate instance for the tool builders' DI parameter. */
export const toolGate: ToolGate = { enforce: enforceToolGate };
