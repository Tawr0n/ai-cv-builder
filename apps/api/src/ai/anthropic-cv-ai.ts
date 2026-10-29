import { Injectable } from '@nestjs/common';
import { CvAi, type CvAiStep } from './cv-ai.js';

/** {@link CvAi} backed by the Claude API. Every call costs money. */
@Injectable()
export class AnthropicCvAi extends CvAi {
  extract() {
    return notBuiltYet('extract');
  }

  compose() {
    return notBuiltYet('compose');
  }

  judge() {
    return notBuiltYet('judge');
  }

  repair() {
    return notBuiltYet('repair');
  }
}

function notBuiltYet(step: CvAiStep): Promise<never> {
  return Promise.reject(new Error(`CvAi.${step} is not implemented yet`));
}
