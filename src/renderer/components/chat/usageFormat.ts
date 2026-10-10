/**
 * Formatting helpers for the context-usage ring in the chat input toolbar.
 * Pure logic, no React dependency (covered by scripts/test-context-usage.ts).
 */

/** Shape mirrors the Pi SDK's ContextUsage (tokens/percent can be null pre-response). */
export interface ContextUsage {
  tokens: number | null;
  contextWindow: number;
  percent: number | null;
}

/** 800 -> "800", 1536 -> "1.5k", 15000 -> "15k", null -> "—" */
export function formatTokens(tokens: number | null): string {
  if (tokens === null || tokens === undefined) return '—';
  if (tokens < 1000) return String(tokens);
  const k = tokens / 1000;
  const rounded = Math.round(k * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}k`;
}

/** 12.4 -> "12%", null -> "—" */
export function formatPercent(percent: number | null): string {
  if (percent === null || percent === undefined) return '—';
  return `${Math.round(percent)}%`;
}

/** Fraction of the ring to fill, clamped to [0, 1]; unknown usage -> 0. */
export function ringProgress(percent: number | null): number {
  if (percent === null || percent === undefined) return 0;
  return Math.min(1, Math.max(0, percent / 100));
}
