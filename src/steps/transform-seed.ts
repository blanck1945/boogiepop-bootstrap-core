import { mkdir, readFile, readdir, rm, stat, unlink, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { SEED_PACKAGE_NAMES, WORKFLOW_TEMPLATE_FILES } from '../seed-urls';
import { normalizeBoogiepopNpmDeps } from '../npm-deps';
import type { ProjectType } from '../types';
import { render } from '../utils/placeholder';
import { scaffoldVarsToRecord, type ScaffoldVars } from '../utils/scaffold-vars';
import { getTemplatesDir } from '../utils/templates-dir';

const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  '.next',
  'dist',
  '.venv',
  '__pycache__',
  '.husky',
]);

const SKIP_FILES = new Set(['package-lock.json']);

const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.eot',
]);

async function walk(dir: string, files: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walk(full, files);
    } else {
      files.push(full);
    }
  }
  return files;
}

function isTextFile(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  return !BINARY_EXT.has(ext);
}

function applyReplacements(content: string, seedName: string, repoName: string, appName: string): string {
  const seedSlug = seedName.replace(/^boogiepop-/, '');
  let out = content;

  const pairs: Array<[string, string]> = [
    [seedName, repoName],
    [seedSlug, appName],
    [`boogiepop-${seedSlug}`, repoName],
  ];

  for (const [from, to] of pairs) {
    if (from && from !== to) {
      out = out.split(from).join(to);
    }
  }

  return out;
}

async function writeDeployWorkflow(repoDir: string, type: ProjectType, vars: ScaffoldVars): Promise<void> {
  const templatesDir = getTemplatesDir();
  const tplName = WORKFLOW_TEMPLATE_FILES[type];
  const tplPath = join(templatesDir, 'workflows', tplName);
  const tplContent = await readFile(tplPath, 'utf8');
  const rendered = render(tplContent, scaffoldVarsToRecord(vars));

  const wfDir = join(repoDir, '.github', 'workflows');
  await rm(wfDir, { recursive: true, force: true });
  await mkdir(wfDir, { recursive: true });
  await writeFile(join(wfDir, 'deploy.yml'), rendered, 'utf8');
}

export async function transformSeed(opts: {
  repoDir: string;
  type: ProjectType;
  appName: string;
  repoName: string;
  vars: ScaffoldVars;
}): Promise<void> {
  const { repoDir, type, appName, repoName, vars } = opts;
  const seedName = SEED_PACKAGE_NAMES[type];
  const files = await walk(repoDir);

  for (const filePath of files) {
    const rel = filePath.slice(repoDir.length + 1).replace(/\\/g, '/');
    if (SKIP_FILES.has(rel.split('/').pop() ?? '')) continue;

    const st = await stat(filePath);
    if (st.size > 500_000 || !isTextFile(filePath)) continue;

    const raw = await readFile(filePath, 'utf8');
    const updated = applyReplacements(raw, seedName, repoName, appName);
    if (updated !== raw) {
      await writeFile(filePath, updated, 'utf8');
    }
  }

  await writeDeployWorkflow(repoDir, type, vars);

  const viteConfigPath = join(repoDir, 'vite.config.ts');
  try {
    let viteCfg = await readFile(viteConfigPath, 'utf8');
    const mfNameRe = /name:\s*['"]boogiepopRemote['"]/;
    if (mfNameRe.test(viteCfg)) {
      viteCfg = viteCfg.replace(mfNameRe, `name: '${vars.MF_SCOPE}'`);
      await writeFile(viteConfigPath, viteCfg, 'utf8');
    }
  } catch {
    /* vite.config opcional */
  }

  if (type === 'vite') {
    const authPath = join(repoDir, 'src', 'components', 'AuthPlaceholder.tsx');
    try {
      let authSrc = await readFile(authPath, 'utf8');
      const brokenRoles = /snapshot\.roles\.map\(\(r\) => r\.name\)/;
      if (brokenRoles.test(authSrc)) {
        authSrc = authSrc.replace(
          brokenRoles,
          'snapshot.roles.join',
        ).replace(
          /\.join\(\(r\) => r\.name\)\.join\(', '\)/,
          ".join(', ')",
        );
        if (authSrc.includes('r.name')) {
          authSrc = authSrc.replace(
            /const roleLabel = snapshot\.roles\.length > 0 \? snapshot\.roles\.map\(\(r\) => r\.name\)\.join\(', '\) : 'sin roles'/,
            "const roleLabel = snapshot.roles.length > 0 ? snapshot.roles.join(', ') : 'sin roles'",
          );
        }
        await writeFile(authPath, authSrc, 'utf8');
      }
    } catch {
      /* AuthPlaceholder opcional */
    }
  }

  if (type === 'next') {
    const dockerTpl = await readFile(
      join(getTemplatesDir(), 'dockerfiles', 'next.Dockerfile.tpl'),
      'utf8',
    );
    await writeFile(join(repoDir, 'Dockerfile'), render(dockerTpl, scaffoldVarsToRecord(vars)), 'utf8');
  }

  if (type === 'vite') {
    const dockerTpl = await readFile(
      join(getTemplatesDir(), 'dockerfiles', 'vite.Dockerfile.tpl'),
      'utf8',
    );
    await writeFile(join(repoDir, 'Dockerfile'), render(dockerTpl, scaffoldVarsToRecord(vars)), 'utf8');

    const nginxTpl = await readFile(
      join(getTemplatesDir(), 'nginx', 'vite.nginx.conf.tpl'),
      'utf8',
    );
    await writeFile(join(repoDir, 'nginx.conf'), nginxTpl, 'utf8');
  }

  const pkgPath = join(repoDir, 'package.json');
  try {
    const pkgRaw = await readFile(pkgPath, 'utf8');
    const pkg = JSON.parse(pkgRaw) as { name?: string; dependencies?: Record<string, string> };
    pkg.name = repoName;
    if (type === 'next' || type === 'vite') {
      pkg.dependencies = normalizeBoogiepopNpmDeps(pkg.dependencies);
      await unlink(join(repoDir, 'package-lock.json')).catch(() => undefined);
    }
    await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  } catch {
    // streamlit no tiene package.json en la raíz
  }
}

export async function cleanupRepoArtifacts(repoDir: string): Promise<void> {
  for (const name of SKIP_DIRS) {
    await rm(join(repoDir, name), { recursive: true, force: true });
  }
}
