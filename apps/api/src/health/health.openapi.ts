import { healthSchema } from '@ai-cv-builder/shared';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { errorResponse } from '../openapi/error-response.js';

export function registerHealthDocs(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: 'get',
    path: '/api/health',
    tags: ['health'],
    summary: 'Check that the API, its database and its job queue are up',
    responses: {
      200: {
        description: 'The API and the database answer',
        content: { 'application/json': { schema: healthSchema } },
      },
      503: errorResponse('`database_unavailable` | `queue_unavailable`'),
    },
  });
}
