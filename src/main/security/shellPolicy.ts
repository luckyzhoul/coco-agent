import { resolve } from 'node:path';
import { classifyPath, isInside, type AuthorizedRoot } from './pathPolicy';

/**
 * Shell-command classifier for the `auto` (自动审核) security level — what
 * makes long unattended runs possible.
 *
 * The problem: writeGuard used to prompt for EVERY shell command at `auto`,
 * which blocks the agent on each `npm test` — unattended runs died by
 * five-minute timeouts. This classifier replaces that with a three-tier
 * heuristic in the spirit of openhanako's AUTO mode ("in-workspace work is
 * regular work; cross-boundary actions are held for review"):
 *
 * - readonly tier — pure observation (ls/grep/git status/...): pass.
 * - dev tier — project code runners (npm/npx/node/cargo/...): pass, since
 *   their normal writes land inside the project. Documented boundary: these
 *   execute arbitrary project code, which no path policy can contain — the
 *   real backstop remains the (future) OS sandbox.
 * - everything else — destructive primitives (rm/dd/chmod), network tools
 *   (curl/ssh), command substitution, unknown commands, or writes pointing
 *   outside the guarded roots: prompt.
 *
 * Parsing is deliberately heuristic regex, not a shell lexer. EVERY ambiguous
 * case falls to `prompt` — the classifier may over-prompt, never over-allow.
 * Pure logic, no Electron imports, unit-testable directly.
 */

export type ShellAction = 'allow' | 'prompt';

export interface ShellDecision {
  action: ShellAction;
  /** Chinese explanation for the approval dialog, populated when prompting. */
  reason?: string;
}

/** Pure-observation commands: no filesystem writes, no network, no exec. */
const READ_ONLY = new Set([
  'ls', 'dir', 'cat', 'head', 'tail', 'grep', 'rg', 'find', 'fd', 'stat',
  'wc', 'file', 'du', 'df', 'tree', 'which', 'where', 'whereis', 'whoami',
  'id', 'hostname', 'pwd', 'env', 'printenv', 'date', 'uname', 'basename',
  'dirname', 'realpath', 'readlink', 'diff', 'cmp', 'ps', 'tasklist',
  'uptime', 'free', 'echo', 'printf', 'sort', 'uniq', 'cut', 'tr', 'jq',
  'less', 'more', 'man', 'info', 'history', 'type', 'help', 'sleep', 'wait',
  'true', 'false', 'test', 'cd', 'export', 'unset', 'alias', 'unalias',
  'set', 'jobs'
]);

/**
 * Project code runners / build tools. Normal writes land inside the project
 * (node_modules, dist, .git, caches). Blocked variants (global installs,
 * publishing, logins) are checked separately.
 */
const DEV_EXECUTION = new Set([
  'npm', 'npx', 'pnpm', 'yarn', 'node', 'nodejs', 'python', 'python3',
  'pip', 'pip3', 'cargo', 'rustc', 'go', 'make', 'cmake', 'tsc', 'eslint',
  'prettier', 'jest', 'vitest', 'pytest', 'java', 'javac', 'gradle', 'mvn',
  'deno', 'bun', 'php', 'ruby', 'dotnet', 'gcc', 'g++', 'cc', 'clang'
]);

/** Dev-command tokens that reach beyond the project (network/accounts). */
const DEV_BLOCKED_TOKENS = [
  '-g', '--global', 'publish', 'upload', 'login', 'logout', 'deploy',
  'adduser'
];

/** Destructive / system / network primitives — always prompt at `auto`. */
const ALWAYS_PROMPT = new Set([
  'rm', 'rmdir', 'mv', 'cp', 'dd', 'mkfs', 'shred', 'chmod', 'chown',
  'chgrp', 'kill', 'killall', 'pkill', 'taskkill', 'shutdown', 'reboot',
  'halt', 'poweroff', 'sudo', 'su', 'doas', 'mount', 'umount', 'curl',
  'wget', 'ssh', 'scp', 'sftp', 'ftp', 'nc', 'ncat', 'telnet', 'ping',
  'apt', 'apt-get', 'yum', 'dnf', 'brew', 'choco', 'winget', 'snap',
  'systemctl', 'service', 'crontab', 'tee', 'ln', 'truncate', 'xargs',
  'eval', 'exec', 'source', 'bash', 'sh', 'zsh', 'cmd', 'powershell',
  'pwsh', 'start', 'open', 'xdg-open', 'awk', 'vim', 'vi', 'nano', 'emacs',
  'top', 'htop'
]);

