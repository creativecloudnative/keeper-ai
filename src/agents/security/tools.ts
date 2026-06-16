import Anthropic from '@anthropic-ai/sdk';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { store } from '../../store';
import type { Severity } from '../../shared/types';

type VulnFinding = {
  vulnId: string;
  packageName: string;
  severity: Severity;
  title: string;
  url: string;
};

function extractFindings(audit: Record<string, unknown>): VulnFinding[] {
  const seen = new Set<string>();
  const findings: VulnFinding[] = [];

  // npm audit v2 (npm 7+): { vulnerabilities: { [pkg]: { severity, via: [...] } } }
  const vulns = audit.vulnerabilities as Record<string, unknown> | undefined;
  if (vulns) {
    for (const [pkg, v] of Object.entries(vulns)) {
      const entry = v as Record<string, unknown>;
      for (const via of (entry.via as unknown[]) ?? []) {
        if (typeof via !== 'object' || !via || !('url' in via)) continue;
        const advisory = via as Record<string, unknown>;
        const url = String(advisory.url ?? '');
        const match = url.match(/(GHSA-[\w-]+|CVE-\d{4}-\d+)/);
        if (!match) continue;
        const vulnId = match[1];
        if (seen.has(vulnId)) continue;
        seen.add(vulnId);
        findings.push({
          vulnId,
          packageName: pkg,
          severity: String(entry.severity ?? advisory.severity ?? 'low') as Severity,
          title: String(advisory.title ?? 'Unknown vulnerability'),
          url,
        });
      }
    }
  }

  // npm audit v1: { advisories: { [id]: { ... } } }
  const advisories = audit.advisories as Record<string, unknown> | undefined;
  if (advisories) {
    for (const adv of Object.values(advisories)) {
      const a = adv as Record<string, unknown>;
      const url = String(a.url ?? '');
      const match = url.match(/(GHSA-[\w-]+|CVE-\d{4}-\d+)/);
      const vulnId = match?.[1] ?? `NPM-${String(a.id ?? 'unknown')}`;
      if (seen.has(vulnId)) continue;
      seen.add(vulnId);
      findings.push({
        vulnId,
        packageName: String(a.module_name ?? 'unknown'),
        severity: String(a.severity ?? 'low') as Severity,
        title: String(a.title ?? 'Unknown vulnerability'),
        url,
      });
    }
  }

  return findings;
}

export const securityTools: Anthropic.Tool[] = [
  {
    name: 'run_npm_audit',
    description:
      'Clone a repo, run `npm audit --json`, and cross-reference results against the vulnerability history for this service. Returns the audit report plus deduplication context (new vs already-known findings).',
    input_schema: {
      type: 'object' as const,
      properties: {
        repo: { type: 'string', description: 'owner/name' },
        serviceId: { type: 'string', description: 'keeper-ai service ID for deduplication tracking' },
      },
      required: ['repo', 'serviceId'],
    },
  },
];

export async function handleSecurityTool(
  name: string,
  input: unknown,
  githubToken: string
): Promise<unknown> {
  const { repo, serviceId } = input as { repo: string; serviceId: string };

  switch (name) {
    case 'run_npm_audit': {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'keeper-sec-'));
      try {
        execSync(
          `git clone --depth=1 https://${githubToken}@github.com/${repo}.git ${tmpDir}`,
          { stdio: 'pipe', timeout: 60_000 }
        );
        execSync('npm install --ignore-scripts', { cwd: tmpDir, stdio: 'pipe', timeout: 120_000 });

        let auditResult: Record<string, unknown>;
        try {
          auditResult = JSON.parse(execSync('npm audit --json', { cwd: tmpDir }).toString());
        } catch (err: unknown) {
          if (err && typeof err === 'object' && 'stdout' in err) {
            auditResult = JSON.parse((err as { stdout: Buffer }).stdout.toString());
          } else {
            throw err;
          }
        }

        const findings = extractFindings(auditResult);
        const { newIds, knownCount } = store.upsertVulnerabilities(serviceId, findings);

        return {
          audit: auditResult,
          deduplication: {
            totalFound: findings.length,
            newFindings: newIds.size,
            knownFindings: knownCount,
            findings: findings.map((f) => ({ ...f, isNew: newIds.has(f.vulnId) })),
          },
        };
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }

    default:
      throw new Error(`Unknown security tool: ${name}`);
  }
}
