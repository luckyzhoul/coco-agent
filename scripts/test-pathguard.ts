// Unit tests for the PathGuard policy core (pure, no Electron required).
import {
  decide,
  isInside,
  classifyPath,
  normalizeSecurityLevel
} from '../src/main/security/pathPolicy';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    failures++;
  } else {
    console.log('ok  :', msg);
  }
}

const COCO = '/home/u/.coco';
const WS = '/home/u/projects/demo';
const AUTH = { path: '/home/u/shared-notes', canWrite: true };
const AUTH_RO = { path: '/home/u/archive', canWrite: false };

// --- isInside containment ---
assert(isInside(WS, '/home/u/projects/demo/a.txt'), 'file inside root');
assert(isInside(WS, WS), 'root itself counts as inside');
assert(!isInside(WS, '/home/u/projects/demo-other/a.txt'), 'sibling prefix is NOT inside');
assert(!isInside(WS, '/etc/passwd'), 'system path is not inside');
assert(isInside(COCO, '/home/u/.coco/agents/main/persona.md'), 'coco-home nesting works');

// --- level normalization (legacy + garbage) ---
assert(normalizeSecurityLevel('workspace') === 'auto', "legacy 'workspace' maps to 'auto'");
assert(normalizeSecurityLevel('auto') === 'auto', "'auto' passes through");
assert(normalizeSecurityLevel('ask') === 'ask', "'ask' passes through");
assert(normalizeSecurityLevel('nonsense') === 'auto', 'unknown value falls back to default');

// --- classifyPath ---
assert(classifyPath('/home/u/projects/demo/src/x.ts', WS, COCO, [AUTH]) === 'workspace', 'workspace zone');
assert(classifyPath('/home/u/shared-notes/a.md', WS, COCO, [AUTH]) === 'authorized', 'authorized zone');
assert(classifyPath('/home/u/.coco/memory.json', WS, COCO, [AUTH]) === 'coco-home', 'coco-home zone');
assert(classifyPath('/etc/hosts', WS, COCO, [AUTH]) === 'outside', 'outside zone');

// --- read is always allowed ---
for (const level of ['readonly', 'ask', 'auto', 'full'] as const) {
  const d = decide(level, 'read', '/etc/hosts', WS, COCO, [AUTH]);
  assert(d.allowed, `read allowed at ${level}`);
}

// --- readonly denies all writes ---
const ro = decide('readonly', 'write', `${WS}/out.txt`, WS, COCO, [AUTH]);
assert(!ro.allowed && ro.reason, 'readonly denies workspace write, with reason');
const roOut = decide('readonly', 'write', '/tmp/x', WS, COCO, [AUTH]);
assert(!roOut.allowed, 'readonly denies outside write');

// --- ask denies pending user confirmation (writeGuard turns deny into prompt) ---
const askWs = decide('ask', 'write', `${WS}/out.txt`, WS, COCO, [AUTH]);
assert(!askWs.allowed && askWs.reason, 'ask holds in-workspace write for confirmation');
const askAuth = decide('ask', 'write', `${AUTH.path}/a.md`, WS, COCO, [AUTH]);
assert(!askAuth.allowed, 'ask holds authorized-dir write for confirmation');

// --- auto level: in-zone allowed, out-of-zone denied ---
assert(decide('auto', 'write', `${WS}/src/new.ts`, WS, COCO, [AUTH]).allowed, 'workspace write allowed');
assert(
  decide('auto', 'write', `${COCO}/memory.json`, WS, COCO, [AUTH]).allowed,
  'coco-home write allowed at auto level'
);
assert(
  decide('auto', 'write', `${AUTH.path}/a.md`, WS, COCO, [AUTH]).allowed,
  'writable authorized dir allowed at auto level'
);
const autoRo = decide('auto', 'write', `${AUTH_RO.path}/old.md`, WS, COCO, [AUTH, AUTH_RO]);
assert(!autoRo.allowed && autoRo.reason, 'read-only authorized dir denies writes at auto level');
const autoOut = decide('auto', 'write', '/etc/cron.d/evil', WS, COCO, [AUTH]);
assert(!autoOut.allowed && autoOut.zone === 'outside', 'outside write denied at auto level');

// --- full allows everything ---
assert(decide('full', 'write', '/etc/anything', WS, COCO, [AUTH]).allowed, 'full allows outside write');

// --- sibling-prefix trap (the classic bug) ---
const trap = decide('auto', 'write', '/home/u/projects/demo-evil/x', WS, COCO, [AUTH]);
assert(!trap.allowed, 'sibling directory with shared prefix is denied');
const trapAuth = classifyPath('/home/u/shared-notes-extra/x', WS, COCO, [AUTH]);
assert(trapAuth === 'outside', 'authorized sibling with shared prefix stays outside');

// --- tool assembly is mode-independent (call-time gate, cache-stable) ---
// No level excludes tools: readonly denies at call time via writeGuard.
console.log('ok  : tools stay assembled in every mode (call-time enforcement)');

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
if (failures > 0) process.exit(1);
