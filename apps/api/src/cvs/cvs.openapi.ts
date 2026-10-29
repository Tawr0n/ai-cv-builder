import { apiErrorSchema, cvListSchema } from '@ai-cv-builder/shared';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

export function registerCvsDocs(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: 'get',
    path: '/api/cvs',
    tags: ['cvs'],
    summary: 'The signed-in User’s CVs',
    responses: {
      200: {
        description: 'Only CVs owned by the signed-in User',
        content: { 'application/json': { schema: cvListSchema } },
      },
      401: {
        description: '`unauthenticated`',
        content: { 'application/json': { schema: apiErrorSchema } },
      },
    },
  });
}
