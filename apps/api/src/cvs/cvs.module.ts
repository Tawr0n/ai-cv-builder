import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ENV, type Env } from '../env/env.js';
import { GenerationModule } from '../generation/generation.module.js';
import { SourceModule } from '../source/source.module.js';
import { CvItemsController } from './cv-items.controller.js';
import { CvItemsService } from './cv-items.service.js';
import { CvsController } from './cvs.controller.js';
import { CvsService } from './cvs.service.js';

@Module({
  imports: [
    GenerationModule,
    SourceModule,
    // Memory storage (no `dest`): the PDF goes straight to SourceStorage.
    MulterModule.registerAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        limits: { fileSize: env.PDF_MAX_BYTES, files: 1 },
      }),
    }),
  ],
  controllers: [CvsController, CvItemsController],
  providers: [CvsService, CvItemsService],
})
export class CvsModule {}
