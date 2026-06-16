import type { FastifyInstance } from 'fastify';
import Anthropic from '@anthropic-ai/sdk';
import { store } from '../store';
import { loadConfig } from '../config/loader';
import { logger } from '../shared/logger';
import type { Orchestrator } from '../agents/orchestrator';

const anthropic = new Anthropic();

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'list_runs',
    description: 'List recent agent runs. Returns run ID, service, agent type, status, and timing.',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max runs to return (default 20, max 50)' },
        serviceId: { type: 'string', description: 'Filter by service ID' },
      },
    },
  },
  {
    name: 'get_run',
    description: 'Get full details and event trace for a specific run by ID.',
    input_schema: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: 'Run ID to retrieve' },
      },
      required: ['runId'],
    },
  },
  {
    name: 'list_incidents',
    description: 'List incidents. Returns open incidents by default.',
    input_schema: {
      type: 'object',
      properties: {
        serviceId: { type: 'string', description: 'Filter by service ID' },
        includeResolved: { type: 'boolean', description: 'Include resolved incidents (default false)' },
      },
    },
  },
  {
    name: 'list_services',
    description: 'List all configured managed services with their latest run status for each check type.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_vulnerabilities',
    description: 'List tracked vulnerabilities from the vulnerability history database. Shows new, known, and resolved findings across scans.',
    input_schema: {
      type: 'object',
      properties: {
        serviceId: { type: 'string', description: 'Filter by service ID' },
        status: { type: 'string', enum: ['open', 'pr_created', 'resolved'], description: 'Filter by status (omit for all)' },
      },
    },
  },
  {
    name: 'trigger_check',
    description: 'Trigger an agent check for a service on demand. The check runs asynchronously and will appear in list_runs shortly.',
    input_schema: {
      type: 'object',
      properties: {
        serviceId: { type: 'string', description: 'Service ID to check' },
        checkType: {
          type: 'string',
          enum: ['health', 'dependency', 'security', 'all'],
          description: 'Type of check to run',
        },
      },
      required: ['serviceId', 'checkType'],
    },
  },
];

function systemPrompt(): string {
  return `You are the keeper-ai operations assistant. keeper-ai is a multi-agent system that automates day-2 operations for managed services — monitoring health, tracking dependencies, running security audits, and managing incidents.

You have real-time access to the system via tools. Use them proactively to answer questions accurately rather than speculating.

Current time: ${new Date().toISOString()}

Guidelines:
- Format responses in markdown
- For runs, highlight status, timing, and key findings from the agent summary
- For incidents, always include severity and how long they've been open
- When triggering checks, confirm what you triggered and note results will appear in runs shortly
- Be concise — the user is an operator who wants signal, not noise`;
}

async function callTool(
  name: string,
  input: Record<string, unknown>,
  orchestrator: Orchestrator,
): Promise<unknown> {
  switch (name) {
    case 'list_runs':
      return store.listRuns({
        limit: Math.min(Number(input.limit ?? 20), 50),
        serviceId: input.serviceId as string | undefined,
      });

    case 'get_run': {
      const run = store.getRunById(input.runId as string);
      if (!run) return { error: `Run ${input.runId} not found` };
      return { ...run, events: store.getRunEvents(run.id) };
    }

    case 'list_incidents':
      return store.listIncidents({
        serviceId: input.serviceId as string | undefined,
        includeResolved: Boolean(input.includeResolved),
      });

    case 'list_services': {
      const config = loadConfig();
      return config.services.map((s) => ({
        id: s.id,
        name: s.name,
        repo: s.repo,
        url: s.deployment.url,
        latestRuns: {
          health: store.getLatestRun(s.id, 'health'),
          dependency: store.getLatestRun(s.id, 'dependency'),
          security: store.getLatestRun(s.id, 'security'),
        },
      }));
    }

    case 'list_vulnerabilities':
      return store.listVulnerabilities({
        serviceId: input.serviceId as string | undefined,
        status: input.status as 'open' | 'pr_created' | 'resolved' | undefined,
      });

    case 'trigger_check': {
      const { serviceId, checkType } = input as { serviceId: string; checkType: 'health' | 'dependency' | 'security' | 'all' };
      orchestrator
        .triggerCheck(serviceId, checkType, 'chat')
        .catch((err) => logger.error({ err, serviceId, checkType }, 'Chat-triggered check failed'));
      return { triggered: true, serviceId, checkType };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export function registerChatRoute(app: FastifyInstance, orchestrator: Orchestrator) {
  app.post<{ Body: { messages: { role: 'user' | 'assistant'; content: string }[] } }>(
    '/api/chat',
    async (req, reply) => {
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      const send = (data: object) => reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);

      const messages: Anthropic.MessageParam[] = req.body.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        let iterations = 0;
        while (iterations++ < 10) {
          const stream = anthropic.messages.stream({
            model: 'claude-opus-4-8',
            max_tokens: 4096,
            system: systemPrompt(),
            messages,
            tools: TOOLS,
          });

          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              send({ type: 'text', delta: event.delta.text });
            }
          }

          const final = await stream.finalMessage();

          if (final.stop_reason === 'end_turn') {
            send({ type: 'done' });
            break;
          }

          if (final.stop_reason === 'tool_use') {
            messages.push({ role: 'assistant', content: final.content });

            const toolUseBlocks = final.content.filter(
              (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
            );

            const results: Anthropic.ToolResultBlockParam[] = [];

            for (const block of toolUseBlocks) {
              send({ type: 'tool_call', name: block.name, input: block.input });
              const result = await callTool(block.name, block.input as Record<string, unknown>, orchestrator);
              send({ type: 'tool_result', name: block.name, content: result });
              results.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: typeof result === 'string' ? result : JSON.stringify(result),
              });
            }

            messages.push({ role: 'user', content: results });
          }
        }
      } catch (err) {
        logger.error({ err }, 'Chat error');
        send({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
      }

      reply.raw.end();
    }
  );
}
