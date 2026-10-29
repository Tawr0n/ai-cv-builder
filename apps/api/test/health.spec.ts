import { apiErrorSchema, healthSchema } from '@ai-cv-builder/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('GET /api/health', () => {
  let testApp: TestApp | undefined;

  afterEach(async () => {
    await testApp?.app.close();
  });

  it('reports ok when the database answers', async () => {
    testApp = await createTestApp();

    const response = await testApp.http().get('/api/health').expect(200);

    expect(healthSchema.parse(response.body)).toEqual({
      status: 'ok',
      database: 'ok',
    });
  });

  it('answers 503 database_unavailable when the database does not', async () => {
    testApp = await createTestApp({
      DATABASE_URL: 'postgresql://cv:cv@127.0.0.1:1/cv',
    });

    const response = await testApp.http().get('/api/health').expect(503);

    expect(apiErrorSchema.parse(response.body).error.code).toBe(
      'database_unavailable',
    );
  });
});
