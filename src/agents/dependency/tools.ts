import Anthropic from '@anthropic-ai/sdk';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export const dependencyTools: Anthropic.Tool[] = [
  {
    name: 'read_package_json',
    description: 'Read package.json from a GitHub repository via the API.',
    input_schema: {
      type: 'object' as const,
      properties: { repo: { type: 'string', description: 'owner/name' } },
      required: ['repo'],
    },
  },
  {
    name: 'check_npm_outdated',
    description:
      'Clone a repo and run `npm outdated --json` to identify outdated packages. Returns a JSON object keyed by package name.',
    input_schema: {
      type: 'object' as const,
      properties: { repo: { type: 'string', description: 'owner/name' } },
      required: ['repo'],
    },
  },
];

export async function handleDependencyTool(
  name: string,
  input: unknown,
  githubToken: string
): Promise<unknown> {
  const { repo } = input as { repo: string };

  switch (name) {
    case 'read_package_json': {
      const [owner, repoName] = repo.split('/');
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/contents/package.json`,
        { headers: { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github.v3+json' } }
      );
      if (!res.ok) throw new Error(`GitHub API ${res.status}: ${res.statusText}`);
      const data = (await res.json()) as { content: string };
      return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
    }

    case 'check_npm_outdated': {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'keeper-dep-'));
      try {
        execSync(
          `git clone --depth=1 https://${githubToken}@github.com/${repo}.git ${tmpDir}`,
          { stdio: 'pipe', timeout: 60_000 }
        );
        execSync('npm install --ignore-scripts --no-audit --prefer-offline', {
          cwd: tmpDir,
          stdio: 'pipe',
          timeout: 120_000,
        });
        try {
          return JSON.parse(execSync('npm outdated --json', { cwd: tmpDir }).toString());
        } catch (err: unknown) {
          // npm outdated exits 1 when packages are outdated; stdout still has the JSON
          if (err && typeof err === 'object' && 'stdout' in err) {
            return JSON.parse((err as { stdout: Buffer }).stdout.toString());
          }
          throw err;
        }
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }

    default:
      throw new Error(`Unknown dependency tool: ${name}`);
  }
}
