/**
 * `pnpm smoke:live`: the injection-carrying fixture PDF through the REAL
 * pipeline (Claude API, real prompts) against a throwaway Postgres. PAID: it
 * spends money on the key in `ANTHROPIC_API_KEY` on every run. Never run by
 * vitest or CI; run it by hand after changing prompts or the adapter.
 *
 * It checks structure only, never wording: the Generation succeeds, the CV
 * content passes its schema, every item cites existing Facts, no injected
 * assertion reaches the CV, and every Question's Anchor points at the CV.
 */
import {
  cvContentSchema,
  cvViewSchema,
  questionListSchema,
} from '@ai-cv-builder/shared';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { z } from 'zod';
import { factSchema } from '../src/ai/cv-ai.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { GenerationRunner } from '../src/generation/generation-runner.js';
import { INJECTION_MARKERS, injectionCvPdf } from './injection-cv.js';

const failures: string[] = [];
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? '✓' : '✗'} ${what}`);
  if (!ok) failures.push(what);
};

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set (put it into the root .env).');
  process.exit(1);
}

const container = await new PostgreSqlContainer('postgres:18').start();
let app: NestExpressApplication | undefined;
try {
  process.env.DATABASE_URL = container.getConnectionUri();
  // The handler runs below, in this process; no worker takes the job.
  process.env.GENERATION_WORKER = 'false';
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    stdio: 'ignore',
  });

  app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  configureApp(app);
  await app.init();

  const agent = request.agent(app.getHttpServer());
  await agent
    .post('/api/auth/signup')
    .send({ email: `${randomUUID()}@example.com`, password: randomUUID() })
    .expect(201);
  const created = await agent
    .post('/api/cvs')
    .set('idempotency-key', randomUUID())
    .field('targetRole', 'Senior Backend Engineer')
    .attach('file', await injectionCvPdf(), {
      filename: 'injection-cv.pdf',
      contentType: 'application/pdf',
    })
    .expect(201);
  const cvId = created.body.cvId as string;

  const prisma = app.get(PrismaService);
  const { id: generationId } = await prisma.generation.findFirstOrThrow({
    where: { cvId },
  });
  const started = Date.now();
  await app.get(GenerationRunner).run(generationId);
  console.log(`Generation took ${Math.round((Date.now() - started) / 1000)} s`);

  const view = cvViewSchema.parse((await agent.get(`/api/cvs/${cvId}`)).body);
  check(
    view.latestGeneration.status === 'succeeded',
    `Generation succeeded (${view.latestGeneration.status} ${view.latestGeneration.errorCode ?? ''})`,
  );
  const content = cvContentSchema.safeParse(view.content);
  check(content.success, 'CV content passes its schema, limits included');

  if (content.success) {
    const cv = await prisma.cv.findUniqueOrThrow({ where: { id: cvId } });
    const factIds = new Set(
      z
        .array(factSchema)
        .parse(cv.facts)
        .map((f) => f.id),
    );
    const { contact, summary, experience, education, skills } = content.data;
    const items = [
      contact,
      summary,
      ...experience,
      ...experience.flatMap((e) => e.bullets),
      ...education,
      ...skills,
    ];
    // Every list item says something, so it must cite at least one Fact.
    const listItems = items.filter((item) => 'id' in item);
    check(
      items.every((item) =>
        item.sourceFactIds.every((id) => factIds.has(id)),
      ) && listItems.every((item) => item.sourceFactIds.length > 0),
      `every item cites existing Facts (${factIds.size} Facts)`,
    );

    const text = JSON.stringify(content.data);
    const leaked = INJECTION_MARKERS.filter((marker) => marker.test(text));
    check(
      leaked.length === 0,
      `no injected assertion in the CV${leaked.length ? `: ${leaked.join(', ')}` : ''}`,
    );

    const questions = questionListSchema.parse(
      (await agent.get(`/api/cvs/${cvId}/questions`)).body,
    ).items;
    const itemIds = new Set(
      items.flatMap((item) => ('id' in item ? [item.id] : [])),
    );
    check(
      questions.every(
        ({ anchor }) => anchor.itemId === null || itemIds.has(anchor.itemId),
      ),
      `every Question is anchored to the CV (${questions.length} Questions)`,
    );
    for (const question of questions) {
      const { section, field } = question.anchor;
      console.log(
        `  ? [${section}${field ? `.${field}` : ''}] ${question.text}`,
      );
    }
  }
} finally {
  await app?.close();
  await container.stop();
}

if (failures.length > 0) {
  console.error(`\nsmoke:live FAILED: ${failures.length} check(s)`);
  process.exit(1);
}
console.log('\nsmoke:live passed');
