import { runAgentLoop } from '../base';
import { prTools, handlePRTool } from './tools';
import type { ServiceConfig } from '../../config/schema';
import type { AgentResult, AgentEventCallback } from '../../shared/types';

const SYSTEM_PROMPT = `You are a pull request agent. Your job is to create well-structured
GitHub PRs for proposed changes.

Guidelines:
- Title: use conventional commit format (chore:, fix:, security:, feat:)
- Body: include Summary, Changes, and Testing sections in markdown
- The head branch is assumed to already exist with the relevant commits
- Apply the configured labels after creating the PR

After creating the PR, report the PR number and URL.`;

export type PRType = 'dependency' | 'security' | 'fix' | 'feat';

export interface CreatePRParams {
  service: ServiceConfig;
  title: string;
  body: string;
  headBranch: string;
  type: PRType;
  onEvent?: AgentEventCallback;
}

export async function runPRAgent(params: CreatePRParams): Promise<AgentResult> {
  const { service, title, body, headBranch, type, onEvent } = params;
  const pr = service.pr;

  return runAgentLoop({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: `Create a pull request for "${service.name}" (repo: ${service.repo}).

Details:
- Type: ${type}
- Suggested title: ${title}
- Head branch: ${headBranch}
- Base branch: ${pr.base_branch}
- Labels: ${pr.labels.join(', ')}
- Draft: ${pr.draft}

Body to use:
${body}

Create the PR now.`,
    tools: prTools,
    onToolCall: handlePRTool,
    onEvent,
  });
}
