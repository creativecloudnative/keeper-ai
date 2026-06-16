import { runAgentLoop } from '../base';
import { securityTools, handleSecurityTool } from './tools';
import type { ServiceConfig } from '../../config/schema';
import type { AgentResult, AgentEventCallback } from '../../shared/types';

const SYSTEM_PROMPT = `You are a security scanning agent. Your job is to find npm vulnerabilities
and determine whether they warrant a PR.

Guidelines:
- Categorize findings by severity: critical, high, moderate, low
- Critical/high always warrant a PR
- Apply the configured severity threshold for moderate/low
- Report the exact npm fix command when available
- Note if a vulnerability has no fix yet (so we don't open pointless PRs)

Finish with a structured report:
  VULN_COUNTS: critical=<n> high=<n> moderate=<n> low=<n>
  RECOMMENDED_ACTION: create_pr | no_action | monitor
  REASON: <brief rationale>`;

export async function runSecurityAgent(service: ServiceConfig, onEvent?: AgentEventCallback): Promise<AgentResult> {
  const threshold = service.checks.security?.severity_threshold ?? 'moderate';
  const githubToken = process.env.GITHUB_TOKEN ?? '';

  return runAgentLoop({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: `Run a security audit for "${service.name}" (repo: ${service.repo}).
Severity threshold for creating a PR: ${threshold}.
Report all vulnerabilities and whether a PR should be created.`,
    tools: securityTools,
    onToolCall: (name, input) => handleSecurityTool(name, input, githubToken),
    onEvent,
  });
}
