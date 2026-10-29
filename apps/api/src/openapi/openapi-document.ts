import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from '@asteasolutions/zod-to-openapi';
import { registerHealthDocs } from '../health/health.openapi.js';

/** The REST contract, generated from the zod schemas in `@ai-cv-builder/shared`. */
export function buildOpenApiDocument() {
  const registry = new OpenAPIRegistry();
  registerHealthDocs(registry);

  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: { title: 'AI CV Builder API', version: '0.0.0' },
  });
}
