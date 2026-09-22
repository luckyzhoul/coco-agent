// Unit tests for the PathGuard policy core (pure, no Electron required).
import {
  decide,
  isInside,
  classifyPath,
  excludedToolsFor,
  WRITE_CAPABLE_TOOLS
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

// --- isInside containment ---
assert(isInside(WS, '/home/u/projects/demo/a.txt'), 'file inside root');
assert(isInside(WS, WS), 'root itself counts as inside');
assert(!isInside(WS, '/home/u/projects/demo-other/a.txt'), 'sibling prefix is NOT inside');
assert(!isInside(WS, '/etc/passwd'), 'system path is not inside');
assert(isInside(COCO, '/home/u/.coco/agents/main/persona.md'), 'coco-home nesting works');

// --- classifyPath ---
assert(classifyPath('/home/u/projects/demo/src/x.ts', WS, COCO) === 'workspace', 'workspace zone');
assert(classifyPath('/home/u/.coco/memory.json', WS, COCO) === 'coco-home', 'coco-home zone');
assert(classifyPath('/etc/hosts', WS, COCO) === 'outside', 'outside zone');

// --- read is always allowed ---
for (const level of ['readonly', 'workspace', 'full'] as const) {
  const d = decide(level, 'read', '/etc/hosts', WS, COCO);
  assert(d.allowed, `read allowed at ${level}`);
}

// --- readonly denies all writes ---
const ro = decide('readonly', 'write', `${WS}/out.txt`, WS, COCO);
assert(!ro.allowed && ro.reason, 'readonly denies workspace write, with reason');
const roOut = decide('readonly', 'write', '/tmp/x', WS, COCO);
assert(!roOut.allowed, 'readonly denies outside write');

// --- workspace level: inside allowed, outside denied ---
assert(decide('workspace', 'write', `${WS}/src/new.ts`, WS, COCO).allowed, 'workspace write allowed');
assert(
  decide('workspace', 'write', `${COCO}/memory.json`, WS, COCO).allowed,
  'coco-home write allowed at workspace level'
);
const wsOut = decide('workspace', 'write', '/etc/cron.d/evil', WS, COCO);
assert(!wsOut.allowed && wsOut.zone === 'outside', 'outside write denied at workspace level');

// --- full allows everything ---
assert(decide('full', 'write', '/etc/anything', WS, COCO).allowed, 'full allows outside write');

// --- sibling-prefix trap (the classic bug) ---
const trap = decide('workspace', 'write', '/home/u/projects/demo-evil/x', WS, COCO);
assert(!trap.allowed, 'sibling directory with shared prefix is denied');

// --- tool exclusion ---
assert(excludedToolsFor('readonly').length === WRITE_CAPABLE_TOOLS.length, 'readonly drops write tools');
assert(excludedToolsFor('workspace').length === 0, 'workspace drops nothing');
assert(excludedToolsFor('full').length === 0, 'full drops nothing');

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
if (failures > 0) process.exit(1);
