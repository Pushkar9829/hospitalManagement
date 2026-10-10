import { connectDb, disconnectDb } from './core/db/connection.js';
import { closeRedis } from './core/cache/redis.js';
import { startEventProcessing } from './core/events/relay.js';
import { allSubscriptions } from './core/events/events.js';
import { logger } from './core/observability/logger.js';
import { registerSubscriptions } from './modules/index.js';
import { startPlatformJobs } from './platform/jobs.js';

/** Background worker: outbox relay, domain event subscribers and platform schedules. */
await connectDb();
registerSubscriptions();
const stop = startEventProcessing();
const stopPlatform = await startPlatformJobs();
logger.info({ subscriptions: allSubscriptions() }, 'Worker started');

async function shutdown(signal) {
  logger.info({ signal }, 'Worker shutting down');
  await stop();
  await stopPlatform();
  await disconnectDb();
  await closeRedis();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
