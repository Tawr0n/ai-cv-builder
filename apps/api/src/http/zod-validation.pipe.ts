import { HttpStatus, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { ApiException } from './api.exception.js';

/**
 * Validates a request part against a shared zod schema:
 * `@Body(new ZodValidationPipe(signupSchema)) body: Signup`.
 */
export class ZodValidationPipe<
  Schema extends z.ZodType,
> implements PipeTransform<unknown, z.output<Schema>> {
  constructor(private readonly schema: Schema) {}

  transform(value: unknown): z.output<Schema> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    throw new ApiException(
      HttpStatus.BAD_REQUEST,
      'validation_failed',
      'Request validation failed',
      result.error.issues.map(({ path, message }) => ({
        path: path.map((key) => (typeof key === 'symbol' ? String(key) : key)),
        message,
      })),
    );
  }
}
