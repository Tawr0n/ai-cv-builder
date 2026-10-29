import { Global, Module } from '@nestjs/common';
import { AnthropicCvAi } from './anthropic-cv-ai.js';
import { CvAi } from './cv-ai.js';

@Global()
@Module({
  providers: [{ provide: CvAi, useClass: AnthropicCvAi }],
  exports: [CvAi],
})
export class AiModule {}
