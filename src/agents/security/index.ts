import { runAgentLoop } from '../base';
import { securityTools, handleSecurityTool } from './tools';
import type { ServiceConfig } from '../../config/schema';
import type { AgentResult, AgentEventCallback } from '../../shared/types';

const SYSTEM_PROMPT = `You are a security scanning agent. Your job is to find npm vulnerabilities
and determine whether they warrant a PR.

Guidelines:
- Each finding has isNew=true if never seen before, and isSuppressed=true if explicitly suppressed
- Only recommend create_pr for findings that are BOTH new (isNew=true) AND not suppressed (isSuppressed=false)
- Suppressed findings are known exceptions — skip them entirely, do not recommend action
- For KNOWN findings (isNew=false), use no_action or monitor — a PR was likely already opened
- Critical/high always warrant a PR if new and unsuppressed; apply configured threshold for moderate/low
- Report the exact npm fix command when available
- Note if a vulnerability has no fix yet (so we don't open pointless PRs)

Finish with a structured report:
  VULN_COUNTS: critical=<n> high=<n> moderate=<n> low=<n>
  NEW_VULNS: <n>
  SUPPRESSED: <n>
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
