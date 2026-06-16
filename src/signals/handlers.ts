import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { logger } from '../shared/logger';
import type { Signal } from './types';

export function registerSignalRoutes(
  app: FastifyInstance,
  onSignal: (signal: Signal) => Promise<void>
) {
  app.post<{
    Body: { type: string; source: string; serviceId: string; payload?: Record<string, unknown> };
  }>(
    '/signals',
    {
      schema: {
        body: {
          type: 'object',
          required: ['type', 'source', 'serviceId'],
          properties: {
            type: { type: 'string' },
            source: { type: 'string' },
            serviceId: { type: 'string' },
            payload: { type: 'object' },
          },
        },
      },
    },
    async (request, reply) => {
      const signal: Signal = {
        id: randomUUID(),
        type: request.body.type as Signal['type'],
        source: request.body.source,
        serviceId: request.body.serviceId,
        payload: request.body.payload ?? {},
        receivedAt: new Date().toISOString(),
      };

      logger.info({ signalId: signal.id, type: signal.type }, 'Signal received');

      // Process async — don't block the HTTP response
      onSignal(signal).catch((err) => logger.error({ err, signal }, 'Signal processing failed'));

      return reply.status(202).send({ id: signal.id, status: 'accepted' });
    }
  );

  app.get('/health', async (_req, reply) => {
    return reply.send({ status: 'ok', timestamp: new Date().toISOString() });
  });
}
