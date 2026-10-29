import { z } from 'zod';
import { cvContentSchema } from './cv-content.js';
import { lineField, textField } from './text.js';

export const TARGET_ROLE_LIMITS = { min: 2, max: 100 } as const;
export const SOURCE_TEXT_LIMITS = { min: 50, max: 20_000 } as const;
/** Defaults of the PDF upload limits; the API may override them from env. */
export const PDF_LIMITS = { maxBytes: 5 * 1024 * 1024, maxPages: 5 } as const;

export const CV_STATUSES = ['generating', 'ready', 'failed'] as const;
export const GENERATION_KINDS = ['initial'] as const;
export const GENERATION_STATUSES = [
  'queued',
  'running',
  'succeeded',
  'failed',
] as const;
/** The step a `running` Generation is on. */
export const GENERATION_STEPS = ['extract', 'compose'] as const;
/** Why a Generation failed; stable, so the UI picks its message by it. */
export const GENERATION_ERROR_CODES = [
  'ai_unavailable',
  'invalid_ai_output',
  'unreadable_source',
  'timed_out',
  'worker_lost',
  'internal',
] as const;

export const cvStatusSchema = z.enum(CV_STATUSES).meta({ id: 'CvStatus' });

/** The `Idempotency-Key` header of `POST /api/cvs`: the create form mints one when it opens. */
export const idempotencyKeySchema = z.uuid();

/**
 * The text fields of the multipart `POST /api/cvs`. The Source is exactly one
 * of `text` (here) or a PDF in the `file` part.
 */
export const createCvFieldsSchema = z
  .strictObject({
    targetRole: lineField(TARGET_ROLE_LIMITS.min, TARGET_ROLE_LIMITS.max),
    text: textField(SOURCE_TEXT_LIMITS.min, SOURCE_TEXT_LIMITS.max).optional(),
  })
  .meta({ id: 'CreateCvFields' });

export const createCvResponseSchema = z
  .object({ cvId: z.uuid() })
  .meta({ id: 'CreatedCv' });

export const generationSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(GENERATION_KINDS),
    status: z.enum(GENERATION_STATUSES),
    step: z.enum(GENERATION_STEPS).nullable(),
    errorCode: z.enum(GENERATION_ERROR_CODES).nullable(),
    createdAt: z.iso.datetime(),
    finishedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'Generation' });

/** `POST /api/cvs/:cvId/generations`: `initial` is Try again after a failed Generation. */
export const createGenerationSchema = z
  .strictObject({ kind: z.literal('initial') })
  .meta({ id: 'CreateGeneration' });

export const cvListItemSchema = z
  .object({
    id: z.uuid(),
    targetRole: z.string(),
    status: cvStatusSchema,
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'CvListItem' });

export const cvListSchema = z
  .object({ items: z.array(cvListItemSchema) })
  .meta({ id: 'CvList' });

/** Everything the CV page needs; `content` is `null` until a Generation succeeds. */
export const cvViewSchema = z
  .object({
    id: z.uuid(),
    targetRole: z.string(),
    status: cvStatusSchema,
    content: cvContentSchema.nullable(),
    latestGeneration: generationSchema,
  })
  .meta({ id: 'CvView' });

export type CvStatus = z.infer<typeof cvStatusSchema>;
export type CreateCvFields = z.infer<typeof createCvFieldsSchema>;
export type CreateCvResponse = z.infer<typeof createCvResponseSchema>;
export type Generation = z.infer<typeof generationSchema>;
export type GenerationStep = (typeof GENERATION_STEPS)[number];
export type GenerationErrorCode = (typeof GENERATION_ERROR_CODES)[number];
export type CreateGeneration = z.infer<typeof createGenerationSchema>;
export type CvListItem = z.infer<typeof cvListItemSchema>;
export type CvList = z.infer<typeof cvListSchema>;
export type CvView = z.infer<typeof cvViewSchema>;
