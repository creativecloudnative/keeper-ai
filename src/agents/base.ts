import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../shared/logger';
import type { AgentResult, AgentEventCallback } from '../shared/types';

const client = new Anthropic();

export interface AgentLoopOptions {
  systemPrompt: string;
  userMessage: string;
  tools: Anthropic.Tool[];
  onToolCall: (name: string, input: unknown) => Promise<unknown>;
  onEvent?: AgentEventCallback;
  maxIterations?: number;
}

export async function runAgentLoop(options: AgentLoopOptions): Promise<AgentResult> {
  const { systemPrompt, userMessage, tools, onToolCall, onEvent, maxIterations = 20 } = options;

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userMessage }];
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;
    onEvent?.('iteration', { iteration: iterations });

    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      system: systemPrompt,
      tools,
      messages,
    });

    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
      if (textBlock) onEvent?.('agent_text', { text: textBlock.text });
      return { success: true, summary: textBlock?.text ?? '(no summary)' };
    }

    if (response.stop_reason !== 'tool_use') {
      return {
        success: false,
        summary: `Unexpected stop reason: ${response.stop_reason}`,
        error: `stop_reason=${response.stop_reason}`,
      };
    }

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    );

    messages.push({ role: 'assistant', content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      onEvent?.('tool_call', { toolName: toolUse.name, input: toolUse.input as Record<string, unknown> });
      try {
        const result = await onToolCall(toolUse.name, toolUse.input);
        onEvent?.('tool_result', { toolName: toolUse.name, output: result, isError: false });
        toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(result) });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn({ err, tool: toolUse.name }, 'Tool call failed');
        onEvent?.('tool_result', { toolName: toolUse.name, output: msg, isError: true });
        toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: msg, is_error: true });
      }
    }

    messages.push({ role: 'user', content: toolResults });
  }

  return {
    success: false,
    summary: `Agent exceeded max iterations (${maxIterations})`,
    error: 'max_iterations_exceeded',
  };
}
