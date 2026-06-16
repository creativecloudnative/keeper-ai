import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { logger } from './shared/logger';
import { Orchestrator } from './agents/orchestrator';
import { registerSignalRoutes } from './signals/handlers';
import { registerApiRoutes } from './api/routes';

async function main() {
  const orchestrator = new Orchestrator();
  orchestrator.start();

  const app = Fastify({ logger: false });

  const allowedOrigins = [
    'http://localhost:3000',
    ...(process.env.DASHBOARD_URL ? [process.env.DASHBOARD_URL] : []),
  ];
  await app.register(cors, { origin: allowedOrigins });

  registerSignalRoutes(app, (signal) => orchestrator.handleSignal(signal));
  registerApiRoutes(app, orchestrator);

  // Railway sets PORT; KEEPER_PORT is for local dev
  const port = Number(process.env.PORT ?? process.env.KEEPER_PORT ?? 3001);
  await app.listen({ port, host: '0.0.0.0' });
  logger.info({ port }, 'keeper-ai listening');

  const shutdown = async () => {
    logger.info('Shutting down');
    orchestrator.stop();
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
