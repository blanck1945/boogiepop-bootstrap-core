import type { ProjectType } from '../types';
import type { ScaffoldVars } from '../utils/scaffold-vars';
import { buildAppName, buildTitle, toPascalCase } from '../utils/slugify';

export interface BackendApplicationPayload {
  name: string;
  remoteEntry: string;
  remoteName: string;
  exposedModule: string;
  route: string;
  description?: string;
  kind?: string;
  iframeUrl?: string;
  isActive?: boolean;
  hubVisible?: boolean;
  workspaceIds?: string[];
}

export interface RegisteredApplication {
  id: string;
  name: string;
  route: string;
  hubVisible: boolean;
}

export interface BackendCredentials {
  apiUrl: string;
  adminEmail: string;
  adminPassword: string;
}

function normalizeApiBase(apiUrl: string): string {
  return apiUrl.trim().replace(/\/+$/, '').replace(/\/api$/, '');
}

async function parseApiError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (!body.message) return res.statusText;
    return Array.isArray(body.message) ? body.message.join(', ') : body.message;
  } catch {
    return res.statusText;
  }
}

export function buildBackendApplicationPayload(opts: {
  type: ProjectType;
  vars: ScaffoldVars;
  publicUrl?: string;
  embedUrl?: string;
  hubVisible?: boolean;
}): BackendApplicationPayload {
  const { type, vars, publicUrl, embedUrl } = opts;
  const hubVisible = opts.hubVisible ?? false;
  const route = `/${vars.HTTP_PATH.replace(/^\/+|\/+$/g, '')}`;
  const baseUrl = publicUrl ?? embedUrl?.replace(/\?embed=true$/, '') ?? `https://example.invalid${route}/`;
  const remoteName =
    type === 'vite' ? vars.MF_SCOPE : `${toPascalCase(vars.APP_NAME)}Dashboard`;

  const common = {
    name: vars.TITLE,
    route,
    description: `Boogiepop ${type}: ${vars.TITLE}`,
    isActive: true,
    hubVisible,
    workspaceIds: [] as string[],
  };

  if (type === 'streamlit') {
    return {
      ...common,
      kind: 'streamlit',
      remoteEntry: baseUrl,
      remoteName,
      exposedModule: './App',
      iframeUrl: embedUrl ?? `${baseUrl}?embed=true`,
    };
  }

  if (type === 'next') {
    return {
      ...common,
      kind: 'next',
      remoteEntry: baseUrl,
      remoteName,
      exposedModule: './App',
      iframeUrl: embedUrl ?? `${baseUrl}?embed=true`,
    };
  }

  return {
    ...common,
    kind: 'react-mf',
    remoteEntry: embedUrl ?? `${baseUrl.replace(/\/$/, '')}/remoteEntry.js`,
    remoteName,
    exposedModule: './Shell',
  };
}

export function matchApplicationBySlug(
  apps: RegisteredApplication[],
  rawName: string,
): RegisteredApplication | undefined {
  const appName = buildAppName(rawName);
  const route = `/${appName}`;
  const title = buildTitle(appName);

  return apps.find(
    (a) =>
      a.route === route ||
      a.name === title ||
      a.name.toLowerCase().replace(/\s+/g, '-') === appName,
  );
}

async function loginBackend(
  apiBase: string,
  email: string,
  password: string,
): Promise<string> {
  const res = await fetch(`${apiBase}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`login backend falló (${res.status}): ${await parseApiError(res)}`);
  }
  const data = (await res.json()) as { accessToken?: string };
  if (!data.accessToken) throw new Error('login backend no devolvió accessToken');
  return data.accessToken;
}

async function listApplications(apiBase: string, token: string): Promise<RegisteredApplication[]> {
  const res = await fetch(`${apiBase}/api/applications`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`list applications falló (${res.status}): ${await parseApiError(res)}`);
  }
  return res.json() as Promise<RegisteredApplication[]>;
}

async function createApplication(
  apiBase: string,
  token: string,
  payload: BackendApplicationPayload,
): Promise<RegisteredApplication> {
  const res = await fetch(`${apiBase}/api/applications`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (res.status === 409) {
    const apps = await listApplications(apiBase, token);
    const existing = apps.find((a) => a.name === payload.name);
    if (!existing) {
      throw new Error(`application "${payload.name}" ya existe pero no se pudo resolver el id`);
    }
    return updateApplication(apiBase, token, existing.id, payload);
  }
  if (!res.ok) {
    throw new Error(`POST /applications falló (${res.status}): ${await parseApiError(res)}`);
  }
  return res.json() as Promise<RegisteredApplication>;
}

async function updateApplication(
  apiBase: string,
  token: string,
  id: string,
  payload: Partial<BackendApplicationPayload>,
): Promise<RegisteredApplication> {
  const res = await fetch(`${apiBase}/api/applications/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`PATCH /applications/${id} falló (${res.status}): ${await parseApiError(res)}`);
  }
  return res.json() as Promise<RegisteredApplication>;
}

export async function registerApplicationInBackend(opts: {
  apiUrl: string;
  adminEmail: string;
  adminPassword: string;
  type: ProjectType;
  vars: ScaffoldVars;
  publicUrl?: string;
  embedUrl?: string;
}): Promise<RegisteredApplication> {
  const apiBase = normalizeApiBase(opts.apiUrl);
  const payload = buildBackendApplicationPayload({
    type: opts.type,
    vars: opts.vars,
    publicUrl: opts.publicUrl,
    embedUrl: opts.embedUrl,
    hubVisible: false,
  });
  const token = await loginBackend(apiBase, opts.adminEmail, opts.adminPassword);
  return createApplication(apiBase, token, payload);
}

export async function setApplicationHubVisibility(opts: {
  credentials: BackendCredentials;
  appName: string;
  hubVisible: boolean;
}): Promise<RegisteredApplication> {
  const apiBase = normalizeApiBase(opts.credentials.apiUrl);
  const slug = buildAppName(opts.appName);
  const token = await loginBackend(
    apiBase,
    opts.credentials.adminEmail,
    opts.credentials.adminPassword,
  );
  const apps = await listApplications(apiBase, token);
  const existing = matchApplicationBySlug(apps, slug);
  if (!existing) {
    throw new Error(
      `No hay application registrada para "${slug}" (buscá route /${slug} o título "${buildTitle(slug)}")`,
    );
  }
  return updateApplication(apiBase, token, existing.id, { hubVisible: opts.hubVisible });
}
