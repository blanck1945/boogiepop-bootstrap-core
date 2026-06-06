import type { ProjectType } from '../types';
import { nextAlbPriorities } from './alb-priority';
import { toAlbAbbrev, toPascalCase, toSnakeCase } from './slugify';

export interface ScaffoldVars {
  APP_NAME: string;
  APP_SLUG: string;
  TF_NAME: string;
  MF_SCOPE: string;
  TITLE: string;
  HTTP_PATH: string;
  CONTAINER_PORT: string;
  ALB_PRIORITY_HTTP: string;
  ALB_PRIORITY_HTTPS: string;
  ALB_ABBREV: string;
  /** Máx. 6 caracteres — AWS limita name_prefix en target groups. */
  TG_NAME_PREFIX: string;
  GITHUB_ORG: string;
  ECR_REPO: string;
  ECS_SERVICE: string;
}

export async function buildScaffoldVars(
  appName: string,
  githubOrg: string,
  type: ProjectType,
  terraformDir?: string,
): Promise<ScaffoldVars> {
  const port = type === 'streamlit' ? '8501' : '8080';
  const repoName = appName.startsWith('boogiepop-') ? appName : `boogiepop-${appName}`;

  let albHttp = 1099;
  let albHttps = 1199;
  if (terraformDir) {
    const priorities = await nextAlbPriorities(terraformDir);
    albHttp = priorities.http;
    albHttps = priorities.https;
  }

  return {
    APP_NAME: appName,
    APP_SLUG: repoName,
    TF_NAME: toSnakeCase(appName),
    MF_SCOPE: `${toPascalCase(appName)}Remote`,
    TITLE: appName
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' '),
    HTTP_PATH: appName,
    CONTAINER_PORT: port,
    ALB_PRIORITY_HTTP: String(albHttp),
    ALB_PRIORITY_HTTPS: String(albHttps),
    ALB_ABBREV: toAlbAbbrev(appName),
    TG_NAME_PREFIX: `bp${toAlbAbbrev(appName)}`.slice(0, 6),
    GITHUB_ORG: githubOrg,
    ECR_REPO: repoName,
    ECS_SERVICE: `boogiepop-api-fe-${appName}-svc`,
  };
}

export function scaffoldVarsToRecord(vars: ScaffoldVars): Record<string, string | number> {
  return { ...vars };
}
