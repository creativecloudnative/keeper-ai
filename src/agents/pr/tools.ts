import Anthropic from '@anthropic-ai/sdk';
import { getOctokit, parseRepo } from '../../shared/github';

export const prTools: Anthropic.Tool[] = [
  {
    name: 'get_repo_info',
    description: 'Get repository info including the default branch name.',
    input_schema: {
      type: 'object' as const,
      properties: { repo: { type: 'string', description: 'owner/name' } },
      required: ['repo'],
    },
  },
  {
    name: 'create_pull_request',
    description: 'Create a GitHub pull request.',
    input_schema: {
      type: 'object' as const,
      properties: {
        repo: { type: 'string', description: 'owner/name' },
        title: { type: 'string' },
        body: { type: 'string', description: 'PR description in markdown' },
        head: { type: 'string', description: 'Head branch (must already exist in the repo)' },
        base: { type: 'string', description: 'Base branch to merge into' },
        draft: { type: 'boolean', default: false },
        labels: { type: 'array', items: { type: 'string' } },
      },
      required: ['repo', 'title', 'body', 'head', 'base'],
    },
  },
];

export async function handlePRTool(name: string, input: unknown): Promise<unknown> {
  const octokit = getOctokit();

  switch (name) {
    case 'get_repo_info': {
      const { repo } = input as { repo: string };
      const { owner, repo: repoName } = parseRepo(repo);
      const { data } = await octokit.repos.get({ owner, repo: repoName });
      return { default_branch: data.default_branch, full_name: data.full_name };
    }

    case 'create_pull_request': {
      const p = input as {
        repo: string;
        title: string;
        body: string;
        head: string;
        base: string;
        draft?: boolean;
        labels?: string[];
      };
      const { owner, repo: repoName } = parseRepo(p.repo);
      const { data: pr } = await octokit.pulls.create({
        owner,
        repo: repoName,
        title: p.title,
        body: p.body,
        head: p.head,
        base: p.base,
        draft: p.draft ?? false,
      });
      if (p.labels?.length) {
        await octokit.issues.addLabels({ owner, repo: repoName, issue_number: pr.number, labels: p.labels });
      }
      return { number: pr.number, url: pr.html_url, title: pr.title };
    }

    default:
      throw new Error(`Unknown PR tool: ${name}`);
  }
}
