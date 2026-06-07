import type { GithubOrgConfig } from './github-orgs';

export type ProjectType = 'next' | 'vite' | 'streamlit';

export type GitHubPermission = 'admin' | 'write' | 'read';

export type EmitStatus = 'running' | 'ok' | 'error' | 'warn';

export type EmitFn = (step: string, status: EmitStatus, detail?: string) => void;

export interface ProjectMember {
  identifier: string;
  role: GitHubPermission;
}

export interface ProjectBootstrapInput {
  name: string;
  type: ProjectType;
  visibility?: 'public' | 'private';
  members?: ProjectMember[];
  /** Genera Terraform y corre apply antes de crear el repo (default true). */
  provisionInfra?: boolean;
}

/** @deprecated Use ProjectBootstrapInput */
export type GitHubBootstrapInput = ProjectBootstrapInput;

export interface ProjectBootstrapResult {
  repoName: string;
  owner: string;
  htmlUrl: string;
  cloneUrl: string;
  cloneUrlAuthed?: string;
  appName: string;
  type: ProjectType;
  githubOrg: string;
  infraApplied: boolean;
  albPath?: string;
  ecsService?: string;
  ecrRepository?: string;
  /** URL pública tras deploy (HTTPS o ALB). */
  appPublicUrl?: string;
  /** Streamlit hub embed o vite remoteEntry. */
  appEmbedUrl?: string;
  /** UUID en tabla applications (backend). */
  applicationId?: string;
  /** App pública sin workspaces; oculta en manifest del hub. */
  applicationHubVisible?: boolean;
  /** Resultado del workflow deploy.yml tras push a main. */
  deployStatus?: 'success' | 'failure' | 'timeout';
  deployRunUrl?: string;
  /** HEAD/GET OK en appEmbedUrl o appPublicUrl tras deploy exitoso. */
  liveUrlVerified?: boolean;
  /** ISO timestamp del push inicial a main (para polling CI desde la CLI). */
  pushedAt?: string;
}

/** @deprecated Use ProjectBootstrapResult */
export type GitHubBootstrapResult = ProjectBootstrapResult;

export interface GitHubOrgOption {
  login: string;
  avatarUrl?: string;
  kind: 'org' | 'user';
}

export interface ProjectBootstrapContext {
  token: string;
  emit: EmitFn;
  workDir?: string;
  orgConfig?: GithubOrgConfig;
  /** Ruta absoluta a boogiepop-infra/terraform */
  terraformDir?: string;
  /** Base del backend Nest, ej. http://localhost:3000 o https://boogiepop.cloud */
  backendApiUrl?: string;
  backendAdminEmail?: string;
  backendAdminPassword?: string;
}

/** @deprecated Use ProjectBootstrapContext */
export type GitHubBootstrapContext = ProjectBootstrapContext;
