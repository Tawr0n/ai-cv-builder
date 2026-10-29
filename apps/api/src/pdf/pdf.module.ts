import { Module } from '@nestjs/common';
import { PdfRenderer } from './pdf-renderer.js';

@Module({
  providers: [PdfRenderer],
  exports: [PdfRenderer],
})
export class PdfModule {}
