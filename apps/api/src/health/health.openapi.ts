import { apiErrorSchema, healthSchema } from '@ai-cv-builder/shared';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

export function registerHealthDocs(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: 'get',
    path: '/api/health',
    tags: ['health'],
    summary: 'Check that the API and its database are up',
    responses: {
      200: {
        description: 'The API and the database answer',
        content: { 'application/json': { schema: healthSchema } },
      },
      503: {
        description: '`database_unavailable`',
        content: { 'application/json': { schema: apiErrorSchema } },
      },
    },
  });
}
