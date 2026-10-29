import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { InvalidAiOutputError } from '../ai/cv-ai.js';
import { classifyFailure, UnreadableSourceError } from './classify-failure.js';

const headers = new Headers();
const apiError = (status: number) =>
  Anthropic.APIError.generate(status, undefined, `HTTP ${status}`, headers);

describe('classifyFailure', () => {
  describe('transient: rethrown for a job retry', () => {
    it.each([
      ['429 after the SDK retries', apiError(429)],
      ['500 after the SDK retries', apiError(500)],
      ['529 overloaded', apiError(529)],
      [
        'a dropped connection',
        new Anthropic.APIConnectionError({ message: 'reset' }),
      ],
      ['the job expiring mid-call', new Anthropic.APIUserAbortError()],
    ])('%s', (_case, error) => {
      expect(classifyFailure(error, 'compose')).toEqual({ kind: 'transient' });
    });
  });

  describe('permanent: the Generation fails at once', () => {
    it.each([
      ['a bad API key', apiError(401), 'compose', 'ai_unavailable'],
      ['no access to the model', apiError(403), 'compose', 'ai_unavailable'],
      ['an unknown model', apiError(404), 'compose', 'ai_unavailable'],
      [
        'a Source the model cannot read',
        apiError(400),
        'extract',
        'unreadable_source',
      ],
      ['a request we built wrong', apiError(400), 'compose', 'internal'],
      [
        'a call that timed out',
        new Anthropic.APIConnectionTimeoutError(),
        'compose',
        'timed_out',
      ],
      [
        'output still unusable after the step retry',
        new InvalidAiOutputError('compose', 'uncited'),
        'compose',
        'invalid_ai_output',
      ],
      [
        'a Source with no Facts in it',
        new UnreadableSourceError(),
        'extract',
        'unreadable_source',
      ],
      ['a bug of ours', new TypeError('x is undefined'), 'compose', 'internal'],
    ] as const)('%s → %s', (_case, error, step, code) => {
      expect(classifyFailure(error, step)).toEqual({ kind: 'permanent', code });
    });
  });
});
