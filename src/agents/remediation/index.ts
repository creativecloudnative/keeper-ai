import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { logger } from '../../shared/logger';
import type { ServiceConfig } from '../../config/schema';

export type RemediationType = 'security' | 'dependency';

export interface RemediationResult {
  branchName: string;
  changedFiles: string[];
}

export async function runRemediation(
  service: ServiceConfig,
  type: RemediationType,
): Promise<RemediationResult | null> {
  const githubToken = process.env.GITHUB_TOKEN ?? '';
  const repo = service.repo;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'keeper-rem-'));

  try {
    logger.info({ serviceId: service.id, type }, 'Remediation: cloning repo');
    execSync(
      `git clone --depth=1 https://${githubToken}@github.com/${repo}.git ${tmpDir}`,
      { stdio: 'pipe', timeout: 60_000 },
    );

    execSync('git config user.email "keeper-ai@creativecloudnative.com"', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.name "keeper-ai"', { cwd: tmpDir, stdio: 'pipe' });

    logger.info({ serviceId: service.id, type }, 'Remediation: installing dependencies');
    execSync('npm install --ignore-scripts', { cwd: tmpDir, stdio: 'pipe', timeout: 120_000 });

    const date = new Date().toISOString().slice(0, 10);
    const suffix = Math.random().toString(36).slice(2, 6);
    const branchName = type === 'security'
      ? `security/npm-audit-fix-${date}-${suffix}`
      : `chore/update-deps-${date}-${suffix}`;

    logger.info({ serviceId: service.id, type, branchName }, 'Remediation: applying fix');
    if (type === 'security') {
      try {
        execSync('npm audit fix', { cwd: tmpDir, stdio: 'pipe' });
      } catch {
        // npm audit fix exits non-zero when some vulns have no automated fix — partial fixes are still valid
      }
    } else {
      try {
        execSync('npm update', { cwd: tmpDir, stdio: 'pipe', timeout: 120_000 });
      } catch {
        // npm update may exit non-zero in edge cases — continue if there are changes
      }
    }

    const diffOutput = execSync(
      'git diff --name-only HEAD -- package.json package-lock.json',
      { cwd: tmpDir },
    ).toString().trim();

    if (!diffOutput) {
      logger.info({ serviceId: service.id, type }, 'Remediation: no package changes after fix — skipping PR');
      return null;
    }

    const changedFiles = diffOutput.split('\n').filter(Boolean);

    execSync(`git checkout -b ${branchName}`, { cwd: tmpDir, stdio: 'pipe' });
    execSync('git add -u', { cwd: tmpDir, stdio: 'pipe' });

    const commitTitle = type === 'security'
      ? 'security: apply npm audit fix'
      : 'chore: update npm dependencies';
    execSync(
      `git commit --message="${commitTitle}" --message="Automated by keeper-ai"`,
      { cwd: tmpDir, stdio: 'pipe' },
    );

    logger.info({ serviceId: service.id, type, branchName }, 'Remediation: pushing branch');
    try {
      execSync(
        `git push https://${githubToken}@github.com/${repo}.git ${branchName}`,
        { cwd: tmpDir, stdio: 'pipe' },
      );
    } catch {
      throw new Error(`Failed to push branch ${branchName} to ${repo}`);
    }

    logger.info({ serviceId: service.id, type, branchName, changedFiles }, 'Remediation: branch pushed');
    return { branchName, changedFiles };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
