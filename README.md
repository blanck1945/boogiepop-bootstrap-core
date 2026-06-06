# boogiepop-bootstrap-core

Librería TypeScript con la orquestación de **`boogiepop new`**: Terraform, GitHub, seeds y workflows CI.

Documentación para humanos: [boogiepop-cli/docs/CLI-BOOTSTRAP-INFRA.md](../boogiepop-cli/docs/CLI-BOOTSTRAP-INFRA.md).

## Destinos GitHub

| Tipo | Org (env del MS) | Seed |
|------|------------------|------|
| `next` | `GITHUB_ORG_BOOGIEPOP` | next-seed |
| `streamlit`, `vite` | `GITHUB_ORG_REMOTES` | streamlit-seed / react-seed |

## Flujo `runProjectBootstrap`

```
validar → [scaffold .tf] → [update tfvars] → [terraform apply -target] →
crear repo → clonar seed → transformar → lock deps → push main → colaboradores
```

Implementación: `src/orchestrator/github-only.ts`.

### Templates Terraform

`templates/terraform/{vite,next,streamlit}/` → archivos en `boogiepop-infra/terraform/`:

- `variables_*`, `locals_*`, `ecr_*`, `ecs_*`, `alb_*`, `s3_*`, `secrets_*`, `iam_*`

`terraform apply` usa solo targets de la app (`src/steps/terraform-apply.ts`), no el stack completo.

### Templates CI

`templates/workflows/*-deploy.yml.tpl` → `.github/workflows/deploy.yml` en el repo nuevo (OIDC + ECR + ECS ARM64).

## Uso programático

```typescript
import { runProjectBootstrap } from 'boogiepop-bootstrap-core';

await runProjectBootstrap(
  {
    name: 'my-app',
    type: 'vite',
    provisionInfra: true,
    visibility: 'private',
  },
  {
    token: process.env.GITHUB_TOKEN!,
    terraformDir: '/path/to/boogiepop-infra/terraform',
    orgConfig: { boogiepop: 'blanck1945', remotes: 'Boogiepop-remotes' },
    emit: (step, status, detail) => console.log(step, status, detail),
  },
);
```

## Build

```bash
npm install
npm run build   # tsc + copia templates/ → dist/templates/
```

Tras cambiar templates, rebuild y reiniciar `boogiepop-bootstrap`.

Requisitos en runtime: **git**, **terraform**, credenciales **AWS** válidas donde corre el MS.
