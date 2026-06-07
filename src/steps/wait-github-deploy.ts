import { Octokit } from '@octokit/rest';

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_POLL_MS = 15_000;

export type DeployPollStatus = 'pending' | 'running' | 'success' | 'failure';

export interface DeployPollResult {
  status: DeployPollStatus;
  conclusion?: string | null;
  htmlUrl?: string;
  runId?: number;
  detail?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getGithubDeployStatus(opts: {
  owner: string;
  repo: string;
  token: string;
  startedAfter: Date;
}): Promise<DeployPollResult> {
  const octokit = new Octokit({ auth: opts.token });
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
    return { status: 'pending', detail: 'esperando que GitHub Actions registre el workflow…' };
  }

  const detail = `${run.status ?? 'unknown'} · ${run.name ?? 'Deploy'}`;

  if (run.status !== 'completed') {
    return {
      status: 'running',
      detail,
      htmlUrl: run.html_url,
      runId: run.id,
    };
  }

  if (run.conclusion === 'success') {
    return {
      status: 'success',
      conclusion: run.conclusion,
      htmlUrl: run.html_url,
      runId: run.id,
      detail,
    };
  }

  return {
    status: 'failure',
    conclusion: run.conclusion,
    htmlUrl: run.html_url,
    runId: run.id,
    detail: `${run.conclusion ?? 'failure'} · ${run.name ?? 'Deploy'}`,
  };
}

export type DeployWaitStatus = 'success' | 'failure' | 'timeout';

export interface DeployWaitResult {
  status: DeployWaitStatus;
  conclusion?: string | null;
  htmlUrl?: string;
  runId?: number;
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
  const deadline = Date.now() + (opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const pollMs = opts.pollIntervalMs ?? DEFAULT_POLL_MS;

  await sleep(5000);

  while (Date.now() < deadline) {
    const poll = await getGithubDeployStatus(opts);
    opts.onProgress?.(poll.detail ?? poll.status);

    if (poll.status === 'success') {
      return {
        status: 'success',
        conclusion: poll.conclusion,
        htmlUrl: poll.htmlUrl,
        runId: poll.runId,
      };
    }
    if (poll.status === 'failure') {
      return {
        status: 'failure',
        conclusion: poll.conclusion,
        htmlUrl: poll.htmlUrl,
        runId: poll.runId,
      };
    }

    await sleep(pollMs);
  }

  return { status: 'timeout' };
}
