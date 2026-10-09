import { connectDb, disconnectDb } from './core/db/connection.js';
import { closeRedis } from './core/cache/redis.js';
import { startEventProcessing } from './core/events/relay.js';
import { allSubscriptions } from './core/events/events.js';
import { logger } from './core/observability/logger.js';
import { registerSubscriptions } from './modules/index.js';

/** Background worker: outbox relay and domain event subscribers (later: PDFs, SMS, payroll). */
await connectDb();
registerSubscriptions();
const stop = startEventProcessing();
logger.info({ subscriptions: allSubscriptions() }, 'Worker started');

async function shutdown(signal) {
  logger.info({ signal }, 'Worker shutting down');
  await stop();
  await disconnectDb();
  await closeRedis();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
