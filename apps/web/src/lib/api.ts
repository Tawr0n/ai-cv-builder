import { apiErrorSchema, type ApiError } from '@ai-cv-builder/shared';
import type { z } from 'zod';

/** A non-2xx answer from the API, carrying its stable error `code`. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly error: ApiError['error'],
  ) {
    super(error.message);
  }
}

/** Calls the API through the Next.js `/api/*` rewrite and parses the answer with a shared schema. */
export async function apiGet<Schema extends z.ZodType>(
  path: `/api/${string}`,
  schema: Schema,
): Promise<z.output<Schema>> {
  const response = await fetch(path, {
    headers: { accept: 'application/json' },
  });
  const body: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(body);
    throw new ApiRequestError(
      response.status,
      parsed.success
        ? parsed.data.error
        : { code: 'unexpected_response', message: response.statusText },
    );
  }
  return schema.parse(body);
}
