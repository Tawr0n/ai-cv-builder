import {
  createCvFieldsSchema,
  createCvResponseSchema,
  createGenerationSchema,
  cvListSchema,
  cvViewSchema,
  generationSchema,
  idempotencyKeySchema,
  questionListSchema,
} from '@ai-cv-builder/shared';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { errorResponse } from '../openapi/error-response.js';

const cvIdParams = z.object({ cvId: z.uuid() });
const json = <Schema extends z.ZodType>(schema: Schema) => ({
  content: { 'application/json': { schema } },
});

/** The multipart body as documentation: the server reads the fields with `createCvFieldsSchema`. */
const createCvBody = createCvFieldsSchema.extend({
  file: z
    .string()
    .optional()
    .meta({ format: 'binary', description: 'PDF ≤ 5 MB, ≤ 5 pages' }),
});

export function registerCvsDocs(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: 'get',
    path: '/api/cvs',
    tags: ['cvs'],
    summary: 'The signed-in User’s CVs, most recently updated first',
    responses: {
      200: {
        description: 'Only CVs owned by the signed-in User',
        ...json(cvListSchema),
      },
      401: errorResponse('`unauthenticated`'),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/cvs',
    tags: ['cvs'],
    summary: 'Create a CV from a PDF or free text and start generating it',
    description:
      'Send `targetRole` and exactly one of `file` or `text`. The PDF is checked before anything is stored.',
    request: {
      headers: z.object({ 'idempotency-key': idempotencyKeySchema }),
      body: {
        content: { 'multipart/form-data': { schema: createCvBody } },
      },
    },
    responses: {
      201: {
        description: 'The new CV; its first Generation is queued',
        ...json(createCvResponseSchema),
      },
      200: {
        description: 'A known `Idempotency-Key`: the CV it created earlier',
        ...json(createCvResponseSchema),
      },
      400: errorResponse('`validation_failed`'),
      401: errorResponse('`unauthenticated`'),
      403: errorResponse('`forbidden_origin`'),
      413: errorResponse('`file_too_large`'),
      415: errorResponse('`not_a_pdf`'),
      422: errorResponse(
        '`pdf_unreadable` | `pdf_encrypted` | `pdf_too_many_pages`',
      ),
      429: errorResponse(
        '`too_many_active_generations`: 3 CVs are already generating',
      ),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/cvs/{cvId}',
    tags: ['cvs'],
    summary: 'One CV: status, content once generated, latest Generation',
    request: { params: cvIdParams },
    responses: {
      200: { description: 'The CV', ...json(cvViewSchema) },
      401: errorResponse('`unauthenticated`'),
      404: errorResponse('`not_found`: missing or another User’s'),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/cvs/{cvId}/generation',
    tags: ['cvs'],
    summary: 'The CV’s latest Generation; poll it every 1–2 s',
    request: { params: cvIdParams },
    responses: {
      200: { description: 'The latest Generation', ...json(generationSchema) },
      401: errorResponse('`unauthenticated`'),
      404: errorResponse('`not_found`: missing or another User’s'),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/cvs/{cvId}/questions',
    tags: ['cvs'],
    summary:
      'The CV’s Questions about missing or vague things, most important first',
    description:
      'Each Question carries an Anchor: the section, item and field of the CV content it is about. Empty until a Generation succeeds.',
    request: { params: cvIdParams },
    responses: {
      200: { description: 'The Questions', ...json(questionListSchema) },
      401: errorResponse('`unauthenticated`'),
      404: errorResponse('`not_found`: missing or another User’s'),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/cvs/{cvId}/generations',
    tags: ['cvs'],
    summary: 'Try again after a failed Generation',
    description:
      'A new Generation with the same Source and Target role; Facts from the failed one are reused.',
    request: {
      params: cvIdParams,
      body: json(createGenerationSchema),
    },
    responses: {
      201: {
        description: 'The new, queued Generation',
        ...json(generationSchema),
      },
      400: errorResponse('`validation_failed`'),
      401: errorResponse('`unauthenticated`'),
      403: errorResponse('`forbidden_origin`'),
      404: errorResponse('`not_found`: missing or another User’s'),
      409: errorResponse('`generation_not_failed` | `generation_active`'),
      429: errorResponse('`too_many_active_generations`'),
    },
  });
}
