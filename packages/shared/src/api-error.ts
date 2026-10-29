import { z } from 'zod';

/** One problem found while validating a request, e.g. `{ path: ['email'], message: 'Invalid email' }`. */
export const validationIssueSchema = z
  .object({
    path: z.array(z.union([z.string(), z.number()])),
    message: z.string(),
  })
  .meta({ id: 'ValidationIssue' });

/**
 * The one shape every non-2xx API response has. `code` is stable and meant for
 * code (`validation_failed`, `not_found`, ...); `message` is English for humans.
 */
export const apiErrorSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      issues: z.array(validationIssueSchema).optional(),
      /** `item_conflict`: the item as it is stored now, so the UI can show "changed on another device". */
      current: z.unknown().optional(),
      /** `version_conflict`: the ids of the section in their current order, and the CV's current `version`. */
      order: z.array(z.uuid()).optional(),
      version: z.int().optional(),
    }),
  })
  .meta({ id: 'ApiError' });

export type ValidationIssue = z.infer<typeof validationIssueSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
