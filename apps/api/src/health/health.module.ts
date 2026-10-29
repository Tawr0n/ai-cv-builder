import { Module } from '@nestjs/common';
import { GenerationModule } from '../generation/generation.module.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [GenerationModule],
  controllers: [HealthController],
})
export class HealthModule {}
