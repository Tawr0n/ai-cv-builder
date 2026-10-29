import { Module } from '@nestjs/common';
import { CvsController } from './cvs.controller.js';
import { CvsService } from './cvs.service.js';

@Module({
  controllers: [CvsController],
  providers: [CvsService],
})
export class CvsModule {}
