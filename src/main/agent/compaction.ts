/**
 * Compaction settings derived from the active model's context window.
 *
 * Pure logic, no Electron dependency (covered by scripts/test-compaction-settings.ts).
 *
 * Pi's auto-compaction triggers when `contextTokens > contextWindow - reserveTokens`
 * and keeps the most recent `keepRecentTokens` when summarizing. The SDK defaults
 * (16384 / 20000) assume a large window; on small-context local models a fixed
 * reserve could exceed the window itself and compact after every turn, so the
 * budgets scale with the window and only cap at the SDK defaults.
 */

/** SDK defaults, see pi-coding-agent docs/compaction.md */
const DEFAULT_RESERVE_TOKENS = 16_384;
const DEFAULT_KEEP_RECENT_TOKENS = 20_000;

export interface CompactionSettings {
  enabled: boolean;
  reserveTokens: number;
  keepRecentTokens: number;
}

export function buildCompactionSettings(contextWindow?: number): CompactionSettings {
  const enabled = true;

  if (!contextWindow || contextWindow <= 0) {
    return { enabled, reserveTokens: DEFAULT_RESERVE_TOKENS, keepRecentTokens: DEFAULT_KEEP_RECENT_TOKENS };
  }

  const reserveTokens = Math.min(DEFAULT_RESERVE_TOKENS, Math.floor(contextWindow * 0.1));
  const keepRecentTokens = Math.min(DEFAULT_KEEP_RECENT_TOKENS, Math.floor(contextWindow * 0.25));
  return { enabled, reserveTokens, keepRecentTokens };
}

/**
 * SDK 把「无需压缩」也当错误抛出（compaction_end errorMessage + re-throw），
 * 这里识别这些良性场景并给出给用户看的提示；真错误返回 null。
 * 注意传入的可能是 SDK 包装后的 "Compaction failed: <原始消息>"。
 */
export function benignCompactionNotice(errorMessage: string): string | null {
  if (!errorMessage) return null;
  if (errorMessage.includes('Nothing to compact')) return '会话较短，暂无需压缩';
  if (errorMessage.includes('Already compacted')) return '上下文已压缩过，暂无需再次压缩';
  return null;
}
