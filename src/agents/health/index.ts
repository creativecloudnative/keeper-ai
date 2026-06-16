import { runAgentLoop } from '../base';
import { healthTools, handleHealthTool } from './tools';
import type { ServiceConfig } from '../../config/schema';
import type { AgentResult, AgentEventCallback } from '../../shared/types';

const SYSTEM_PROMPT = `You are a health monitoring agent. Your job is to check whether a service's
HTTP endpoints are responding correctly and surface any issues.

Guidelines:
- Check every configured endpoint
- Flag response times > 2000ms as degraded, > 5000ms as critical
- Distinguish transient failures (single check) from sustained issues
- Don't create incidents for expected maintenance windows

Finish with a structured report:
  HEALTH_STATUS: healthy | degraded | down
  FAILED_ENDPOINTS: <list or 'none'>
  RECOMMENDED_ACTION: create_incident | no_action
  REASON: <brief rationale>`;

export async function runHealthAgent(service: ServiceConfig, onEvent?: AgentEventCallback): Promise<AgentResult> {
  const baseUrl = service.deployment.url;
  if (!baseUrl) {
    return { success: true, summary: 'No deployment URL configured — health check skipped' };
  }

  const endpoints = service.checks.health?.endpoints ?? [{ path: '/', expected_status: 200 }];
  const endpointList = endpoints
    .map((e) => `${baseUrl}${e.path} (expect HTTP ${e.expected_status})`)
    .join('\n');

  return runAgentLoop({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: `Check health for "${service.name}".
Endpoints:
${endpointList}

Report overall health status and whether an incident should be created.`,
    tools: healthTools,
    onToolCall: handleHealthTool,
    onEvent,
  });
}
