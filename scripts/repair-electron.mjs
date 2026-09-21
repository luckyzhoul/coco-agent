// Restores the Electron binary that `pnpm install` can wipe when it re-links
// the electron package (its postinstall writes node_modules/electron/path.txt
// and node_modules/electron/dist/, which electron-vite needs to locate the app).
//
// Sets the download mirror explicitly so it works regardless of whether the
// package manager forwards custom .npmrc keys to lifecycle scripts.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const installJs = path.join(projectRoot, 'node_modules', 'electron', 'install.js');

if (!fs.existsSync(installJs)) {
  console.error(`[repair-electron] Not found: ${installJs}`);
  console.error('[repair-electron] Run `pnpm install` first.');
  process.exit(1);
}

process.env.ELECTRON_MIRROR ||= 'https://npmmirror.com/mirrors/electron/';

const result = spawnSync(process.execPath, [installJs], {
  stdio: 'inherit',
  env: process.env,
  cwd: projectRoot
});

if (result.status !== 0) {
  console.error('[repair-electron] Electron install failed.');
  process.exit(result.status ?? 1);
}

const pathTxt = path.join(projectRoot, 'node_modules', 'electron', 'path.txt');
const distDir = path.join(projectRoot, 'node_modules', 'electron', 'dist');
if (!fs.existsSync(pathTxt) || !fs.existsSync(distDir)) {
  console.error('[repair-electron] Install finished but path.txt/dist are still missing.');
  process.exit(1);
}

console.log(`[repair-electron] OK — electron binary at ${distDir}`);
