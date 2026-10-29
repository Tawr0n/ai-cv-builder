import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ENV, type Env } from '../env/env.js';
import {
  GENERATION_DEAD_LETTER_QUEUE,
  GENERATION_QUEUE,
  GenerationQueue,
} from './generation-queue.js';
import { GenerationRunner } from './generation-runner.js';

/** Takes Generation jobs inside the API process (no separate worker container). */
@Injectable()
export class GenerationWorker implements OnApplicationBootstrap {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly queue: GenerationQueue,
    private readonly runner: GenerationRunner,
  ) {}

  async onApplicationBootstrap() {
    if (!this.env.GENERATION_WORKER || !this.queue.isStarted) return;
    await this.queue.work(GENERATION_QUEUE, (job) =>
      this.runner.run(job.data.generationId, job.signal),
    );
    await this.queue.work(GENERATION_DEAD_LETTER_QUEUE, (job) =>
      this.runner.markWorkerLost(job.data.generationId),
    );
  }
}
