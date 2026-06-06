import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { terraformTemplateType, terraformTemplatesSubdir } from '../infra/terraform-type-map';
import type { ProjectType } from '../types';
import { render } from '../utils/placeholder';
import { getTemplatesDir } from '../utils/templates-dir';

const TF_FILES: Record<string, string[]> = {
  next: ['variables', 'locals', 'ecr', 'ecs', 'alb'],
  'react-mf': ['variables', 'locals', 'ecr', 'ecs', 'alb'],
  streamlit: ['variables', 'locals', 'ecr', 'ecs', 'alb'],
};

/** Siempre S3 + Secrets Manager + IAM con acceso S3 para cada app nueva. */
const STANDARD_APP_FILES = ['s3', 'secrets', 'iam'] as const;

export async function scaffoldTerraform(opts: {
  type: ProjectType;
  tfDir: string;
  vars: Record<string, string | number>;
}): Promise<string[]> {
  const { type, tfDir, vars } = opts;
  const tplType = terraformTemplateType(type);
  const subdir = terraformTemplatesSubdir(type);
  const tplDir = join(getTemplatesDir(), 'terraform', subdir, 'terraform');
  const files = [...(TF_FILES[tplType] ?? TF_FILES.next), ...STANDARD_APP_FILES];

  const written: string[] = [];

  for (const name of files) {
    const tplFile = join(tplDir, `${name}.tf.tpl`);
    const tplContent = await readFile(tplFile, 'utf8');
    const rendered = render(tplContent, vars);
    const leftover = rendered.match(/\{\{[A-Z0-9_]+\}\}/g);
    if (leftover?.length) {
      throw new Error(
        `Plantilla ${name}.tf.tpl tiene placeholders sin reemplazar: ${[...new Set(leftover)].join(', ')}. Rebuild boogiepop-bootstrap-core.`,
      );
    }
    const destFile = join(tfDir, `${name}_${vars.TF_NAME}.tf`);
    await writeFile(destFile, rendered, 'utf8');
    written.push(destFile);
  }

  return written;
}
