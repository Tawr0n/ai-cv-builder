import type { Health } from '@ai-cv-builder/shared';
import { Controller, Get, HttpStatus } from '@nestjs/common';
import { Public } from '../auth/public.decorator.js';
import { PrismaService } from '../database/prisma.service.js';
import { GenerationQueue } from '../generation/generation-queue.js';
import { ApiException } from '../http/api.exception.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: GenerationQueue,
  ) {}

  @Public()
  @Get()
  async check(): Promise<Health> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'database_unavailable',
        'The database is not reachable',
      );
    }
    if (!this.queue.isStarted) {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'queue_unavailable',
        'The Generation queue did not start',
      );
    }
    return { status: 'ok', database: 'ok' };
  }
}
