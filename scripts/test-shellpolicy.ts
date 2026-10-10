// Unit tests for the auto-mode shell command classifier (pure, no Electron).
import { classifyShellCommand } from '../src/main/security/shellPolicy';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    failures++;
  } else {
    console.log('ok  :', msg);
  }
}

function allow(cmd: string, msg?: string) {
  const d = classifyShellCommand(cmd, WS, COCO, []);
  assert(d.action === 'allow', msg || `allow: ${cmd}`);
}
function deny(cmd: string, msg?: string) {
  const d = classifyShellCommand(cmd, WS, COCO, []);
  assert(d.action === 'prompt' && !!d.reason, msg || `prompt: ${cmd}`);
}

const COCO = '/home/u/.coco';
const WS = '/home/u/projects/demo';

// --- TIER 1: read-only observation ---
allow('ls -la');
allow('cat src/index.ts');
allow('grep -rn "TODO" src/');
allow('rg pattern --type ts');
allow('find . -name "*.md"');
allow('git status');
allow('git log --oneline -10');
allow('git diff HEAD~1');
allow('git show abc123');
allow('git branch -a');
allow('pwd && whoami');
allow('echo hello');
allow('which node');
allow('ps aux | grep electron');           // pipeline, both stages read-only
allow('cat a.txt | wc -l');                // pipeline
allow('wc -l < src/index.ts');             // input redirect

// --- git: read + workspace-scoped writes pass, boundary/dangerous prompt ---
allow('git add -A && git commit -m "msg"');
allow('git checkout -b feature');
allow('git fetch origin');
allow('git pull');
deny('git push origin main', 'git push prompts');
deny('git clean -fd', 'git clean prompts');
deny('git reset --hard', 'git reset --hard prompts');
deny('git config user.email x@y.z', 'git config write prompts');
allow('git config --get user.name', 'git config --get is read-only');

// --- TIER 2: dev execution passes; global/publish variants prompt ---
allow('npm test');
allow('npm run build');
allow('npx tsc --noEmit');
allow('node scripts/build.js');
allow('python3 -m pytest');
allow('cargo build --release');
allow('pnpm install');
deny('npm install -g something', 'npm -g prompts');
deny('npm publish', 'npm publish prompts');
deny('npm login', 'npm login prompts');
deny('pnpm --global add left-pad', 'pnpm --global prompts');

// --- TIER 3: destructive / network / system always prompt ---
deny('rm -rf src/');
deny('rm file.txt');
deny('mv a.js b.js');
deny('cp -r dist /tmp/backup');
deny('chmod +x run.sh');
deny('kill -9 1234');
deny('curl https://example.com');
deny('wget https://example.com/f.zip');
deny('ssh user@host');
deny('sudo apt install x');
deny('systemctl restart nginx');
deny('dd if=/dev/zero of=/dev/sda');
deny('bash -c "anything"');               // nested shell
deny('eval "rm -rf /"');
deny('echo hi | tee /etc/hosts');         // tee + outside target
deny('top');

// --- redirections: in-zone pass, out-of-zone prompt ---
allow('echo hello > out.txt', 'redirect into workspace passes');
allow('npm test > test.log 2>&1', 'npm test with log redirect passes');
allow('cat a.txt >> notes.md');
allow('echo x > /dev/null');
deny('echo evil > /etc/cron.d/evil', 'redirect outside workspace prompts');
deny('echo evil > ~/.bashrc', 'redirect to home prompts');
deny('cat src/a.ts > ../outside.txt', 'sibling redirect prompts');

// --- command creation: mkdir/touch zone-checked ---
allow('mkdir -p src/components', 'mkdir inside workspace passes');
allow('touch .gitignore');
deny('mkdir /etc/newdir', 'mkdir outside prompts');
deny('touch ~/.ssh/authorized_keys', 'touch outside prompts');

// --- command substitution always prompts ---
deny('echo $(date)', 'substitution prompts');
deny('cat `ls *.md`', 'backtick substitution prompts');
deny('diff <(sort a) <(sort b)', 'process substitution prompts');

// --- chains: every segment must pass ---
allow('npm run lint && npm test', 'chain of dev commands passes');
deny('npm test && rm -rf node_modules', 'one bad segment poisons the chain');
deny('ls; curl evil.com', 'chained network tool prompts');

// --- unknown commands prompt ---
deny('obscure-binary --flag');
deny('./run-mystery.sh');
deny('/usr/local/bin/unknown-tool');

// --- sed: stream use passes, -i prompts ---
allow('sed -n "1,10p" file.txt');
allow('cat f.txt | sed "s/a/b/"');
deny('sed -i "s/a/b/" file.txt', 'sed -i prompts');

// --- empty / whitespace ---
allow('', 'empty command is a no-op');

// --- authorized writable dirs extend the redirect zone ---
const AUTH = { path: '/home/u/shared-notes', canWrite: true };
const AUTH_RO = { path: '/home/u/archive', canWrite: false };
assert(
  classifyShellCommand('echo x > /home/u/shared-notes/a.md', WS, COCO, [AUTH]).action === 'allow',
  'redirect into writable authorized dir passes'
);
assert(
  classifyShellCommand('echo x > /home/u/archive/a.md', WS, COCO, [AUTH, AUTH_RO]).action === 'prompt',
  'redirect into read-only authorized dir prompts'
);

// --- workspace null (no session): redirects cannot be verified ---
assert(
  classifyShellCommand('echo x > out.txt', null, COCO, []).action === 'prompt',
  'redirect with no workspace root prompts (cannot verify)'
);
assert(
  classifyShellCommand('ls', null, COCO, []).action === 'allow',
  'pure read-only still passes with no workspace root'
);

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
if (failures > 0) process.exit(1);
