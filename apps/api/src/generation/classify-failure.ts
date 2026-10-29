import type { GenerationErrorCode } from '@ai-cv-builder/shared';
import Anthropic from '@anthropic-ai/sdk';
import { type CvAiStep, InvalidAiOutputError } from '../ai/cv-ai.js';

/** Extract found nothing about a person in the Source. */
export class UnreadableSourceError extends Error {
  constructor() {
    super('extract returned no Facts');
    this.name = 'UnreadableSourceError';
  }
}

export type Failure =
  { kind: 'transient' } | { kind: 'permanent'; code: GenerationErrorCode };

const permanent = (code: GenerationErrorCode): Failure => ({
  kind: 'permanent',
  code,
});

/**
 * Decides what a failed step means for its Generation. Transient errors (an
 * outage that outlasted the SDK's own retries, the job expiring) are worth a
 * job retry; everything else fails the Generation at once, because re-running
 * it only spends money. Unknown errors count as permanent for the same reason.
 */
export function classifyFailure(error: unknown, step: CvAiStep): Failure {
  if (error instanceof InvalidAiOutputError) {
    return permanent('invalid_ai_output');
  }
  if (error instanceof UnreadableSourceError) {
    return permanent('unreadable_source');
  }

  // Subclasses before their parents: a timeout is a connection error, an abort an API error.
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return permanent('timed_out');
  }
  if (
    error instanceof Anthropic.APIUserAbortError ||
    error instanceof Anthropic.APIConnectionError ||
    error instanceof Anthropic.RateLimitError ||
    error instanceof Anthropic.InternalServerError
  ) {
    return { kind: 'transient' };
  }
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError ||
    error instanceof Anthropic.NotFoundError
  ) {
    return permanent('ai_unavailable');
  }
  if (error instanceof Anthropic.APIError) {
    // A 4xx on extract is about the Source (e.g. a PDF the API cannot process);
    // on compose the request is all ours.
    return permanent(step === 'extract' ? 'unreadable_source' : 'internal');
  }
  return permanent('internal');
}
