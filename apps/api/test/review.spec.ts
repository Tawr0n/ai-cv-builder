import {
  apiErrorSchema,
  cvViewSchema,
  generationSchema,
} from '@ai-cv-builder/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { factSchema } from '../src/ai/cv-ai.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { GenerationRunner } from '../src/generation/generation-runner.js';
import { noFindings } from './support/cv-ai-fixtures.js';
import {
  composeWithQuestions,
  givenReadyCv,
  LOCATION_QUESTION,
} from './support/ready-cv.js';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('reviewing what Update CV changed', () => {
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

  /** A CV whose Experience Update CV moved to London: under review. */
  async function givenUpdatedCv() {
    const cv = await givenReadyCv(testApp, composeWithQuestions());
    const before = (await cv.content()).experience[0]!;
    const questionId = await cv.answer(LOCATION_QUESTION, 'London');
    const started = await cv.agent
      .post(`/api/cvs/${cv.cvId}/generations`)
      .send({ kind: 'answer' })
      .expect(201);
    testApp.cvAi
      .returns(
        'update',
        await cv.experienceUpdate({
          location: 'London',
          sourceFactIds: ['f3', 'f5'],
        }),
      )
      .returns('judge', noFindings());
    await testApp.app
      .get(GenerationRunner)
      .run(generationSchema.parse(started.body).id);
    const after = (await cv.content()).experience[0]!;
    expect(after.review).toBeDefined();
    return { ...cv, before, after, questionId };
  }

  const decide = (
    cv: Awaited<ReturnType<typeof givenUpdatedCv>>,
    decision: 'accept' | 'undo',
    rev = cv.after.rev,
  ) =>
    cv.agent
      .post(`/api/cvs/${cv.cvId}/items/${cv.after.id}/${decision}`)
      .send({ rev });

  it('Accept keeps the change and ends the review', async () => {
    const cv = await givenUpdatedCv();

    const response = await decide(cv, 'accept').expect(200);

    const [experience] = cvViewSchema.parse(response.body).content!.experience;
    expect(experience).toMatchObject({
      location: 'London',
      rev: cv.after.rev + 1,
      edited: false,
    });
    expect(experience?.review).toBeUndefined();
    expect(await cv.question(LOCATION_QUESTION)).toMatchObject({
      status: 'answered',
      appliedAt: expect.any(String),
    });
  });

  it('Undo restores the snapshot and reopens its Questions with the Answer kept', async () => {
    const cv = await givenUpdatedCv();

    const response = await decide(cv, 'undo').expect(200);

    const [experience] = cvViewSchema.parse(response.body).content!.experience;
    const { rev: _rev, ...restored } = experience!;
    const { rev: _was, ...before } = cv.before;
    expect(restored).toEqual(before);
    expect(experience?.rev).toBe(cv.after.rev + 1);
    expect(await cv.question(LOCATION_QUESTION)).toMatchObject({
      status: 'answered',
      answer: 'London',
      appliedAt: null,
      locked: false,
    });
    // The Fact the Answer became stays.
    const stored = await testApp.app
      .get(PrismaService)
      .cv.findUniqueOrThrow({ where: { id: cv.cvId } });
    expect(factSchema.array().parse(stored.facts)).toHaveLength(5);
  });

  it('a hand edit accepts the change', async () => {
    const cv = await givenUpdatedCv();

    const response = await cv.agent
      .patch(`/api/cvs/${cv.cvId}/items/${cv.after.id}`)
      .send({ rev: cv.after.rev, location: 'London, UK' })
      .expect(200);

    expect(response.body).toMatchObject({
      location: 'London, UK',
      edited: true,
    });
    const [experience] = (await cv.content()).experience;
    expect(experience?.review).toBeUndefined();
  });

  it('a hand edit of one of its bullets accepts the change too', async () => {
    const cv = await givenUpdatedCv();
    const [bullet] = cv.after.bullets;

    await cv.agent
      .patch(`/api/cvs/${cv.cvId}/items/${bullet!.id}`)
      .send({ rev: bullet!.rev, text: 'Built billing in Node.js.' })
      .expect(200);

    const [experience] = (await cv.content()).experience;
    expect(experience?.review).toBeUndefined();
    expect(experience?.location).toBe('London');
  });

  it('answers 409 to a stale rev, and to an item that is not under review', async () => {
    const cv = await givenUpdatedCv();

    const stale = await decide(cv, 'undo', cv.after.rev - 1).expect(409);
    expect(apiErrorSchema.parse(stale.body).error.code).toBe('item_conflict');

    await decide(cv, 'accept').expect(200);
    const again = await decide(cv, 'undo', cv.after.rev + 1).expect(409);
    expect(apiErrorSchema.parse(again.body).error.code).toBe('not_in_review');
  });
});
