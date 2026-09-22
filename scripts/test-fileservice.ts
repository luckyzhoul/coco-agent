// Unit tests for the project-space path helpers (pure, no Electron required).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  BINARY_EXTENSIONS,
  builtinDefaultPath,
  expandHome,
  looksBinary,
  realpathParent
} from '../src/main/workspace/spacePaths';
import { isInside } from '../src/main/security/pathPolicy';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    failures++;
  } else {
    console.log('ok  :', msg);
  }
}

const HOME = os.homedir();

// --- expandHome ---
assert(expandHome('~') === HOME, 'bare ~ expands to home');
assert(expandHome('~/Desktop/CocoSpace') === path.join(HOME, 'Desktop/CocoSpace'), '~ path expands');
assert(expandHome('  ~/x  ') === path.join(HOME, 'x'), 'surrounding whitespace is trimmed');
assert(expandHome('/abs/path') === '/abs/path', 'absolute path passes through');
assert(expandHome('') === '', 'empty stays empty');
// `~user` is not shell-expandable here; keep it literal rather than mangling it.
assert(expandHome('~someone/x') === '~someone/x', '~user is left literal');

// --- builtinDefaultPath ---
const withDesktop = path.join(HOME, 'Desktop', 'CocoSpace');
assert(
  builtinDefaultPath(HOME) === withDesktop || builtinDefaultPath(HOME) === path.join(HOME, 'CocoSpace'),
  'default space is Desktop/CocoSpace when Desktop exists, else home/CocoSpace'
);
assert(builtinDefaultPath('/nonexistent-home-xyz') === '/nonexistent-home-xyz/CocoSpace',
  'missing Desktop degrades to <home>/CocoSpace');

// --- containment: what FileService relies on ---
const WS = '/home/u/projects/demo';
assert(isInside(WS, path.resolve(WS, 'src/a.ts')), 'space-relative path resolves inside');
assert(!isInside(WS, path.resolve(WS, '../../etc/passwd')), '.. traversal escapes and is rejected');
assert(!isInside(WS, path.resolve(WS, '../demo-evil/x')), 'sibling dir sharing a prefix is rejected');
assert(!isInside(WS, '/etc/passwd'), 'absolute outside path is rejected');

// --- realpathParent: symlink escape ---
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'coco-space-'));
const space = path.join(tmpRoot, 'space');
const outside = path.join(tmpRoot, 'outside');
fs.mkdirSync(space);
fs.mkdirSync(outside);
fs.writeFileSync(path.join(outside, 'secret.txt'), 'nope');
try {
  fs.symlinkSync(outside, path.join(space, 'link'));
  const escaped = realpathParent(path.join(space, 'link', 'secret.txt'));
  assert(!isInside(fs.realpathSync(space), escaped), 'symlinked parent cannot escape the space');
} catch {
  console.log('skip: symlinks unavailable on this platform');
}
assert(
  realpathParent(path.join(space, 'new-file.txt')) === path.join(fs.realpathSync(space), 'new-file.txt'),
  'not-yet-existing file resolves under its real parent'
);

// --- binary detection ---
assert(looksBinary(Buffer.from('hello world'), '.txt') === false, 'plain text is not binary');
assert(looksBinary(Buffer.from([0x68, 0x00, 0x69]), '.txt') === true, 'NUL byte marks binary');
assert(looksBinary(Buffer.alloc(0), '.png') === true, 'image extension marks binary');
assert(BINARY_EXTENSIONS.has('.pdf') && BINARY_EXTENSIONS.has('.zip'), 'archive/pdf extensions listed');

fs.rmSync(tmpRoot, { recursive: true, force: true });

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
if (failures > 0) process.exit(1);
