import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('API docs', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('serves the OpenAPI document generated from the shared schemas', async () => {
    const response = await testApp
      .http()
      .get('/api/docs/openapi.json')
      .expect(200);

    expect(response.body).toMatchObject({
      openapi: '3.1.0',
      paths: {
        '/api/health': {
          get: {
            responses: {
              200: {
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Health' },
                  },
                },
              },
              503: {
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ApiError' },
                  },
                },
              },
            },
          },
        },
      },
    });
  });

  it('serves Swagger UI at /api/docs', async () => {
    const response = await testApp.http().get('/api/docs/').expect(200);

    expect(response.text).toContain('swagger-ui');
  });
});
