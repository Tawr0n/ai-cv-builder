import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { fromPrisma, type Job, PgBoss } from 'pg-boss';
import { ENV, type Env } from '../env/env.js';
import type { Prisma } from '../generated/prisma/client.js';

export const GENERATION_QUEUE = 'generation';
/** Gets a Generation job once its retries are exhausted, a crash on the last attempt included. */
export const GENERATION_DEAD_LETTER_QUEUE = 'generation-dead-letter';

export interface GenerationJobData {
  generationId: string;
}

export type GenerationJob = Job<GenerationJobData>;

/**
 * pg-boss on the app's own Postgres. Jobs are enqueued inside the caller's
 * Prisma transaction, so a Generation row and its job exist together or not at all.
 */
@Injectable()
export class GenerationQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GenerationQueue.name);
  private readonly boss: PgBoss;
  private started = false;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.boss = new PgBoss({ connectionString: env.DATABASE_URL });
    this.boss.on('error', (error) => this.logger.error(error));
  }

  /** A failed start does not stop the API from booting: `/api/health` reports it instead. */
  async onModuleInit() {
    try {
      await this.boss.start();
      await this.boss.createQueue(GENERATION_DEAD_LETTER_QUEUE);
      await this.boss.createQueue(GENERATION_QUEUE);
      this.started = true;
    } catch (error) {
      this.logger.error(error);
    }
  }

  async onModuleDestroy() {
    if (this.started) await this.boss.stop({ graceful: true });
  }

  get isStarted(): boolean {
    return this.started;
  }

  /**
   * Retry and timeout options travel with each job rather than living on the
   * queue, so a change in env applies to the next job without migrating the queue.
   */
  async enqueue(tx: Prisma.TransactionClient, generationId: string) {
    const data: GenerationJobData = { generationId };
    await this.boss.send(GENERATION_QUEUE, data, {
      db: fromPrisma(tx),
      retryLimit: this.env.GENERATION_RETRY_LIMIT,
      retryBackoff: true,
      expireInSeconds: this.env.GENERATION_TIMEOUT_SECONDS,
      heartbeatSeconds: this.env.GENERATION_HEARTBEAT_SECONDS,
      deadLetter: GENERATION_DEAD_LETTER_QUEUE,
    });
  }

  /** Runs `handler` for every job of `queue`, one at a time per queue. */
  async work(
    queue: typeof GENERATION_QUEUE | typeof GENERATION_DEAD_LETTER_QUEUE,
    handler: (job: GenerationJob) => Promise<void>,
  ) {
    await this.boss.work<GenerationJobData>(
      queue,
      { pollingIntervalSeconds: 1 },
      async ([job]) => {
        if (job) await handler(job);
      },
    );
  }
}
