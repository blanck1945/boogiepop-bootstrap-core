import { existsSync } from 'fs';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { resolveGithubOrg } from '../github-orgs';
import {
  addGithubCollaborators,
  createGithubRepo,
  resolveGithubUsername,
} from '../steps/github';
import { cloneSeed, initAndPushRepo } from '../steps/git';
import { lockProjectDeps } from '../steps/lock-project-deps';
import { waitForGithubDeploy } from '../steps/wait-github-deploy';
import { waitForLiveUrl } from '../steps/wait-live-url';
import { runTerraformApply } from '../steps/terraform-apply';
import { registerApplicationInBackend } from '../steps/register-application';
import { scaffoldTerraform } from '../steps/scaffold-terraform';
import { cleanupRepoArtifacts, transformSeed } from '../steps/transform-seed';
import { updateTfvars } from '../steps/update-tfvars';
import { ensureTerraformTfvars } from '../steps/ensure-terraform-tfvars';
import type {
  ProjectBootstrapContext,
  ProjectBootstrapInput,
  ProjectBootstrapResult,
} from '../types';
import { buildAuthedHttpsUrl } from '../utils/github-url';
import { resolveAppPublicUrls } from '../utils/app-public-url';
import { buildScaffoldVars, scaffoldVarsToRecord } from '../utils/scaffold-vars';
import { buildAppName, buildRepoName, buildTitle } from '../utils/slugify';

const TYPE_LABELS: Record<string, string> = {
  next: 'Next.js',
  vite: 'Vite (remote MF)',
  streamlit: 'Streamlit',
};

