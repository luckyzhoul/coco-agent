/**
 * Memory tiering math — kept IO-free so it can be unit-tested without Electron.
 */

export type MemoryTier = 'recent' | 'long_term';

/**
 * Recency boost for `recent` memories: a fresh entry scores up to 2x and decays
 * to 1x after one half-life. Long-term entries are stable knowledge, so they
 * get no decay — their value should not depend on when they were written.
 */
export const RECENCY_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;

export function recencyWeight(updatedAt: number, now: number = Date.now()): number {
  const age = Math.max(0, now - updatedAt);
  return 1 + Math.pow(0.5, age / RECENCY_HALF_LIFE_MS);
}

/** Recent entries surface first, then long-term; within a tier newest wins. */
export function tierOrder(t: MemoryTier): number {
  return t === 'recent' ? 0 : 1;
}