/** File-creating commands whose plain path arguments can be zone-checked. */
const PATH_WRITE_SAFE = new Set(['mkdir', 'touch']);

// --- git: subcommand decides the tier ---
const GIT_READ = new Set([
  'status', 'log', 'diff', 'show', 'branch', 'remote', 'rev-parse',
  'describe', 'reflog', 'shortlog', 'ls-files', 'blame', 'ls-remote',
  'grep', 'tag', 'worktree'
]);
const GIT_PROMPT = new Set([
  'push', 'clean', 'reset', 'bisect', 'submodule', 'filter-branch', 'gc',
  'prune', 'config'
]);

// --- PowerShell cmdlets (the Windows shell tool) ---
const PS_READ = new Set([
  'get-childitem', 'get-content', 'get-item', 'get-process', 'get-location',
  'get-date', 'get-host', 'test-path', 'measure-object', 'select-string',
  'select-object', 'where-object', 'sort-object', 'write-output',
  'write-host', 'ls', 'dir', 'cat', 'echo', 'pwd', 'gc', 'gci', 'ps'
]);
const PS_PROMPT = new Set([
  'remove-item', 'ri', 'del', 'rm', 'clear-content', 'stop-process', 'kill',
  'set-item', 'new-item', 'ni', 'copy-item', 'cp', 'cpi', 'move-item', 'mv',
  'mi', 'rename-item', 'invoke-command', 'invoke-expression', 'iex',
  'invoke-webrequest', 'iwr', 'invoke-restmethod', 'curl', 'start-process',
  'start-job', 'set-content', 'sc', 'add-content', 'ac', 'out-file',
  'export-csv', 'set-executionpolicy', 'new-service', 'stop-service'
]);

