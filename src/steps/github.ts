import { Octokit } from '@octokit/rest';
import type { GitHubOrgOption } from '../types';

export async function listGithubOrgs(token: string): Promise<GitHubOrgOption[]> {
  const octokit = new Octokit({ auth: token });
  const [{ data: user }, { data: orgs }] = await Promise.all([
    octokit.users.getAuthenticated(),
    octokit.orgs.listForAuthenticatedUser({ per_page: 100 }),
  ]);

  const options: GitHubOrgOption[] = [
    { login: user.login, avatarUrl: user.avatar_url, kind: 'user' },
    ...orgs.map((o) => ({
      login: o.login,
      avatarUrl: o.avatar_url,
      kind: 'org' as const,
    })),
  ];

  const seen = new Set<string>();
  return options.filter((o) => {
    if (seen.has(o.login)) return false;
    seen.add(o.login);
    return true;
  });
}

export interface CreateGithubRepoResult {
  cloneUrl: string;
  htmlUrl: string;
  owner: string;
}

export async function createGithubRepo(opts: {
  org: string;
  repoName: string;
  description: string;
  token: string;
  visibility?: 'public' | 'private';
}): Promise<CreateGithubRepoResult> {
  const { org, repoName, description, token, visibility = 'public' } = opts;
  const octokit = new Octokit({ auth: token });
  const isPrivate = visibility === 'private';

  let owner = org;
  let isOrg = true;

  try {
    await octokit.orgs.get({ org });
  } catch {
    isOrg = false;
  }

  let repo;
  if (isOrg) {
    try {
      const res = await octokit.repos.createInOrg({
        org,
        name: repoName,
        description,
        private: isPrivate,
        auto_init: false,
      });
      repo = res.data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const noOrgAccess =
        (err as { status?: number }).status === 403 ||
        msg.includes('admin access to the organization');

      if (noOrgAccess) {
        const { data: user } = await octokit.users.getAuthenticated();
        const res = await octokit.repos.createForAuthenticatedUser({
          name: repoName,
          description,
          private: isPrivate,
          auto_init: false,
        });
        repo = res.data;
        owner = user.login;
      } else {
        throw err;
      }
    }
  } else {
    const res = await octokit.repos.createForAuthenticatedUser({
      name: repoName,
      description,
      private: isPrivate,
      auto_init: false,
    });
    repo = res.data;
    owner = repo.owner.login;
  }

  return {
    cloneUrl: repo.clone_url,
    htmlUrl: repo.html_url,
    owner,
  };
}

export async function resolveGithubUsername(
  token: string,
  identifier: string,
): Promise<string | null> {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  if (!trimmed.includes('@')) {
    return trimmed.replace(/^@/, '');
  }

  const octokit = new Octokit({ auth: token });
  const { data } = await octokit.search.users({
    q: `${trimmed} in:email`,
    per_page: 5,
  });

  if (data.items.length === 1) {
    return data.items[0]!.login;
  }

  const { data: byLogin } = await octokit.search.users({
    q: trimmed,
    per_page: 5,
  });

  if (byLogin.items.length === 1) {
    return byLogin.items[0]!.login;
  }

  return null;
}

export async function addGithubCollaborators(opts: {
  owner: string;
  repoName: string;
  token: string;
  members: Array<{ username: string; role: string }>;
}): Promise<Array<{ username: string; ok: boolean; detail?: string }>> {
  const { owner, repoName, token, members } = opts;
  if (!members.length) return [];

  const octokit = new Octokit({ auth: token });
  const results: Array<{ username: string; ok: boolean; detail?: string }> = [];

  for (const m of members) {
    try {
      await octokit.repos.addCollaborator({
        owner,
        repo: repoName,
        username: m.username,
        permission: mapPermission(m.role),
      });
      results.push({ username: m.username, ok: true });
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 422) {
        results.push({ username: m.username, ok: true, detail: 'invitación ya enviada' });
        continue;
      }
      const message = err instanceof Error ? err.message : String(err);
      results.push({ username: m.username, ok: false, detail: message });
    }
  }

  return results;
}

function mapPermission(role: string): 'pull' | 'triage' | 'push' | 'maintain' | 'admin' {
  switch (role) {
    case 'admin':
      return 'admin';
    case 'read':
      return 'pull';
    case 'write':
    default:
      return 'push';
  }
}
