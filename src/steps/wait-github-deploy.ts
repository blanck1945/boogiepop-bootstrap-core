import { Octokit } from '@octokit/rest';

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_POLL_MS = 15_000;

export type DeployWaitStatus = 'success' | 'failure' | 'timeout';

export interface DeployWaitResult {
  status: DeployWaitStatus;
  conclusion?: string | null;
  htmlUrl?: string;
  runId?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForGithubDeploy(opts: {
  owner: string;
  repo: string;
  token: string;
  startedAfter: Date;
  timeoutMs?: number;
  pollIntervalMs?: number;
  onProgress?: (detail: string) => void;
}): Promise<DeployWaitResult> {
  const octokit = new Octokit({ auth: opts.token });
  const deadline = Date.now() + (opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const pollMs = opts.pollIntervalMs ?? DEFAULT_POLL_MS;

  await sleep(5000);

  while (Date.now() < deadline) {
    const { data } = await octokit.actions.listWorkflowRunsForRepo({
      owner: opts.owner,
      repo: opts.repo,
      event: 'push',
      branch: 'main',
      per_page: 5,
    });

    const run = data.workflow_runs.find(
      (r) => new Date(r.created_at) >= opts.startedAfter,
    );

    if (!run) {
      opts.onProgress?.('esperando que GitHub Actions registre el workflow…');
      await sleep(pollMs);
      continue;
    }

    opts.onProgress?.(`${run.status ?? 'unknown'} · ${run.name ?? 'Deploy'}`);

    if (run.status === 'completed') {
      if (run.conclusion === 'success') {
        return {
          status: 'success',
          conclusion: run.conclusion,
          htmlUrl: run.html_url,
          runId: run.id,
        };
      }
      return {
        status: 'failure',
        conclusion: run.conclusion,
        htmlUrl: run.html_url,
        runId: run.id,
      };
    }

    await sleep(pollMs);
  }

  return { status: 'timeout' };
}
