import { Queue, Worker } from 'bullmq';
import { newRedisConnection } from '../core/cache/redis.js';
import { logger } from '../core/observability/logger.js';
import { runLifecycle } from './services/subscription.service.js';

const QUEUE = 'platform';

/**
 * Platform schedules (one scheduler per id, so several worker replicas never double-run):
 * the subscription lifecycle runs daily at 00:30 IST.
 */
export async function startPlatformJobs() {
  const queue = new Queue(QUEUE, { connection: newRedisConnection() });
  await queue.upsertJobScheduler(
    'subscription-lifecycle',
    { pattern: '30 0 * * *', tz: 'Asia/Kolkata' },
    { name: 'lifecycle' },
  );
  const worker = new Worker(
    QUEUE,
    async (job) => {
      if (job.name !== 'lifecycle') return null;
      const summary = await runLifecycle();
      logger.info({ summary }, 'Subscription lifecycle ran');
      return summary;
    },
    { connection: newRedisConnection(), concurrency: 1 },
  );
  worker.on('failed', (job, err) => logger.error({ err, jobId: job?.id }, 'Platform job failed'));
  return async () => {
    await worker.close();
    await queue.close();
  };
}
