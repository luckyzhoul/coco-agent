/**
 * Keys of the built-in agent avatar illustrations. Kept in the shared layer so
 * templates (main process) and the picker UI (renderer) agree on the same set;
 * the artwork itself lives in the renderer.
 */
export const AGENT_ICON_KEYS = [
  'owl',
  'whale',
  'fox',
  'cat',
  'mountain',
  'star',
  'leaf',
  'sun',
] as const;

export type BuiltinAgentIconKey = (typeof AGENT_ICON_KEYS)[number];

export const BUILTIN_ICON_PREFIX = 'builtin:';

export const CUSTOM_ICON = 'custom';

export function builtinIcon(key: BuiltinAgentIconKey): string {
  return `${BUILTIN_ICON_PREFIX}${key}`;
}

/** Extract the key from a 'builtin:<key>' value, or null when it is not one. */
export function builtinIconKey(icon: string | undefined): BuiltinAgentIconKey | null {
  if (!icon?.startsWith(BUILTIN_ICON_PREFIX)) return null;
  const key = icon.slice(BUILTIN_ICON_PREFIX.length);
  return (AGENT_ICON_KEYS as readonly string[]).includes(key)
    ? (key as BuiltinAgentIconKey)
    : null;
}
