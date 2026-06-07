import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { Octokit } from '@octokit/rest';
import { resolveGithubOrg, type GithubOrgConfig } from '../github-orgs';
import type { ProjectType } from '../types';
import { buildAppName, buildRepoName, toSnakeCase } from '../utils/slugify';

export type ProjectNameConflictKind =
  | 'github_repo'
  | 'terraform_scaffold'
  | 'terraform_enabled';

export interface ProjectNameConflict {
  kind: ProjectNameConflictKind;
  message: string;
}

export interface ProjectNameAvailability {
  available: boolean;
  appName: string;
  repoName: string;
  githubOrg: string;
  conflicts: ProjectNameConflict[];
}

export async function checkProjectNameAvailability(opts: {
  name: string;
  type: ProjectType;
  provisionInfra?: boolean;
  token: string;
  orgConfig: GithubOrgConfig;
  terraformDir?: string;
}): Promise<ProjectNameAvailability> {
  const { name, type, token, orgConfig, terraformDir } = opts;
  const provisionInfra = opts.provisionInfra !== false;
  const appName = buildAppName(name);
  const repoName = buildRepoName(appName);
  const githubOrg = resolveGithubOrg(type, orgConfig);
  const tfName = toSnakeCase(appName);
  const conflicts: ProjectNameConflict[] = [];

  const octokit = new Octokit({ auth: token });
  try {
    const { data } = await octokit.repos.get({ owner: githubOrg, repo: repoName });
    // GitHub redirige nombres renombrados; solo bloquear si el repo activo usa ese nombre.
    if (data.name === repoName) {
      conflicts.push({
        kind: 'github_repo',
        message: `El repo github.com/${githubOrg}/${repoName} ya existe`,
      });
    }
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status !== 404) {
      throw err;
    }
  }

  if (provisionInfra && terraformDir) {
    const localsPath = join(terraformDir, `locals_${tfName}.tf`);
    if (existsSync(localsPath)) {
      conflicts.push({
        kind: 'terraform_scaffold',
        message: `Ya hay archivos Terraform para "${appName}" (${localsPath})`,
      });
    }

    const tfvarsPath = join(terraformDir, 'terraform.tfvars');
    if (existsSync(tfvarsPath)) {
      const tfvars = await readFile(tfvarsPath, 'utf8');
      const enableRe = new RegExp(`^enable_${tfName}_ecs\\s*=\\s*true\\b`, 'm');
      if (enableRe.test(tfvars)) {
        conflicts.push({
          kind: 'terraform_enabled',
          message: `enable_${tfName}_ecs = true ya está en terraform.tfvars`,
        });
      }
    }
  }

  return {
    available: conflicts.length === 0,
    appName,
    repoName,
    githubOrg,
    conflicts,
  };
}
