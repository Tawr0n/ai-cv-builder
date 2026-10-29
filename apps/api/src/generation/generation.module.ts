import { Module } from '@nestjs/common';
import { SourceModule } from '../source/source.module.js';
import { GenerationQueue } from './generation-queue.js';
import { GenerationRunner } from './generation-runner.js';
import { GenerationWorker } from './generation-worker.js';
import { GenerationsService } from './generations.service.js';

@Module({
  imports: [SourceModule],
  providers: [
    GenerationQueue,
    GenerationsService,
    GenerationRunner,
    GenerationWorker,
  ],
  exports: [GenerationQueue, GenerationsService],
})
export class GenerationModule {}
