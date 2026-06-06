import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import simpleGit from 'simple-git';
import { SEED_REPOS } from '../seed-urls';
import type { ProjectType } from '../types';

export async function cloneSeed(opts: {
  type: ProjectType;
  workDir: string;
  emitDetail?: string;
}): Promise<string> {
  const { type, workDir } = opts;
  const seedUrl = SEED_REPOS[type];
  const destDir = join(workDir, 'repo');

  await rm(destDir, { recursive: true, force: true });
  await mkdir(workDir, { recursive: true });

  const git = simpleGit();
  await git.clone(seedUrl, destDir, ['--depth', '1', '--branch', 'main']);

  await rm(join(destDir, '.git'), { recursive: true, force: true });

  return destDir;
}

export async function initAndPushRepo(opts: {
  repoDir: string;
  remoteUrl: string;
  message: string;
}): Promise<void> {
  const { repoDir, remoteUrl, message } = opts;
  const git = simpleGit(repoDir);

  await git.init();
  await git.addConfig('user.email', 'boogiepop-bootstrap@local');
  await git.addConfig('user.name', 'boogiepop-bootstrap');
  await git.checkoutLocalBranch('main');
  await git.add('.');
  await git.commit(message);
  await git.addRemote('origin', remoteUrl);
  await git.push('origin', 'main', ['--set-upstream']);
}
