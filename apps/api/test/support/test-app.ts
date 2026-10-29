import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CvAi } from '../../src/ai/cv-ai.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/configure-app.js';
import { ENV, parseEnv } from '../../src/env/env.js';
import { ScriptedCvAi } from './scripted-cv-ai.js';

/**
 * The real app, wired exactly as `main.ts` wires it, against the test Postgres.
 * The model is always the strict {@link ScriptedCvAi}: script it through `cvAi`.
 * `env` overrides single variables of the process environment for this app only.
 */
export async function createTestApp(env: Record<string, string> = {}) {
  const cvAi = new ScriptedCvAi();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(ENV)
    .useValue(parseEnv({ ...process.env, ...env }))
    .overrideProvider(CvAi)
    .useValue(cvAi)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: false,
  });
  configureApp(app);
  await app.init();

  return {
    app,
    cvAi,
    http: () => request(app.getHttpServer()),
  };
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;
