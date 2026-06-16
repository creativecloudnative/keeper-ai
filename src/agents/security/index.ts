import { runAgentLoop } from '../base';
import { securityTools, handleSecurityTool } from './tools';
import type { ServiceConfig } from '../../config/schema';
import type { AgentResult, AgentEventCallback } from '../../shared/types';

const SYSTEM_PROMPT = `You are a security scanning agent. Your job is to find npm vulnerabilities
and determine whether they warrant a PR.

Guidelines:
- The tool returns deduplication context: each finding has isNew=true if it has never been seen before for this service
- Only recommend create_pr for NEW findings (isNew=true) that meet the severity threshold
- For KNOWN findings (isNew=false), use no_action or monitor — a PR was likely already opened
- Critical/high always warrant a PR if new; apply configured threshold for moderate/low
- Report the exact npm fix command when available
- Note if a vulnerability has no fix yet (so we don't open pointless PRs)

Finish with a structured report:
  VULN_COUNTS: critical=<n> high=<n> moderate=<n> low=<n>
  NEW_VULNS: <n>
  RECOMMENDED_ACTION: create_pr | no_action | monitor
  REASON: <brief rationale>`;

export async function runSecurityAgent(service: ServiceConfig, onEvent?: AgentEventCallback): Promise<AgentResult> {
  const threshold = service.checks.security?.severity_threshold ?? 'moderate';
  const githubToken = process.env.GITHUB_TOKEN ?? '';

  return runAgentLoop({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: `Run a security audit for "${service.name}" (repo: ${service.repo}, serviceId: ${service.id}).
Severity threshold for creating a PR: ${threshold}.
Report all vulnerabilities. Only recommend create_pr for new findings not seen in previous scans.`,
    tools: securityTools,
    onToolCall: (name, input) => handleSecurityTool(name, input, githubToken),
    onEvent,
  });
}
