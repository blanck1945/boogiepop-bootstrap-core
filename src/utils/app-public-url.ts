import { execFileSync } from 'child_process';
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { ProjectType } from '../types';

function parseTfvarString(content: string, key: string): string | undefined {
  const m = content.match(new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, 'm'));
  return m?.[1]?.trim();
}

function parseTfvarBool(content: string, key: string, defaultVal: boolean): boolean {
  const m = content.match(new RegExp(`^${key}\\s*=\\s*(true|false)`, 'm'));
  if (!m) return defaultVal;
  return m[1] === 'true';
}

function normalizeBasePath(httpPath: string): string {
  const slug = httpPath.replace(/^\/+|\/+$/g, '');
  return `/${slug}/`;
}

export async function resolveAppPublicUrls(opts: {
  terraformDir: string;
  httpPath: string;
  type: ProjectType;
}): Promise<{ publicUrl?: string; embedUrl?: string }> {
  const tfvarsPath = join(opts.terraformDir, 'terraform.tfvars');
  let content: string;
  try {
    content = await readFile(tfvarsPath, 'utf8');
  } catch {
    return {};
  }

  const basePath = normalizeBasePath(opts.httpPath);
  const https = parseTfvarBool(content, 'enable_https', false);
  const domain = parseTfvarString(content, 'frontend_host_domain');

  let origin: string | undefined;
  if (https && domain) {
    origin = `https://${domain}`;
  } else {
    try {
      const alb = execFileSync('terraform', ['output', '-raw', 'alb_dns_name'], {
        cwd: opts.terraformDir,
        encoding: 'utf8',
      }).trim();
      if (alb) origin = `http://${alb}`;
    } catch {
      return {};
    }
  }

  if (!origin) return {};

  const publicUrl = `${origin}${basePath}`;
  if (opts.type === 'streamlit') {
    return { publicUrl, embedUrl: `${publicUrl}?embed=true` };
  }
  if (opts.type === 'vite') {
    return { publicUrl, embedUrl: `${origin}${basePath}remoteEntry.js` };
  }
  return { publicUrl };
}
