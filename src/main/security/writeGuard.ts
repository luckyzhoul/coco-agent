import { createLocalBashOperations, createLocalPowerShellOperations } from '@earendil-works/pi-coding-agent';
import type { BashOperations } from '@earendil-works/pi-coding-agent';
import { COCO_HOME } from '../paths';
import { approvalManager } from '../approval/ApprovalManager';
import { pathGuard } from './PathGuard';
import { decide } from './pathPolicy';
import { classifyShellCommand } from './shellPolicy';

/**
 * Call-time write gate shared by the guarded Pi tool operations.
 *
 * Pi's built-in write/edit/bash run in-process inside the SDK, so the app
 * cannot intercept them from the outside — but the SDK lets us replace the
 * filesystem/shell operations those tools call (WriteOperations / EditOperations
 * / BashOperations). AgentRuntime wires them here, making the path policy
 * real for the agent's own file tools, not just the space panel.
 *
 * Mode semantics (see pathPolicy.decide):
 * - full:     everything passes untouched.
 * - auto:     in-zone writes pass; cross-boundary writes prompt. Shell
 *             commands are tiered by security/shellPolicy: read-only and
 *             in-project dev commands pass (long unattended runs), the rest
 *             prompts.
 * - ask:      every write / shell command is held for approval; an approval
 *             IS the grant, so the user can allow anything.
 * - readonly: denied outright — tools stay assembled (stable prompt cache),
 *             every mutation fails here with an explanatory message.
 *
 * The level is read on EVERY call, so switching modes applies to the running
 * session immediately — no session rebuild.
 */

/** Throws when the write must not proceed; resolves silently when allowed. */
export async function guardFileWrite(
  toolName: 'write' | 'edit',
  input: Record<string, unknown>,
  absPath: string,
  description?: string
): Promise<void> {
  const level = pathGuard.level;
  if (level === 'full') return;

  const decision = decide(
    level,
    'write',
    absPath,
    pathGuard.getWorkspaceRoot(),
    COCO_HOME,
    pathGuard.listAuthorized()
  );
  if (decision.allowed) return;

  // readonly: hard deny, no prompt — the user's choice is already recorded.
  if (level === 'readonly') {
    throw new Error(decision.reason || `只读模式下不允许写入 ${absPath}。`);
  }

  const approved = await approvalManager.requireApproval(
    toolName,
    input,
    description ||
      (decision.zone === 'authorized' && decision.reason
        ? `写入授权目录被拒（只读授权）— ${absPath}`
        : `Agent 请求写入项目空间之外：${absPath}`)
  );
  if (!approved) {
    throw new Error(decision.reason || `用户拒绝了对 ${absPath} 的写入。`);
  }
}

function guardShellCommand(toolName: 'bash' | 'powershell', local: BashOperations): BashOperations {
  return {
    exec: async (cmd, cwd, options) => {
      const level = pathGuard.level;
      if (level === 'readonly') {
        throw new Error('当前是只读模式，不允许执行 shell 命令。');
      }
      if (level === 'ask') {
        const approved = await approvalManager.requireApproval(
          toolName,
          { command: cmd },
          `Agent 请求执行 shell 命令：${cmd}`
        );
        if (!approved) {
          throw new Error(`用户拒绝了本次命令执行：${cmd}`);
        }
      } else if (level === 'auto') {
        // Heuristic tiering (security/shellPolicy): read-only and in-project
        // dev commands pass so unattended runs proceed; destructive, network,
        // out-of-zone or unknown commands prompt. May over-prompt, never
        // over-allow.
        const decision = classifyShellCommand(
          cmd,
          pathGuard.getWorkspaceRoot(),
          COCO_HOME,
          pathGuard.listAuthorized()
        );
        if (decision.action === 'prompt') {
          const approved = await approvalManager.requireApproval(
            toolName,
            { command: cmd },
            `${decision.reason || '命令需要确认'}\n命令：${cmd}`
          );
          if (!approved) {
            throw new Error(`用户拒绝了本次命令执行：${cmd}`);
          }
        }
      }
      return local.exec(cmd, cwd, options);
    }
  };
}

/** Guarded bash operations; `shellPath` mirrors BashToolOptions.shellPath. */
export function guardedBashOperations(shellPath?: string): BashOperations {
  return guardShellCommand('bash', createLocalBashOperations(shellPath ? { shellPath } : undefined));
}

/** Guarded PowerShell operations (Windows shell tool). */
export function guardedPowerShellOperations(): BashOperations {
  return guardShellCommand('powershell', createLocalPowerShellOperations());
}
