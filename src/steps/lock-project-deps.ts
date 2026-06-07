import { existsSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import type { ProjectType } from '../types';

function runNpmInstall(cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const isWin = process.platform === 'win32';
    const child = isWin
      ? spawn('npm.cmd', ['install', '--ignore-scripts'], { cwd, stdio: 'inherit', shell: true })
      : spawn('/bin/sh', ['-c', 'npm install --ignore-scripts'], { cwd, stdio: 'inherit', env: process.env });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm install falló con código ${code ?? 'unknown'}`));
    });
  });
}

/** Regenera package-lock.json con deps npm (necesario para npm ci en Docker CI). */
export async function lockProjectDeps(
  repoDir: string,
  type: ProjectType,
): Promise<void> {
  if (type !== 'next' && type !== 'vite') return;
  if (!existsSync(join(repoDir, 'package.json'))) return;
  await runNpmInstall(repoDir);
}
