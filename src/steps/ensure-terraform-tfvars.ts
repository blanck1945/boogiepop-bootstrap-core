import { access, writeFile } from 'fs/promises';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

export async function ensureTerraformTfvars(tfvarsPath: string): Promise<void> {
  try {
    await access(tfvarsPath);
    return;
  } catch {
    /* missing — seed from Secrets Manager */
  }

  const secretId = process.env.BOOTSTRAP_TFVARS_SECRET?.trim();
  if (!secretId) {
    throw new Error(
      `Falta ${tfvarsPath} y BOOTSTRAP_TFVARS_SECRET no está configurado en el Bootstrap MS`,
    );
  }

  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1',
  });
  const out = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
  if (!out.SecretString) {
    throw new Error(`Secret ${secretId} no tiene SecretString`);
  }

  await writeFile(tfvarsPath, out.SecretString, 'utf8');
}
