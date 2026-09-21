import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { app } from 'electron';

/**
 * Single source of truth for every path CocoAgent owns.
 *
 * Everything lives under COCO_HOME so the app never writes into Electron's
 * userData directory, the user's ~/.pi/agent, or any other tool's config.
 *
 *   COCO_HOME env  ->  used verbatim (tilde expanded)
 *   packaged       ->  ~/.coco
 *   development    ->  ~/.coco-dev   (keeps dev runs from clobbering real data)
 */
function expandTilde(input: string): string {
  if (input === '~') return os.homedir();
  if (input.startsWith('~/') || input.startsWith('~\\')) {
    return path.join(os.homedir(), input.slice(2));
  }
  return input;
}

function resolveCocoHome(): string {
  const fromEnv = process.env.COCO_HOME?.trim();
  if (fromEnv) {
    return path.resolve(expandTilde(fromEnv));
  }
  return path.join(os.homedir(), app.isPackaged ? '.coco' : '.coco-dev');
}

export const COCO_HOME = resolveCocoHome();

/**
 * Pi SDK agent directory. The SDK reads/writes auth.json, models.json,
 * models-store.json and its resource folders (extensions/skills/prompts/themes)
 * relative to this path, so pointing it here keeps the SDK fully self-contained.
 */
export const PI_RUNTIME_DIR = path.join(COCO_HOME, 'runtime', 'pi-sdk');

export const paths = {
  home: COCO_HOME,
  piRuntime: PI_RUNTIME_DIR,

  /** Single SQLite database for settings, sessions, memories, workspaces. */
  dbFile: path.join(COCO_HOME, 'coco.db'),
  skillsDir: path.join(COCO_HOME, 'skills')
} as const;

/** Project-scoped skills live inside the user's workspace, not COCO_HOME. */
export function projectSkillsDir(workspacePath: string): string {
  return path.join(workspacePath, '.coco', 'skills');
}

export function ensureDir(dir: string): string {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Bootstrap runs at module load, not from a call in index.ts: ES module imports
 * are hoisted, so the manager singletons in other modules would otherwise be
 * constructed before any explicit initializer could run.
 *
 * Setting PI_CODING_AGENT_DIR is defence in depth. We already pass `agentDir`
 * explicitly to createAgentSession, but the SDK also calls getAgentDir()
 * internally for paths that cannot be passed through (managed binaries in
 * bin/, custom tools in tools/, keybindings). Without this, those would
 * silently resolve to ~/.pi/agent.
 */
function bootstrap(): void {
  ensureDir(COCO_HOME);
  ensureDir(paths.skillsDir);
  ensureDir(PI_RUNTIME_DIR);
  process.env.PI_CODING_AGENT_DIR = PI_RUNTIME_DIR;
}

bootstrap();

/** Idempotent re-assertion, exposed for readability at the app entry point. */
export function initCocoHome(): void {
  bootstrap();
}
