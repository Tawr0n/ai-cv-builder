import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AiModule } from './ai/ai.module.js';
import { DatabaseModule } from './database/database.module.js';
import { EnvModule } from './env/env.module.js';
import { HealthModule } from './health/health.module.js';
import { ApiExceptionFilter } from './http/api-exception.filter.js';

@Module({
  imports: [EnvModule, DatabaseModule, AiModule, HealthModule],
  providers: [{ provide: APP_FILTER, useClass: ApiExceptionFilter }],
})
export class AppModule {}
