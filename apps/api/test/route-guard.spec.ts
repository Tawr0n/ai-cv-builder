import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registeredRoutes } from './support/registered-routes.js';
import { createTestApp, type TestApp } from './support/test-app.js';

/** Routes a visitor may call without a session. Everything else must answer 401. */
const PUBLIC_ROUTES = [
  'GET /api/health',
  'POST /api/auth/signup',
  'POST /api/auth/login',
];

describe('closed by default', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('answers 401 to every registered route without a session, except the allowlist', async () => {
    const routes = registeredRoutes(testApp);
    // Guards the guard test itself: if route discovery breaks, fail loudly.
    expect(routes).toContain('GET /api/cvs');

    const protectedRoutes = routes.filter(
      (route) => !PUBLIC_ROUTES.includes(route),
    );
    const statuses: Record<string, number> = {};
    for (const route of protectedRoutes) {
      const [method, path] = route.split(' ') as [string, string];
      const url = path.replace(/:\w+/g, '00000000-0000-0000-0000-000000000000');
      const response = await testApp.http()[method.toLowerCase() as 'get'](url);
      statuses[route] = response.status;
    }

    expect(statuses).toEqual(
      Object.fromEntries(protectedRoutes.map((route) => [route, 401])),
    );
  });

  it('lists exactly the allowlisted routes as registered', () => {
    const routes = registeredRoutes(testApp);

    for (const route of PUBLIC_ROUTES) expect(routes).toContain(route);
  });
});
