import { connectDb, disconnectDb } from './core/db/connection.js';
import { closeRedis } from './core/cache/redis.js';
import { startEventProcessing } from './core/events/relay.js';
import { allSubscriptions } from './core/events/events.js';
import { logger } from './core/observability/logger.js';
import { registerSubscriptions } from './modules/index.js';
import { startPlatformJobs } from './platform/jobs.js';
import { startScheduler } from './core/jobs/scheduler.js';
import { sweepExpiredApprovals } from './core/approvals/approval.jobs.js';

/** Background worker: outbox relay, domain event subscribers and scheduled jobs. */
await connectDb();
registerSubscriptions();
const stop = startEventProcessing();
const stopPlatform = await startPlatformJobs();
const stopCore = await startScheduler('core', [
  { id: 'approval-expiry', pattern: '*/15 * * * *', run: () => sweepExpiredApprovals() },
]);
logger.info({ subscriptions: allSubscriptions() }, 'Worker started');

async function shutdown(signal) {
  logger.info({ signal }, 'Worker shutting down');
  await stop();
  await stopPlatform();
  await stopCore();
  await disconnectDb();
  await closeRedis();
  process.exit(0);
}
process.on('unhandledRejection', (err) => logger.error({ err }, 'Unhandled rejection'));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
