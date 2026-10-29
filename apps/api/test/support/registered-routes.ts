import type { TestApp } from './test-app.js';

interface ExpressLayer {
  route?: { path: string; methods: Record<string, boolean> };
}

/** Every route the app registered, as `METHOD /path` (e.g. `GET /api/cvs/:cvId`). */
export function registeredRoutes(testApp: TestApp): string[] {
  const router = (
    testApp.app.getHttpAdapter().getInstance() as {
      router: { stack: ExpressLayer[] };
    }
  ).router;
  return router.stack.flatMap(({ route }) =>
    route
      ? Object.keys(route.methods).map(
          (method) => `${method.toUpperCase()} ${route.path}`,
        )
      : [],
  );
}
