import {
  apiErrorSchema,
  cvViewSchema,
  generationSchema,
} from '@ai-cv-builder/shared';
import Anthropic from '@anthropic-ai/sdk';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/database/prisma.service.js';
import { GenerationRunner } from '../src/generation/generation-runner.js';
import {
  composeOutput,
  extractOutput,
  noFindings,
} from './support/cv-ai-fixtures.js';
import { postCv, SAMPLE_TEXT_SOURCE } from './support/create-cv.js';
import { givenUser } from './support/given-user.js';
import { registeredRoutes } from './support/registered-routes.js';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('/api/cvs/:cvId routes', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterEach(() => {
    testApp.cvAi.assertAllConsumed();
    testApp.cvAi.reset();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  const prisma = () => testApp.app.get(PrismaService);
  const runner = () => testApp.app.get(GenerationRunner);

  async function givenCv() {
    const owner = await givenUser(testApp);
    const created = await postCv(owner.agent, {
      text: SAMPLE_TEXT_SOURCE,
    }).expect(201);
    const cvId = created.body.cvId as string;
    const { id: generationId } = await prisma().generation.findFirstOrThrow({
      where: { cvId },
    });
    return { ...owner, cvId, generationId };
  }

  /** A CV whose first Generation got its Facts, then failed for good on compose. */
  async function givenFailedCv() {
    const cv = await givenCv();
    testApp.cvAi
      .returns('extract', extractOutput())
      .throws(
        'compose',
        Anthropic.APIError.generate(401, undefined, 'bad key', new Headers()),
      );
    await runner().run(cv.generationId);
    return cv;
  }

  describe('GET /api/cvs/:cvId', () => {
    it('shows a generating CV without content, with its latest Generation', async () => {
      const { agent, cvId } = await givenCv();

      const response = await agent.get(`/api/cvs/${cvId}`).expect(200);

      expect(cvViewSchema.parse(response.body)).toMatchObject({
        id: cvId,
        status: 'generating',
        content: null,
        latestGeneration: { status: 'queued' },
      });
    });
  });

  describe('GET /api/cvs/:cvId/generation', () => {
    it('reports the step a running Generation is on', async () => {
      const { agent, cvId, generationId } = await givenCv();
      testApp.cvAi.runs('extract', async () => {
        const polled = await agent
          .get(`/api/cvs/${cvId}/generation`)
          .expect(200);
        expect(generationSchema.parse(polled.body)).toMatchObject({
          status: 'running',
          step: 'extract',
        });
        return extractOutput();
      });
      testApp.cvAi
        .returns('compose', composeOutput())
        .returns('judge', noFindings());

      await runner().run(generationId);

      const done = await agent.get(`/api/cvs/${cvId}/generation`).expect(200);
      expect(generationSchema.parse(done.body)).toMatchObject({
        status: 'succeeded',
        step: null,
      });
    });

    it('reports a failure by its stable errorCode', async () => {
      const { agent, cvId } = await givenFailedCv();

      const response = await agent
        .get(`/api/cvs/${cvId}/generation`)
        .expect(200);

      expect(generationSchema.parse(response.body)).toMatchObject({
        status: 'failed',
        errorCode: 'ai_unavailable',
      });
    });
  });

  describe('POST /api/cvs/:cvId/generations (Try again)', () => {
    it('starts a new Generation that reuses the Facts of the failed one', async () => {
      const { agent, cvId } = await givenFailedCv();

      const response = await agent
        .post(`/api/cvs/${cvId}/generations`)
        .send({ kind: 'initial' })
        .expect(201);

      const retry = generationSchema.parse(response.body);
      expect(retry).toMatchObject({ kind: 'initial', status: 'queued' });
      const view = cvViewSchema.parse(
        (await agent.get(`/api/cvs/${cvId}`)).body,
      );
      expect(view).toMatchObject({
        status: 'generating',
        latestGeneration: { id: retry.id },
      });

      testApp.cvAi
        .returns('compose', composeOutput())
        .returns('judge', noFindings());
      await runner().run(retry.id);

      expect(testApp.cvAi.calls.extract).toHaveLength(1);
      expect(
        cvViewSchema.parse((await agent.get(`/api/cvs/${cvId}`)).body).status,
      ).toBe('ready');
    });

    it('answers 409 unless the latest Generation failed', async () => {
      const { agent, cvId } = await givenCv();

      const response = await agent
        .post(`/api/cvs/${cvId}/generations`)
        .send({ kind: 'initial' })
        .expect(409);

      expect(apiErrorSchema.parse(response.body).error.code).toBe(
        'generation_not_failed',
      );
    });

    it('rejects an unknown kind with 400', async () => {
      const { agent, cvId } = await givenFailedCv();

      const response = await agent
        .post(`/api/cvs/${cvId}/generations`)
        .send({ kind: 'answer' })
        .expect(400);

      expect(apiErrorSchema.parse(response.body).error.code).toBe(
        'validation_failed',
      );
    });
  });

  describe('ownership', () => {
    /** Each route under one CV, with what a valid request to it sends. */
    const CV_ROUTES: Record<string, { body?: object }> = {
      'GET /api/cvs/:cvId': {},
      'GET /api/cvs/:cvId/generation': {},
      'GET /api/cvs/:cvId/pdf': {},
      'GET /api/cvs/:cvId/questions': {},
      'POST /api/cvs/:cvId/generations': { body: { kind: 'initial' } },
      'PATCH /api/cvs/:cvId/items/:itemId': {
        body: { rev: 1, text: 'Not yours.' },
      },
      'DELETE /api/cvs/:cvId/items/:itemId': {},
      'POST /api/cvs/:cvId/items/:itemId/move': {
        body: { direction: 'up', version: 1 },
      },
      'POST /api/cvs/:cvId/items/:experienceId/bullets': {
        body: { text: 'Not yours.' },
      },
      'POST /api/cvs/:cvId/sections/:section/items': { body: {} },
    };

    /** Concrete values for the other path parameters: well-formed, so only ownership can answer 404. */
    const PATH_PARAMS: Record<string, string> = {
      ':itemId': 'summary',
      ':experienceId': '00000000-0000-4000-8000-000000000000',
      ':section': 'experience',
    };

    it('covers every registered route under /api/cvs/:cvId', () => {
      const cvRoutes = registeredRoutes(testApp).filter((route) =>
        route.includes(':cvId'),
      );

      expect(cvRoutes.sort()).toEqual(Object.keys(CV_ROUTES).sort());
    });

    it.each(Object.entries(CV_ROUTES))(
      "%s answers 404 for another User's CV",
      async (route, { body }) => {
        const { cvId } = await givenFailedCv();
        const stranger = await givenUser(testApp);
        const [method, path] = route.split(' ') as [string, string];
        const url = path
          .replace(':cvId', cvId)
          .replace(
            /:(itemId|experienceId|section)/g,
            (param) => PATH_PARAMS[param]!,
          );

        const response = await stranger.agent[
          method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete'
        ](url)
          .query(method === 'DELETE' ? { rev: 1 } : {})
          .send(body);

        expect(response.status).toBe(404);
        expect(apiErrorSchema.parse(response.body).error.code).toBe(
          'not_found',
        );
        expect(await prisma().generation.count({ where: { cvId } })).toBe(1);
      },
    );

    it('answers 404 for an id that is not a UUID', async () => {
      const { agent } = await givenUser(testApp);

      const response = await agent.get('/api/cvs/not-a-uuid').expect(404);

      expect(apiErrorSchema.parse(response.body).error.code).toBe('not_found');
    });
  });
});
