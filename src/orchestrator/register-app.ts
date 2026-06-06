import { existsSync } from 'fs';
import { join } from 'path';
import { resolveGithubOrg } from '../github-orgs';
import {
  registerApplicationInBackend,
  setApplicationHubVisibility,
  type BackendCredentials,
  type RegisteredApplication,
} from '../steps/register-application';
import { resolveAppPublicUrls } from '../utils/app-public-url';
import { detectProjectType } from '../utils/detect-project-type';
import { buildScaffoldVars } from '../utils/scaffold-vars';
import type { GithubOrgConfig } from '../github-orgs';
import type { ProjectType } from '../types';
import { buildAppName, toSnakeCase } from '../utils/slugify';

export async function registerProjectApplication(opts: {
  name: string;
  type: ProjectType;
  terraformDir: string;
  orgConfig: GithubOrgConfig;
  credentials: BackendCredentials;
  projectDir?: string;
}): Promise<RegisteredApplication & { appPublicUrl?: string; appEmbedUrl?: string }> {
  const appName = buildAppName(opts.name);
  const localsPath = join(opts.terraformDir, `locals_${toSnakeCase(appName)}.tf`);

  if (!existsSync(localsPath)) {
    throw new Error(
      `No hay infra Terraform para "${appName}" (${localsPath}). Corré boogiepop new con Infra: Yes primero.`,
    );
  }

  const githubOrg = resolveGithubOrg(opts.type, opts.orgConfig);
  const vars = await buildScaffoldVars(appName, githubOrg, opts.type, opts.terraformDir);
  const urls = await resolveAppPublicUrls({
    terraformDir: opts.terraformDir,
    httpPath: vars.HTTP_PATH,
    type: opts.type,
  });

  if (!urls.publicUrl && !urls.embedUrl) {
    throw new Error('No se pudieron resolver URLs públicas desde terraform.tfvars');
  }

  const app = await registerApplicationInBackend({
    apiUrl: opts.credentials.apiUrl,
    adminEmail: opts.credentials.adminEmail,
    adminPassword: opts.credentials.adminPassword,
    type: opts.type,
    vars,
    publicUrl: urls.publicUrl,
    embedUrl: urls.embedUrl,
  });

  return { ...app, appPublicUrl: urls.publicUrl, appEmbedUrl: urls.embedUrl };
}

export async function inferProjectType(opts: {
  name: string;
  type?: ProjectType;
  projectDir?: string;
}): Promise<ProjectType> {
  if (opts.type) return opts.type;

  const dir = opts.projectDir ?? process.cwd();
  const detected = await detectProjectType(dir);
  if (detected) return detected;

  throw new Error(
    'No se pudo inferir el tipo (streamlit/vite/next). Pasá --type explícitamente.',
  );
}

export async function publishProjectApplication(opts: {
  name: string;
  hubVisible: boolean;
  credentials: BackendCredentials;
}): Promise<RegisteredApplication> {
  return setApplicationHubVisibility({
    credentials: opts.credentials,
    appName: opts.name,
    hubVisible: opts.hubVisible,
  });
}
