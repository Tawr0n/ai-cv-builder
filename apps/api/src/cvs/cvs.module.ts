import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ENV, type Env } from '../env/env.js';
import { GenerationModule } from '../generation/generation.module.js';
import { CvsController } from './cvs.controller.js';
import { CvsService } from './cvs.service.js';

@Module({
  imports: [
    GenerationModule,
    // Memory storage (no `dest`): the PDF goes straight into Postgres.
    MulterModule.registerAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        limits: { fileSize: env.PDF_MAX_BYTES, files: 1 },
      }),
    }),
  ],
  controllers: [CvsController],
  providers: [CvsService],
})
export class CvsModule {}
