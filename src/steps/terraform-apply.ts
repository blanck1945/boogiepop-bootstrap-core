import { spawn } from 'child_process';

function runCommand(
  command: string,
  args: string[],
  cwd: string,
  onLine?: (line: string) => void,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: process.platform === 'win32',
      env: process.env,
    });

    const forward = (chunk: Buffer) => {
      const text = chunk.toString();
      for (const line of text.split(/\r?\n/)) {
        if (line.trim()) onLine?.(line);
      }
    };

    child.stdout?.on('data', forward);
    child.stderr?.on('data', forward);
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

/** Recursos estándar por app: ECS + ALB + ECR + S3 + Secrets Manager. */
export function buildTerraformApplyTargets(tfName: string): string[] {
  const t = tfName;
  return [
    `aws_ecr_repository.${t}`,
    `aws_ecr_lifecycle_policy.${t}`,
    `aws_cloudwatch_log_group.${t}`,
    `aws_iam_role.${t}_task`,
    `aws_iam_role_policy.${t}_s3`,
    `aws_s3_bucket.${t}`,
    `aws_s3_bucket_versioning.${t}`,
    `aws_s3_bucket_server_side_encryption_configuration.${t}`,
    `aws_s3_bucket_public_access_block.${t}`,
    `aws_secretsmanager_secret.${t}`,
    `aws_secretsmanager_secret_version.${t}`,
    `aws_iam_role_policy.ecs_execution_${t}_secret`,
    `aws_lb_target_group.${t}`,
    `aws_lb_listener_rule.http_${t}`,
    `aws_lb_listener_rule.https_${t}`,
    `aws_ecs_task_definition.${t}`,
    `aws_ecs_service.${t}`,
  ];
}

/** Tras destroy parcial el secret puede existir fuera del state; import o restore antes del apply. */
async function prepareAppSecretForTerraform(
  tfDir: string,
  tfName: string,
  onLine?: (line: string) => void,
): Promise<void> {
  const appName = tfName.replace(/_/g, '-');
  const secretName = `boogiepop-api-${appName}-secrets`;
  const stateAddress = `aws_secretsmanager_secret.${tfName}[0]`;
  const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1';

  let arn: string | undefined;
  let deletedDate: string | undefined;
  try {
    const { execFileSync } = await import('child_process');
    const raw = execFileSync(
      'aws',
      [
        'secretsmanager',
        'describe-secret',
        '--secret-id',
        secretName,
        '--region',
        region,
        '--output',
        'json',
      ],
      { encoding: 'utf8' },
    );
    const parsed = JSON.parse(raw) as { ARN?: string; DeletedDate?: string };
    arn = parsed.ARN;
    deletedDate = parsed.DeletedDate;
  } catch {
    return;
  }

  if (deletedDate) {
    await runCommand(
      'aws',
      ['secretsmanager', 'restore-secret', '--secret-id', secretName, '--region', region],
      tfDir,
      onLine,
    );
    return;
  }

  if (!arn) return;

  let inState = false;
  try {
    const { execFileSync } = await import('child_process');
    const stateList = execFileSync('terraform', ['state', 'list'], {
      cwd: tfDir,
      encoding: 'utf8',
    });
    inState = stateList.split(/\r?\n/).some((line) => line.trim() === stateAddress);
  } catch {
    return;
  }

  if (inState) return;

  onLine?.(`Importando secret existente ${secretName} al state de Terraform…`);
  const importCode = await runCommand(
    'terraform',
    ['import', '-input=false', stateAddress, arn],
    tfDir,
    onLine,
  );
  if (importCode !== 0) {
    throw new Error(`terraform import del secret ${secretName} falló (código ${importCode})`);
  }
}

export async function runTerraformApply(opts: {
  tfDir: string;
  tfName: string;
  onOutput?: (line: string) => void;
}): Promise<void> {
  const { tfDir, tfName, onOutput } = opts;
  const errTail: string[] = [];
  const captureErr = (line: string) => {
    onOutput?.(line);
    if (/Error:|error:|╷|│/.test(line) || line.includes('Invalid ')) {
      errTail.push(line);
      if (errTail.length > 12) errTail.shift();
    }
  };

  await prepareAppSecretForTerraform(tfDir, tfName, captureErr);

  const initCode = await runCommand('terraform', ['init', '-input=false'], tfDir, captureErr);
  if (initCode !== 0) {
    const detail = errTail.length ? `\n${errTail.join('\n')}` : '';
    throw new Error(`terraform init falló (código ${initCode})${detail}`);
  }

  const targets = buildTerraformApplyTargets(tfName);
  const applyArgs = [
    'apply',
    '-auto-approve',
    '-input=false',
    ...targets.flatMap((target) => ['-target', target]),
  ];

  const applyCode = await runCommand('terraform', applyArgs, tfDir, captureErr);
  if (applyCode !== 0) {
    const detail = errTail.length ? `\n${errTail.join('\n')}` : '';
    throw new Error(`terraform apply falló (código ${applyCode})${detail}`);
  }
}
