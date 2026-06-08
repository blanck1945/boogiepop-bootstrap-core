import { readFile, writeFile } from 'fs/promises';

export async function updateTfvars(opts: {
  tfvarsPath: string;
  tfName: string;
  enabled?: boolean;
}): Promise<void> {
  const { tfvarsPath, tfName, enabled = true } = opts;
  const enableKey = `enable_${tfName}_ecs`;
  const enableLine = `${enableKey} = ${enabled ? 'true' : 'false'}`;
  const envKey = `${tfName}_app_env`;
  const envLine = `${envKey} = {}`;

  let content = await readFile(tfvarsPath, 'utf8');

  const enableRe = new RegExp(String.raw`^${enableKey}\s*=\s*.*$`, 'm');
  if (enableRe.test(content)) {
    content = content.replace(enableRe, enableLine);
  } else {
    content = `${content.trimEnd()}\n${enableLine}\n`;
  }

  // Usa String.raw para evitar doble-escape en la construcción dinámica.
  // Matchea el bloque completo {...} (multilínea) o una línea simple.
  const envRe = new RegExp(String.raw`^${envKey}\s*=\s*(?:\{[^{}]*\}|[^\n]*)`, 'm');
  if (envRe.test(content)) {
    content = content.replace(envRe, envLine);
  } else {
    content = `${content.trimEnd()}\n${envLine}\n`;
  }

  await writeFile(tfvarsPath, content, 'utf8');
}
