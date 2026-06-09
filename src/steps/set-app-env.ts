import { readFile, writeFile } from 'fs/promises';
import { spawn } from 'child_process';

function parseHclMap(content: string, tfName: string): Record<string, string> {
  const envKey = `${tfName}_app_env`;
  const re = new RegExp(String.raw`^${envKey}\s*=\s*\{([^{}]*)\}`, 'm');
  const match = content.match(re);
  if (!match) return {};
  const result: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^\s*(\w+)\s*=\s*"(.*)"\s*$/);
    if (m) result[m[1]] = m[2];
  }
  return result;
}

function renderHclBlock(tfName: string, vars: Record<string, string>): string {
  const envKey = `${tfName}_app_env`;
  const entries = Object.entries(vars);
  if (entries.length === 0) return `${envKey} = {}`;
  const maxLen = Math.max(...entries.map(([k]) => k.length));
  const lines = entries.map(([k, v]) => `  ${k.padEnd(maxLen)} = "${v}"`).join('\n');
  return `${envKey} = {\n${lines}\n}`;
}

export async function mergeAppEnvVars(
  tfvarsPath: string,
  tfName: string,
  newVars: Record<string, string>,
): Promise<Record<string, string>> {
  let content = await readFile(tfvarsPath, 'utf8');
  const current = parseHclMap(content, tfName);
  const merged = { ...current, ...newVars };

  const envKey = `${tfName}_app_env`;
  const envRe = new RegExp(String.raw`^${envKey}\s*=\s*(?:\{[^{}]*\}|[^\n]*)`, 'm');
  const newBlock = renderHclBlock(tfName, merged);

  content = envRe.test(content)
    ? content.replace(envRe, newBlock)
    : `${content.trimEnd()}\n${newBlock}\n`;

  await writeFile(tfvarsPath, content, 'utf8');
  return merged;
}

export function readAppEnvVars(
  tfvarsPath: string,
  tfName: string,
): Promise<Record<string, string>> {
  return readFile(tfvarsPath, 'utf8').then((c) => parseHclMap(c, tfName));
}

function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
  onLine?: (l: string) => void,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      shell: process.platform === 'win32',
      env: process.env,
    });
    const fwd = (buf: Buffer) => {
      for (const line of buf.toString().split(/\r?\n/)) {
        if (line.trim()) onLine?.(line);
      }
    };
    child.stdout?.on('data', fwd);
    child.stderr?.on('data', fwd);
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

export async function runTerraformApplySecret(opts: {
  tfDir: string;
  tfName: string;
  onOutput?: (line: string) => void;
}): Promise<void> {
  const { tfDir, tfName, onOutput } = opts;
  const errTail: string[] = [];
  const capture = (line: string) => {
    onOutput?.(line);
    if (/Error:|error:|╷|│/.test(line)) {
      errTail.push(line);
      if (errTail.length > 10) errTail.shift();
    }
  };

  const initCode = await runCommand('terraform', ['init', '-input=false'], tfDir, capture);
  if (initCode !== 0) throw new Error(`terraform init falló (${initCode})${errTail.length ? '\n' + errTail.join('\n') : ''}`);

  const targets = [
    `aws_secretsmanager_secret_version.${tfName}`,
    `aws_ecs_task_definition.${tfName}`,
    `aws_ecs_service.${tfName}`,
  ];
  const applyArgs = ['apply', '-auto-approve', '-input=false', ...targets.flatMap((t) => ['-target', t])];
  const applyCode = await runCommand('terraform', applyArgs, tfDir, capture);
  if (applyCode !== 0) throw new Error(`terraform apply falló (${applyCode})${errTail.length ? '\n' + errTail.join('\n') : ''}`);
}
