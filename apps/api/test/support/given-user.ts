import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { TestApp } from './test-app.js';

export const TEST_PASSWORD = 'correct horse battery';

/**
 * Signs up a fresh User through the real endpoint and returns a supertest agent
 * that carries their session cookie.
 */
export async function givenUser(
  testApp: TestApp,
  { email = `${randomUUID()}@example.com`, password = TEST_PASSWORD } = {},
) {
  const agent = request.agent(testApp.app.getHttpServer());
  const response = await agent
    .post('/api/auth/signup')
    .send({ email, password })
    .expect(201);
  return { agent, email, password, user: response.body as { id: string } };
}
