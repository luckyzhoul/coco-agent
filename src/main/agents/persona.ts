import * as fs from 'node:fs';
import * as path from 'node:path';
import { COCO_HOME, ensureDir } from '../paths';
import { splitFrontmatter } from './frontmatter';

/**
 * An agent's persona lives as a human-editable markdown file inside the agent
 * folder: ${COCO_HOME}/agents/<id>/persona.md
 *
 * Frontmatter is optional; the body is the free-form personality description.
 * Keeping it as a file (rather than a DB column) is what makes an agent a
 * portable, backup-friendly folder.
 */
export interface AgentPersona {
  name?: string;
  description?: string;
  /** Free-form personality text, injected into the system prompt. */
  body: string;
}

export function agentDir(agentId: string): string {
  return path.join(COCO_HOME, 'agents', agentId);
}

export function agentSkillsDir(agentId: string): string {
  return path.join(agentDir(agentId), 'skills');
}

export function personaPath(agentId: string): string {
  return path.join(agentDir(agentId), 'persona.md');
}

export function parsePersona(content: string): AgentPersona {
  const { fields, body } = splitFrontmatter(content);
  return {
    name: fields.name,
    description: fields.description,
    body
  };
}

export function readPersona(agentId: string): AgentPersona | null {
  const file = personaPath(agentId);
  try {
    if (!fs.existsSync(file)) return null;
    return parsePersona(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

export function writePersona(agentId: string, persona: AgentPersona): void {
  ensureDir(agentDir(agentId));

  const frontmatter: string[] = [];
  if (persona.name) frontmatter.push(`name: ${persona.name}`);
  if (persona.description) frontmatter.push(`description: ${persona.description}`);

  const header = frontmatter.length > 0 ? `---\n${frontmatter.join('\n')}\n---\n\n` : '';
  fs.writeFileSync(personaPath(agentId), header + persona.body.trim() + '\n');
}

/**
 * Build the text appended to the SDK's system prompt. Returns an empty array
 * when the agent has no persona, so callers can pass it straight through.
 */
export function buildPersonaPrompt(agentId: string): string[] {
  const persona = readPersona(agentId);
  if (!persona?.body) return [];

  const heading = persona.name ? `# Your identity: ${persona.name}\n\n` : '';
  return [
    `You are role-playing as a specific assistant persona. Stay in character in tone and style, ` +
      `but never let the persona override factual accuracy or the user's explicit instructions.\n\n` +
      heading +
      persona.body
  ];
}
