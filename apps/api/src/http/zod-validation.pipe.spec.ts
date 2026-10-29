import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApiException } from './api.exception.js';
import { ZodValidationPipe } from './zod-validation.pipe.js';

const pipe = new ZodValidationPipe(
  z.strictObject({ email: z.email(), age: z.coerce.number().int() }),
);

function rejectionOf(value: unknown): ApiException {
  try {
    pipe.transform(value);
  } catch (error) {
    if (error instanceof ApiException) return error;
    throw error;
  }
  throw new Error('expected the pipe to reject the value');
}

describe('ZodValidationPipe', () => {
  it('returns the parsed value', () => {
    expect(pipe.transform({ email: 'a@b.co', age: '30' })).toEqual({
      email: 'a@b.co',
      age: 30,
    });
  });

  it('rejects with 400 validation_failed and one issue per problem', () => {
    const rejection = rejectionOf({ email: 'nope', extra: true });

    expect(rejection.getStatus()).toBe(400);
    expect(rejection.code).toBe('validation_failed');
    expect(rejection.issues?.map((issue) => issue.path)).toEqual([
      ['email'],
      ['age'],
      [],
    ]);
  });
});
