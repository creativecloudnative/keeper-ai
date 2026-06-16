import Anthropic from '@anthropic-ai/sdk';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export const securityTools: Anthropic.Tool[] = [
  {
    name: 'run_npm_audit',
    description:
      'Clone a repo and run `npm audit --json` to find security vulnerabilities. Returns the full audit report JSON.',
    input_schema: {
      type: 'object' as const,
      properties: { repo: { type: 'string', description: 'owner/name' } },
      required: ['repo'],
    },
  },
];

export async function handleSecurityTool(
  name: string,
  input: unknown,
  githubToken: string
): Promise<unknown> {
  const { repo } = input as { repo: string };

  switch (name) {
    case 'run_npm_audit': {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'keeper-sec-'));
      try {
        execSync(
          `git clone --depth=1 https://${githubToken}@github.com/${repo}.git ${tmpDir}`,
          { stdio: 'pipe', timeout: 60_000 }
        );
        execSync('npm install --ignore-scripts', { cwd: tmpDir, stdio: 'pipe', timeout: 120_000 });
        try {
          return JSON.parse(execSync('npm audit --json', { cwd: tmpDir }).toString());
        } catch (err: unknown) {
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
      throw new Error(`Unknown security tool: ${name}`);
  }
}