function basename(token: string): string {
  const stripped = token.replace(/^["']|["']$/g, '').replace(/[\\/]+$/, '');
  const norm = stripped.replace(/[\\/]/g, '/');
  const base = norm.split('/').pop() || norm;
  return base.replace(/\.exe$/i, '').toLowerCase();
}

function prompt(reason: string): ShellDecision {
  return { action: 'prompt', reason };
}

const allow: ShellDecision = { action: 'allow' };

/** True when the redirect/creation target is inside a writable guarded zone. */
function targetInWritableZone(
  target: string,
  workspaceRoot: string | null,
  cocoHome: string,
  authorizedRoots: AuthorizedRoot[]
): boolean {
  if (!workspaceRoot) return false;
  if (/^\/dev\/null$/i.test(target) || /^nul$/i.test(target)) return true;
  // '~' expands to the user's home in the shell — outside the workspace in
  // practice, and this pure classifier cannot expand it. Conservative deny.
  if (target.startsWith('~')) return false;
  const zone = classifyPath(resolve(workspaceRoot, target), workspaceRoot, cocoHome, authorizedRoots);
  if (zone === 'workspace' || zone === 'coco-home') return true;
  if (zone === 'authorized') {
    const root = authorizedRoots.find((r) => isInside(resolve(r.path), resolve(workspaceRoot, target)));
    return root?.canWrite === true;
  }
  return false;
}

/**
 * Find output redirections (`>`, `>>`, `2>`, `&>>`) in a pipe stage and
 * verify every target is inside a writable zone. `2>&1` style stream
 * duplication is ignored. Unparseable targets are treated as outside.
 */
function redirectDecision(
  stage: string,
  workspaceRoot: string | null,
  cocoHome: string,
  authorizedRoots: AuthorizedRoot[]
): ShellDecision | null {
  const pattern = /(?:^|\s)(\d?>>|&>>|\d?>|>)\s*("[^"]*"|'[^']*'|\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(stage)) !== null) {
    const raw = match[2];
    const target = raw.replace(/^["']|["']$/g, '');
    if (target.startsWith('&')) continue; // 2>&1 — stream duplication
    if (!targetInWritableZone(target, workspaceRoot, cocoHome, authorizedRoots)) {
      return prompt(`命令把输出重定向到受保护位置「${target}」，超出项目空间/授权目录。`);
    }
  }
  return null;
}

/** Zone-check the plain path arguments of mkdir/touch-style commands. */
function pathArgsDecision(
  stage: string,
  workspaceRoot: string | null,
  cocoHome: string,
  authorizedRoots: AuthorizedRoot[]
): ShellDecision | null {
  const args = stage.trim().split(/\s+/).slice(1);
  for (const arg of args) {
    if (arg.startsWith('-')) continue;
    const target = arg.replace(/^["']|["']$/g, '');
    if (!targetInWritableZone(target, workspaceRoot, cocoHome, authorizedRoots)) {
      return prompt(`命令要在受保护位置创建「${target}」，超出项目空间/授权目录。`);
    }
  }
  return null;
}

/** Classify one pipe stage (no `&&`/`;`/`|` inside). */
function classifyStage(
  stage: string,
  workspaceRoot: string | null,
  cocoHome: string,
  authorizedRoots: AuthorizedRoot[]
): ShellDecision {
  const trimmed = stage.trim();
  if (!trimmed) return allow;

  const redirect = redirectDecision(trimmed, workspaceRoot, cocoHome, authorizedRoots);
  if (redirect) return redirect;

  const tokens = trimmed.split(/\s+/);
  const cmd = basename(tokens[0]);

  if (PS_PROMPT.has(cmd)) return prompt(`PowerShell 命令「${cmd}」会修改系统或文件，需要确认。`);
  if (PS_READ.has(cmd)) return allow;

  if (ALWAYS_PROMPT.has(cmd)) {
    return prompt(`命令「${cmd}」属于破坏性/系统/网络操作，自动审核模式下需要用户确认。`);
  }

  if (cmd === 'git') {
    const sub = (tokens[1] || '').toLowerCase();
    if (!sub) return prompt('git 命令缺少子命令，无法判定。');
    // Read-only config lookups must be checked BEFORE the GIT_PROMPT lookup.
    if (sub === 'config') {
      if (/^(--get|--list|-l)\b/.test(tokens.slice(2).join(' '))) return allow;
      return prompt('git config 写入会修改用户级配置，需要用户确认。');
    }
    if (GIT_PROMPT.has(sub)) return prompt(`git ${sub} 会产生仓库之外或不可逆的影响，需要用户确认。`);
    return allow; // read subcommands + workspace-scoped repo writes
  }

  if (cmd === 'sed') {
    if (tokens.some((t) => /^-{1,2}i/.test(t))) {
      return prompt('sed -i 会直接改写文件，需要用户确认。');
    }
    return allow;
  }

  if (PATH_WRITE_SAFE.has(cmd)) {
    const decision = pathArgsDecision(trimmed, workspaceRoot, cocoHome, authorizedRoots);
    return decision || allow;
  }

  if (DEV_EXECUTION.has(cmd)) {
    const blocked = tokens.find((t) => DEV_BLOCKED_TOKENS.includes(t.toLowerCase()));
    if (blocked) {
      return prompt(`命令包含「${blocked}」（全局安装/发布/账号操作），需要用户确认。`);
    }
    return allow;
  }

  if (READ_ONLY.has(cmd)) return allow;

  return prompt(`命令「${cmd}」不在只读/开发命令白名单中，需要用户确认。`);
}

/**
 * Classify a full shell command line at the `auto` level.
 *
 * Chains (`&&`, `||`, `;`, newlines) and pipelines (`|`) are split and every
 * stage must pass; command substitution (`$(...)`, backticks) always prompts.
 */
export function classifyShellCommand(
  command: string,
  workspaceRoot: string | null,
  cocoHome: string,
  authorizedRoots: AuthorizedRoot[] = []
): ShellDecision {
  const trimmed = command.trim();
  if (!trimmed) return allow;

  if (/\$\(/.test(trimmed) || /`/.test(trimmed) || /<\(/.test(trimmed)) {
    return prompt('命令包含 $() / 反引号命令替换，无法静态判定其效果。');
  }

  const segments = trimmed.split(/&&|\|\||;|\n/);
  for (const segment of segments) {
    for (const stage of segment.split('|')) {
      const decision = classifyStage(stage, workspaceRoot, cocoHome, authorizedRoots);
      if (decision.action === 'prompt') return decision;
    }
  }
  return allow;
}
