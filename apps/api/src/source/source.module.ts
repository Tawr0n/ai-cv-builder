import { Module } from '@nestjs/common';
import { PostgresSourceStorage } from './postgres-source-storage.js';
import { SourceStorage } from './source-storage.js';

@Module({
  providers: [{ provide: SourceStorage, useClass: PostgresSourceStorage }],
  exports: [SourceStorage],
})
export class SourceModule {}
