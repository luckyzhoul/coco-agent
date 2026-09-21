/**
 * Minimal YAML-frontmatter splitter used for persona files.
 *
 * Deliberately dependency-free and IO-free so it can be unit-tested without
 * booting Electron.
 */
export interface Frontmatter {
  fields: Record<string, string>;
  body: string;
}

export function splitFrontmatter(content: string): Frontmatter {
  // The inner group is optional so an empty block (`---\n---`) still parses.
  const match = content.match(/^---\s*\r?\n(?:([\s\S]*?)\r?\n)?---\s*(?:\r?\n|$)/);
  if (!match) return { fields: {}, body: content.trim() };

  const fields: Record<string, string> = {};
  for (const line of (match[1] ?? '').split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;

    const key = line.slice(0, colon).trim();
    let value = line.slice(colon + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) fields[key] = value;
  }

  return { fields, body: content.slice(match[0].length).trim() };
}
