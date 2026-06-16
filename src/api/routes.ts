import type { FastifyInstance } from 'fastify';
import { loadConfig } from '../config/loader';
import { store } from '../store';
import { eventBus } from '../shared/eventBus';
import { logger } from '../shared/logger';
import { registerChatRoute } from './chat';
import type { Orchestrator } from '../agents/orchestrator';
import type { RunEvent } from '../shared/types';

export function registerApiRoutes(app: FastifyInstance, orchestrator: Orchestrator) {
  registerChatRoute(app, orchestrator);
  // ── Services ───────────────────────────────────────────────────────────────

  app.get('/api/services', async () => {
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
  });

  // ── Runs ───────────────────────────────────────────────────────────────────

  app.get<{ Querystring: { limit?: string; serviceId?: string } }>('/api/runs', async (req) => {
    const { limit, serviceId } = req.query;
    return store.listRuns({ limit: limit ? Number(limit) : 20, serviceId });
  });

  app.get<{ Params: { id: string } }>('/api/runs/:id', async (req, reply) => {
    const run = store.getRunById(req.params.id);
    if (!run) return reply.status(404).send({ error: 'Not found' });
    const events = store.getRunEvents(req.params.id);
    return { ...run, events };
  });

  // ── Incidents ──────────────────────────────────────────────────────────────

  app.get<{ Querystring: { serviceId?: string; includeResolved?: string } }>(
    '/api/incidents',
    async (req) => {
      const { serviceId, includeResolved } = req.query;
      return store.listIncidents({ serviceId, includeResolved: includeResolved === 'true' });
    }
  );

  app.post<{ Params: { id: string } }>('/api/incidents/:id/resolve', async (req) => {
    store.resolveIncident(req.params.id);
    return { success: true };
  });

  // ── Trigger ────────────────────────────────────────────────────────────────

  app.post<{
    Body: { serviceId: string; checkType: 'health' | 'dependency' | 'security' | 'all' };
  }>('/api/trigger', async (req, reply) => {
    const { serviceId, checkType } = req.body;
    if (!serviceId || !checkType) return reply.status(400).send({ error: 'serviceId and checkType required' });
    orchestrator
      .triggerCheck(serviceId, checkType, 'dashboard')
      .catch((err: unknown) => logger.error({ err, serviceId, checkType }, 'Dashboard-triggered check failed'));
    return { triggered: true, serviceId, checkType };
  });

  // ── SSE — live event stream ────────────────────────────────────────────────

  app.get<{ Querystring: { runId?: string } }>('/api/events', async (req, reply) => {
    const { runId } = req.query;

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    reply.raw.write(': connected\n\n');

    const listener = (event: RunEvent) => {
      if (runId && event.runId !== runId) return;
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    eventBus.on('run_event', listener);

    const ping = setInterval(() => reply.raw.write(': ping\n\n'), 15_000);

    req.raw.on('close', () => {
      eventBus.off('run_event', listener);
      clearInterval(ping);
    });

    await new Promise(() => {});
  });
}
