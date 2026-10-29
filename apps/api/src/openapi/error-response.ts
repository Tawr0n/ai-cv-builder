import { apiErrorSchema } from '@ai-cv-builder/shared';

/** A documented non-2xx answer: always the shared error envelope. */
export const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: apiErrorSchema } },
});
