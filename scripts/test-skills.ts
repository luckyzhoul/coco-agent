// Unit tests for project-space skill helpers (pure, no Electron required).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  assertSafeSkillName,
  parseSkillFrontmatter,
  projectSkillsDir,
  resolveInsideWorkspace,
  scanSkillsDir
} from '../src/main/skills/projectSkills';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    failures++;
  } else {
    console.log('ok  :', msg);
  }
}

// --- projectSkillsDir ---
assert(
  projectSkillsDir('/space') === path.join('/space', '.coco', 'skills'),
  'project skills dir is <space>/.coco/skills'
);

// --- parseSkillFrontmatter ---
const fm = parseSkillFrontmatter('---\nname: my-skill\ndescription: "带引号的描述"\n---\n\n正文');
assert(fm.name === 'my-skill', 'frontmatter parses name');
assert(fm.description === '带引号的描述', 'frontmatter strips quotes from description');
assert(parseSkillFrontmatter('no frontmatter').name === undefined, 'missing frontmatter yields empty');

// --- scanSkillsDir ---
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'coco-skills-'));
const ws = path.join(tmp, 'space');
fs.mkdirSync(ws);
const skillsDir = projectSkillsDir(ws);

function makeSkill(name: string, frontmatter: string): void {
  const dir = path.join(skillsDir, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\n${frontmatter}\n---\n\nbody`);
}

// Directory does not exist yet
assert(scanSkillsDir(skillsDir, 'project').length === 0, 'missing skills dir scans to empty');

makeSkill('alpha', 'name: alpha\ndescription: Alpha skill');
makeSkill('no-desc', 'name: no-desc');
makeSkill('broken', 'name: broken\ndescription: Broken skill');
fs.rmSync(path.join(skillsDir, 'broken', 'SKILL.md')); // no SKILL.md anymore
fs.writeFileSync(path.join(skillsDir, 'loose-file.txt'), 'not a dir');

const scanned = scanSkillsDir(skillsDir, 'project');
assert(scanned.length === 2, 'scans only directories with SKILL.md');
const alpha = scanned.find((s) => s.name === 'alpha');
assert(!!alpha && alpha.source === 'project' && alpha.loaded, 'valid skill is project-sourced and loaded');
const noDesc = scanned.find((s) => s.name === 'no-desc');
assert(!!noDesc && !noDesc.loaded, 'skill without description is marked not loaded (Pi drops it)');

// Directory-name fallback when frontmatter has no name
makeSkill('dir-name', 'description: Falls back to dir name');
assert(
  scanSkillsDir(skillsDir, 'project').some((s) => s.name === 'dir-name'),
  'skill without frontmatter name falls back to directory name'
);

// --- assertSafeSkillName ---
assertSafeSkillName('ok-name');
assert(throws(() => assertSafeSkillName('../evil')), '.. escapes are rejected');
assert(throws(() => assertSafeSkillName('a/b')), 'path separators are rejected');
assert(throws(() => assertSafeSkillName('.hidden')), 'dotfile names are rejected');
assert(throws(() => assertSafeSkillName('')), 'empty names are rejected');

function throws(fn: () => void): boolean {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

// --- resolveInsideWorkspace ---
const norm = (p: string) => p.toLowerCase().replace(/\\/g, '/');
assert(
  norm(resolveInsideWorkspace(ws, path.join(skillsDir, 'alpha'))) ===
    norm(path.join(fs.realpathSync(ws), '.coco', 'skills', 'alpha')),
  'target inside the space resolves (realpath may differ in case on Windows)'
);
assert(
  throws(() => resolveInsideWorkspace(ws, path.join(ws, '..', 'outside'))),
  '.. traversal outside the space is rejected'
);
assert(
  throws(() => resolveInsideWorkspace(ws, '/etc/passwd')),
  'absolute outside path is rejected'
);

// Symlinked destination pointing outside is rejected
const outside = path.join(tmp, 'outside');
fs.mkdirSync(outside);
try {
  fs.symlinkSync(outside, path.join(skillsDir, 'evil-link'), 'dir');
  assert(
    throws(() => resolveInsideWorkspace(ws, path.join(skillsDir, 'evil-link'))),
    'symlink escape is rejected'
  );
} catch {
  // Symlinks may be unavailable (Windows without privileges) — skip.
}

// Cleanup
fs.rmSync(tmp, { recursive: true, force: true });

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll project-skills tests passed');