export async function runProjectBootstrap(
  input: ProjectBootstrapInput,
  ctx: ProjectBootstrapContext,
): Promise<ProjectBootstrapResult> {
  const { token, emit, workDir: providedWorkDir, terraformDir } = ctx;
  const provisionInfra = input.provisionInfra !== false;

  const appName = buildAppName(input.name);
  const repoName = buildRepoName(appName);
  const githubOrg = resolveGithubOrg(input.type, ctx.orgConfig);
  const title = buildTitle(appName);
  const typeLabel = TYPE_LABELS[input.type] ?? input.type;

  let workDir = providedWorkDir;
  let ownsWorkDir = false;
  let infraApplied = false;
  let appPublicUrl: string | undefined;
  let appEmbedUrl: string | undefined;
  let applicationId: string | undefined;
  let applicationHubVisible: boolean | undefined;
  let deployStatus: 'success' | 'failure' | 'timeout' | undefined;
  let deployRunUrl: string | undefined;
  let liveUrlVerified: boolean | undefined;

  if (!workDir) {
    workDir = await mkdtemp(join(tmpdir(), 'bp-bootstrap-'));
    ownsWorkDir = true;
  }

  try {
    emit('Validar configuración', 'running');
    if (!token) throw new Error('GITHUB_TOKEN no configurado');
    if (provisionInfra) {
      if (!terraformDir) {
        throw new Error('INFRA_TERRAFORM_DIR no configurado en el Bootstrap MS');
      }
      if (!existsSync(terraformDir)) {
        throw new Error(`Directorio Terraform inexistente: ${terraformDir}`);
      }
    }
    emit('Validar configuración', 'ok', `org destino: ${githubOrg}`);

    const vars = await buildScaffoldVars(
      appName,
      githubOrg,
      input.type,
      provisionInfra ? terraformDir : undefined,
    );

    if (provisionInfra && terraformDir) {
      emit('Generar Terraform', 'running', appName);
      await scaffoldTerraform({
        type: input.type,
        tfDir: terraformDir,
        vars: scaffoldVarsToRecord(vars),
      });
      emit('Generar Terraform', 'ok', `locals_${vars.TF_NAME}.tf …`);

      emit('Actualizar terraform.tfvars', 'running');
      const tfvarsPath = join(terraformDir, 'terraform.tfvars');
      await ensureTerraformTfvars(tfvarsPath);
      await updateTfvars({
        tfvarsPath,
        tfName: vars.TF_NAME,
        enabled: true,
      });
      emit('Actualizar terraform.tfvars', 'ok', `enable_${vars.TF_NAME}_ecs = true`);

      emit('Terraform apply', 'running', 'puede tardar varios minutos');
      await runTerraformApply({
        tfDir: terraformDir,
        tfName: vars.TF_NAME,
        onOutput: (line) => {
          if (line.includes('Apply complete') || line.includes('Creating')) {
            emit('Terraform apply', 'running', line.slice(0, 120));
          }
        },
      });
      infraApplied = true;
      const urls = await resolveAppPublicUrls({
        terraformDir,
        httpPath: vars.HTTP_PATH,
        type: input.type,
      });
      appPublicUrl = urls.publicUrl;
      appEmbedUrl = urls.embedUrl;
      emit(
        'Terraform apply',
        'ok',
        appPublicUrl
          ? `${appPublicUrl} · ECS ${vars.ECS_SERVICE} · ECR ${vars.ECR_REPO}`
          : `ALB /${vars.HTTP_PATH}/ · ECS ${vars.ECS_SERVICE} · S3 · Secrets`,
      );
    } else if (terraformDir && existsSync(join(terraformDir, `locals_${vars.TF_NAME}.tf`))) {
      const urls = await resolveAppPublicUrls({
        terraformDir,
        httpPath: vars.HTTP_PATH,
        type: input.type,
      });
      appPublicUrl = urls.publicUrl;
      appEmbedUrl = urls.embedUrl;
    }

    emit(`Crear repo GitHub ${githubOrg}/${repoName}`, 'running');
    let owner: string;
    let htmlUrl: string;
    let cloneUrl: string;

    try {
      const repo = await createGithubRepo({
        org: githubOrg,
        repoName,
        description: `Boogiepop ${typeLabel}: ${title}`,
        token,
        visibility: input.visibility,
      });
      owner = repo.owner;
      htmlUrl = repo.htmlUrl;
      cloneUrl = repo.cloneUrl;
      emit(`Crear repo GitHub ${githubOrg}/${repoName}`, 'ok', htmlUrl);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 422) {
        owner = githubOrg;
        htmlUrl = `https://github.com/${githubOrg}/${repoName}`;
        cloneUrl = `https://github.com/${githubOrg}/${repoName}.git`;
        emit(`Crear repo GitHub ${githubOrg}/${repoName}`, 'ok', 'repo ya existía, continuando');
      } else {
        throw err;
      }
    }

    emit('Clonar seed', 'running', input.type);
    const repoDir = await cloneSeed({ type: input.type, workDir });
    emit('Clonar seed', 'ok');

    emit('Transformar código', 'running');
    await transformSeed({ repoDir, type: input.type, appName, repoName, vars });
    await cleanupRepoArtifacts(repoDir);
    emit('Transformar código', 'ok');

    if (input.type === 'next' || input.type === 'vite') {
      emit('Generar package-lock.json', 'running');
      await lockProjectDeps(repoDir, input.type);
      emit('Generar package-lock.json', 'ok');
    }

    emit('Push inicial a GitHub', 'running');
    const pushStartedAt = new Date();
    const authedRemote = buildAuthedHttpsUrl(cloneUrl, token);
    await initAndPushRepo({
      repoDir,
      remoteUrl: authedRemote,
      message: `chore: bootstrap from ${input.type} seed`,
    });
    emit('Push inicial a GitHub', 'ok', 'main');

    if (infraApplied) {
      emit('Deploy GitHub Actions', 'running', 'esperando workflow en main…');
      const deploy = await waitForGithubDeploy({
        owner,
        repo: repoName,
        token,
        startedAfter: pushStartedAt,
        onProgress: (detail) => emit('Deploy GitHub Actions', 'running', detail),
      });

      deployRunUrl = deploy.htmlUrl;
      deployStatus = deploy.status;

      if (deploy.status === 'success') {
        emit('Deploy GitHub Actions', 'ok', deploy.htmlUrl ?? 'success');
      } else {
        const detail =
          deploy.status === 'timeout'
            ? 'timeout esperando CI (revisá Actions manualmente)'
            : `${deploy.conclusion ?? 'failure'}${deploy.htmlUrl ? ` · ${deploy.htmlUrl}` : ''}`;
        emit('Deploy GitHub Actions', 'warn', detail);
      }

      const checkUrl = appEmbedUrl ?? appPublicUrl;
      if (checkUrl && deploy.status === 'success') {
        emit('Verificar URL en producción', 'running', checkUrl);
        liveUrlVerified = await waitForLiveUrl(checkUrl);
        if (liveUrlVerified) {
          emit('Verificar URL en producción', 'ok', checkUrl);
        } else {
          emit(
            'Verificar URL en producción',
            'warn',
            'URL aún no responde (ECS puede estar arrancando)',
          );
        }
      }
    }

    if (ctx.backendApiUrl && ctx.backendAdminEmail && ctx.backendAdminPassword) {
      if (!appPublicUrl && !appEmbedUrl) {
        emit(
          'Registrar app en backend',
          'ok',
          'omitido — sin URLs de infra (Terraform no aplicado)',
        );
      } else {
        emit('Registrar app en backend', 'running', 'pública · oculta en hub');
        try {
          const app = await registerApplicationInBackend({
            apiUrl: ctx.backendApiUrl,
            adminEmail: ctx.backendAdminEmail,
            adminPassword: ctx.backendAdminPassword,
            type: input.type,
            vars,
            publicUrl: appPublicUrl,
            embedUrl: appEmbedUrl,
          });
          applicationId = app.id;
          applicationHubVisible = app.hubVisible;
          emit(
            'Registrar app en backend',
            'ok',
            `${app.name} · id ${app.id.slice(0, 8)}… · hubVisible=false`,
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          throw new Error(`Registrar app en backend falló: ${message}`);
        }
      }
    } else {
      emit(
        'Registrar app en backend',
        'ok',
        'omitido — configurá BOOGIEPOP_API_URL + BOOGIEPOP_ADMIN_* en el Bootstrap MS',
      );
    }

    const members = input.members ?? [];
    if (members.length > 0) {
      emit('Agregar colaboradores', 'running', `${members.length} miembro(s)`);
      const resolved: Array<{ username: string; role: string }> = [];

      for (const m of members) {
        const username = await resolveGithubUsername(token, m.identifier);
        if (!username) {
          emit('Agregar colaboradores', 'running', `no se encontró: ${m.identifier}`);
          continue;
        }
        resolved.push({ username, role: m.role });
      }

      const results = await addGithubCollaborators({
        owner,
        repoName,
        token,
        members: resolved,
      });

      const failed = results.filter((r) => !r.ok);
      if (failed.length) {
        emit(
          'Agregar colaboradores',
          'ok',
          `${results.length - failed.length} ok, ${failed.length} con warning`,
        );
      } else {
        emit('Agregar colaboradores', 'ok', `${results.length} miembro(s)`);
      }
    }

    return {
      repoName,
      owner,
      htmlUrl,
      cloneUrl,
      cloneUrlAuthed: authedRemote,
      appName,
      type: input.type,
      githubOrg,
      infraApplied,
      albPath: infraApplied ? `/${vars.HTTP_PATH}/` : undefined,
      ecsService: infraApplied ? vars.ECS_SERVICE : undefined,
      ecrRepository: infraApplied ? vars.ECR_REPO : undefined,
      appPublicUrl,
      appEmbedUrl,
      applicationId,
      applicationHubVisible,
      deployStatus,
      deployRunUrl,
      liveUrlVerified,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    emit('Error', 'error', message);
    throw err;
  } finally {
    if (ownsWorkDir && workDir) {
      await rm(workDir, { recursive: true, force: true });
    }
  }
}

/** Alias retrocompatible */
export const runGitHubBootstrap = runProjectBootstrap;
