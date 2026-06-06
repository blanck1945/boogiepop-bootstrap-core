import type { ProjectType } from './types';

/** Valores por defecto (prod). En local usar personal vía env en el MS. */
export const DEFAULT_BOOGIEPOP_GITHUB_ORG = 'boogiepop';
export const DEFAULT_REMOTES_GITHUB_ORG = 'remotes';

export interface GithubOrgConfig {
  boogiepop: string;
  remotes: string;
}

export const DEFAULT_ORG_CONFIG: GithubOrgConfig = {
  boogiepop: DEFAULT_BOOGIEPOP_GITHUB_ORG,
  remotes: DEFAULT_REMOTES_GITHUB_ORG,
};

export function resolveGithubOrg(
  type: ProjectType,
  config: GithubOrgConfig = DEFAULT_ORG_CONFIG,
): string {
  return type === 'next' ? config.boogiepop : config.remotes;
}

export function orgConfigFromEnv(env: {
  boogiepop?: string;
  remotes?: string;
}): GithubOrgConfig {
  return {
    boogiepop: env.boogiepop?.trim() || DEFAULT_BOOGIEPOP_GITHUB_ORG,
    remotes: env.remotes?.trim() || DEFAULT_REMOTES_GITHUB_ORG,
  };
}
