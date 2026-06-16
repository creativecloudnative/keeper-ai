import { runAgentLoop } from '../base';
import { dependencyTools, handleDependencyTool } from './tools';
import type { ServiceConfig } from '../../config/schema';
import type { AgentResult, AgentEventCallback } from '../../shared/types';

const SYSTEM_PROMPT = `You are a dependency management agent. Your job is to check for outdated
npm packages in a repository and report what should be upgraded.

Guidelines:
- Check package.json first to understand the project, then run the outdated check
- Ignore devDependencies for patch updates; flag major version bumps for all dependency types
- Group related packages (e.g., React ecosystem, ESLint plugins)
- Be conservative: identify what's outdated and recommend action, don't blindly upgrade everything
- Account for the ignore list — do not flag those packages

Finish with a structured report:
  OUTDATED_COUNT: <n>
  CRITICAL_UPGRADES: <list of major/security bumps>
  RECOMMENDED_ACTION: create_pr | no_action
  REASON: <brief rationale>`;

export async function runDependencyAgent(service: ServiceConfig, onEvent?: AgentEventCallback): Promise<AgentResult> {
  const githubToken = process.env.GITHUB_TOKEN ?? '';
  const ignored = service.checks.dependencies?.ignore ?? [];

  return runAgentLoop({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: `Check dependencies for "${service.name}" (repo: ${service.repo}).
Ignored packages: ${ignored.length ? ignored.join(', ') : 'none'}.
Report what is outdated and whether a PR should be created.`,
    tools: dependencyTools,
    onToolCall: (name, input) => handleDependencyTool(name, input, githubToken),
    onEvent,
  });
}
