import { apiErrorSchema } from '@ai-cv-builder/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('error envelope', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('answers an unknown route with 404 not_found', async () => {
    const response = await testApp.http().get('/api/nope').expect(404);

    expect(apiErrorSchema.parse(response.body)).toEqual({
      error: { code: 'not_found', message: 'Cannot GET /api/nope' },
    });
  });

  it('answers a malformed JSON body with 400 bad_request', async () => {
    const response = await testApp
      .http()
      .post('/api/health')
      .set('content-type', 'application/json')
      .send('{"email": ')
      .expect(400);

    expect(apiErrorSchema.parse(response.body).error.code).toBe('bad_request');
  });
});
