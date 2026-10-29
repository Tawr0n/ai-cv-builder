import {
  addBulletSchema,
  addEmptyItemSchema,
  addSkillSchema,
  createCvFieldsSchema,
  createCvResponseSchema,
  createGenerationSchema,
  cvItemSchema,
  cvListSchema,
  itemSectionSchema,
  cvViewSchema,
  generationSchema,
  idempotencyKeySchema,
  itemIdSchema,
  moveItemSchema,
  patchItemSchema,
  removeItemQuerySchema,
  answerQuestionSchema,
  questionListSchema,
  questionSchema,
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
    path: '/api/cvs/{cvId}/pdf',
    tags: ['cvs'],
    summary: 'The CV as an A4 PDF with selectable text',
    description:
      'Rendered on demand from the stored content, never cached; at most 2 renders run at once and a render is cut off after 15 s.',
    request: { params: cvIdParams },
    responses: {
      200: {
        description: 'The PDF, as an attachment',
        content: {
          'application/pdf': { schema: z.string().meta({ format: 'binary' }) },
        },
      },
      401: errorResponse('`unauthenticated`'),
      404: errorResponse('`not_found`: missing or another User’s'),
      409: errorResponse('`cv_not_ready`: no content yet'),
      503: errorResponse('`pdf_render_failed`'),
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

  const itemParams = cvIdParams.extend({ itemId: itemIdSchema });
  const notFound = errorResponse('`not_found`: missing or another User’s');
  const notReady = errorResponse('`cv_not_ready`: no content generated yet');

  registry.registerPath({
    method: 'patch',
    path: '/api/cvs/{cvId}/items/{itemId}',
    tags: ['cvs'],
    summary: 'Edit fields of one item (autosave, one call per field blur)',
    description:
      'Send the item’s current `rev` and only the fields that changed. `itemId` is an item’s UUID or the reserved `contact` / `summary`. The item becomes an Edited item and its `rev` goes up; the AI never rewrites an Edited item.',
    request: { params: itemParams, body: json(patchItemSchema) },
    responses: {
      200: {
        description: 'The item with its new `rev`',
        ...json(cvItemSchema),
      },
      400: errorResponse('`validation_failed`'),
      401: errorResponse('`unauthenticated`'),
      403: errorResponse('`forbidden_origin`'),
      404: notFound,
      409: errorResponse(
        '`item_conflict`: stale `rev`, `error.current` is the item as stored | `cv_not_ready`',
      ),
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/api/cvs/{cvId}/items/{itemId}',
    tags: ['cvs'],
    summary: 'Remove an experience, education entry, skill or bullet',
    description:
      'Pass the removed item’s own `rev` as a query parameter. Items after it shift up, so the CV `version` goes up. `contact` and `summary` cannot be removed.',
    request: { params: itemParams, query: removeItemQuerySchema },
    responses: {
      200: { description: 'The CV after the removal', ...json(cvViewSchema) },
      400: errorResponse('`validation_failed`: also for `contact` / `summary`'),
      401: errorResponse('`unauthenticated`'),
      403: errorResponse('`forbidden_origin`'),
      404: notFound,
      409: errorResponse('`item_conflict`: stale `rev` | `cv_not_ready`'),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/cvs/{cvId}/items/{itemId}/move',
    tags: ['cvs'],
    summary: 'Move an experience or education entry one place up or down',
    description:
      'Send the CV `version` you loaded: the order is shared by the whole section. At either end nothing changes.',
    request: { params: itemParams, body: json(moveItemSchema) },
    responses: {
      200: { description: 'The CV with the new order', ...json(cvViewSchema) },
      400: errorResponse(
        '`validation_failed`: only experience and education move',
      ),
      401: errorResponse('`unauthenticated`'),
      403: errorResponse('`forbidden_origin`'),
      404: notFound,
      409: errorResponse(
        '`version_conflict`: `error.order` and `error.version` are current | `cv_not_ready`',
      ),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/cvs/{cvId}/sections/{section}/items',
    tags: ['cvs'],
    summary: 'Add an item at the end of a section',
    description:
      'Experience and education are added empty (send `{}`); a skill needs its `name`. No `rev` is needed: appending does not conflict with other edits.',
    request: {
      params: cvIdParams.extend({ section: itemSectionSchema }),
      body: json(z.union([addEmptyItemSchema, addSkillSchema])),
    },
    responses: {
      201: { description: 'The CV with the new item', ...json(cvViewSchema) },
      400: errorResponse('`validation_failed`'),
      401: errorResponse('`unauthenticated`'),
      403: errorResponse('`forbidden_origin`'),
      404: notFound,
      409: notReady,
      422: errorResponse('`limit_reached`: the section is full'),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/cvs/{cvId}/items/{experienceId}/bullets',
    tags: ['cvs'],
    summary: 'Add a bullet to an experience',
    description: 'The experience’s own `rev` does not change.',
    request: {
      params: cvIdParams.extend({ experienceId: z.uuid() }),
      body: json(addBulletSchema),
    },
    responses: {
      201: { description: 'The CV with the new bullet', ...json(cvViewSchema) },
      400: errorResponse('`validation_failed`'),
      401: errorResponse('`unauthenticated`'),
      403: errorResponse('`forbidden_origin`'),
      404: notFound,
      409: notReady,
      422: errorResponse('`limit_reached`: the experience is full'),
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

  const questionParams = cvIdParams.extend({ questionId: z.uuid() });
  const questionChange = {
    200: { description: 'The Question as it is now', ...json(questionSchema) },
    401: errorResponse('`unauthenticated`'),
    403: errorResponse('`forbidden_origin`'),
    404: errorResponse('`not_found`: missing or another User’s'),
    409: errorResponse(
      '`question_locked`: a running Update CV is applying its Answer | `question_closed`: not in a state that allows this',
    ),
  };

  registry.registerPath({
    method: 'put',
    path: '/api/cvs/{cvId}/questions/{questionId}/answer',
    tags: ['cvs'],
    summary: 'Save a pending Answer, or change one',
    description:
      'The Question becomes `answered` with `appliedAt` null: the Answer stays editable until Update CV (`POST …/generations` with `kind: answer`) turns it into a Fact. An open Question or a pending Answer can be (re)answered.',
    request: { params: questionParams, body: json(answerQuestionSchema) },
    responses: {
      ...questionChange,
      400: errorResponse('`validation_failed`'),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/cvs/{cvId}/questions/{questionId}/dismiss',
    tags: ['cvs'],
    summary: '“Not relevant”: dismiss an open Question or a pending Answer',
    description: 'A pending Answer is dropped. Undo with `…/reopen`.',
    request: { params: questionParams },
    responses: questionChange,
  });

  registry.registerPath({
    method: 'post',
    path: '/api/cvs/{cvId}/questions/{questionId}/reopen',
    tags: ['cvs'],
    summary: 'Undo a dismissal: the Question is open again',
    request: { params: questionParams },
    responses: questionChange,
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
