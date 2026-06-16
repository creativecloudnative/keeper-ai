import { Octokit } from '@octokit/rest';

let _octokit: Octokit | null = null;

export function getOctokit(): Octokit {
  if (!_octokit) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error('GITHUB_TOKEN is not set');
    _octokit = new Octokit({ auth: token });
  }
  return _octokit;
}

export function parseRepo(repo: string): { owner: string; repo: string } {
  const [owner, name] = repo.split('/');
  if (!owner || !name) throw new Error(`Invalid repo format: ${repo}`);
  return { owner, repo: name };
}
