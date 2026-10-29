import type { Health } from '@ai-cv-builder/shared';
import { Controller, Get, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { ApiException } from '../http/api.exception.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

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
    return { status: 'ok', database: 'ok' };
  }
}
