import { apiErrorSchema, generationSchema } from '@ai-cv-builder/shared';
import Anthropic from '@anthropic-ai/sdk';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { factSchema } from '../src/ai/cv-ai.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { GenerationRunner } from '../src/generation/generation-runner.js';
import { noFindings } from './support/cv-ai-fixtures.js';
import {
  composeWithQuestions,
  givenReadyCv,
  LOCATION_QUESTION,
  NUMBERS_QUESTION,
  SUMMARY_QUESTION,
} from './support/ready-cv.js';
import { createTestApp, type TestApp } from './support/test-app.js';

type ReadyCv = Awaited<ReturnType<typeof givenReadyCv>>;

describe('Update CV: an answer Generation applies the pending Answers', () => {
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
  const run = (generationId: string) =>
    testApp.app.get(GenerationRunner).run(generationId);
  const given = () => givenReadyCv(testApp, composeWithQuestions());

  const updateCv = (cv: ReadyCv) =>
    cv.agent.post(`/api/cvs/${cv.cvId}/generations`).send({ kind: 'answer' });

  async function startUpdate(cv: ReadyCv) {
    const response = await updateCv(cv).expect(201);
    return generationSchema.parse(response.body);
  }

  async function storedFacts(cvId: string) {
    const cv = await prisma().cv.findUniqueOrThrow({ where: { id: cvId } });
    return factSchema.array().parse(cv.facts);
  }

  it('applies every pending Answer in one update call over the anchored item only', async () => {
    const cv = await given();
    const before = await cv.content();
    const location = await cv.answer(LOCATION_QUESTION, 'London');
    const numbers = await cv.answer(
      NUMBERS_QUESTION,
      'About 2 million a month',
    );
    expect(await storedFacts(cv.cvId)).toHaveLength(4);

    const generation = await startUpdate(cv);
    expect(generation).toMatchObject({ kind: 'answer', status: 'queued' });
    expect((await cv.view()).status).toBe('ready');

    testApp.cvAi
      .returns(
        'update',
        await cv.experienceUpdate({
          location: 'London',
          bullets: [
            {
              id: before.experience[0]!.bullets[0]!.id,
              text: 'Built the billing service in Node.js, billing about 2 million invoices a month.',
              sourceFactIds: ['f4', 'f6'],
            },
          ],
          sourceFactIds: ['f3', 'f5'],
        }),
      )
      .returns('judge', noFindings());
    await run(generation.id);

    const [call] = testApp.cvAi.calls.update;
    expect(testApp.cvAi.calls.update).toHaveLength(1);
    expect(call?.answers).toEqual([
      {
        id: 'f5',
        text: `Q: ${LOCATION_QUESTION} A: London`,
        quote: 'London',
        source: 'answer',
        questionId: location,
      },
      {
        id: 'f6',
        text: `Q: ${NUMBERS_QUESTION} A: About 2 million a month`,
        quote: 'About 2 million a month',
        source: 'answer',
        questionId: numbers,
      },
    ]);
    expect(call?.facts).toHaveLength(6);
    expect(call?.scope).toEqual({
      contact: false,
      summary: false,
      itemIds: [before.experience[0]!.id],
      sections: [],
    });
    // The judge sees only the items the update changed.
    expect(
      new Set(
        testApp.cvAi.calls.judge.at(-1)?.assertions.map((a) => a.section),
      ),
    ).toEqual(new Set(['experience']));

    const view = await cv.view();
    expect(view.status).toBe('ready');
    expect(view.latestGeneration).toMatchObject({
      kind: 'answer',
      status: 'succeeded',
    });
    const after = view.content!;
    expect(after.experience[0]).toMatchObject({
      location: 'London',
      rev: 2,
      edited: false,
      review: {
        prev: { location: null, rev: 1 },
        questionIds: expect.arrayContaining([location, numbers]),
      },
    });
    expect(after.summary).toEqual(before.summary);
    expect(after.contact).toEqual(before.contact);
    expect(await storedFacts(cv.cvId)).toHaveLength(6);
    expect(await cv.question(LOCATION_QUESTION)).toMatchObject({
      status: 'answered',
      answer: 'London',
      appliedAt: expect.any(String),
      locked: false,
    });
    expect((await cv.question(SUMMARY_QUESTION)).status).toBe('open');
  });

  it('never touches an Edited item: the Answer becomes a Fact, the item stays', async () => {
    const cv = await given();
    await cv.agent
      .patch(`/api/cvs/${cv.cvId}/items/summary`)
      .send({ rev: 1, text: 'My own words.' })
      .expect(200);
    await cv.answer(SUMMARY_QUESTION, 'Small product teams');
    const before = await cv.content();

    // Only an Edited item is anchored: nothing for the model to do.
    const generation = await startUpdate(cv);
    await run(generation.id);

    expect(testApp.cvAi.calls.update).toHaveLength(0);
    const after = await cv.content();
    expect(after.summary).toEqual(before.summary);
    expect(await storedFacts(cv.cvId)).toHaveLength(5);
    expect(await cv.question(SUMMARY_QUESTION)).toMatchObject({
      status: 'answered',
      appliedAt: expect.any(String),
    });
  });

  it('replaces the open Questions in scope with what the update asks', async () => {
    const cv = await given();
    await cv.answer(LOCATION_QUESTION, 'London');
    const generation = await startUpdate(cv);
    const bulletId = (await cv.content()).experience[0]!.bullets[0]!.id;

    testApp.cvAi
      .returns(
        'update',
        await cv.experienceUpdate(
          { location: 'London', sourceFactIds: ['f3', 'f5'] },
          [
            {
              section: 'experience',
              itemId: bulletId,
              field: 'text',
              text: 'Which payment providers did the service use?',
            },
          ],
        ),
      )
      .returns('judge', noFindings());
    await run(generation.id);

    const questions = await cv.questions();
    expect(questions.map(({ text, status }) => ({ text, status }))).toEqual(
      expect.arrayContaining([
        { text: LOCATION_QUESTION, status: 'answered' },
        { text: NUMBERS_QUESTION, status: 'obsolete' },
        { text: SUMMARY_QUESTION, status: 'open' },
        {
          text: 'Which payment providers did the service use?',
          status: 'open',
        },
      ]),
    );
  });

  it('keeps an item in scope that the update leaves out: a refuting Answer never deletes it', async () => {
    const cv = await given();
    await cv.answer(LOCATION_QUESTION, 'I never worked there');
    const before = await cv.content();
    const generation = await startUpdate(cv);

    testApp.cvAi.returns('update', {
      ...(await cv.experienceUpdate()),
      experience: [],
    });
    await run(generation.id);

    expect((await cv.content()).experience).toEqual(before.experience);
    expect((await cv.view()).latestGeneration.status).toBe('succeeded');
  });

  it('leaves the CV ready and the Answers pending when the update fails', async () => {
    const cv = await given();
    await cv.answer(LOCATION_QUESTION, 'London');
    const before = await cv.content();
    const generation = await startUpdate(cv);

    testApp.cvAi.throws(
      'update',
      Anthropic.APIError.generate(401, undefined, 'bad key', new Headers()),
    );
    await run(generation.id);

    const view = await cv.view();
    expect(view.status).toBe('ready');
    expect(view.latestGeneration).toMatchObject({
      kind: 'answer',
      status: 'failed',
      errorCode: 'ai_unavailable',
    });
    expect(view.content).toEqual(before);
    expect(await storedFacts(cv.cvId)).toHaveLength(4);
    expect(await cv.question(LOCATION_QUESTION)).toMatchObject({
      status: 'answered',
      appliedAt: null,
      locked: false,
    });
    // Still editable, and Try again is another Update CV.
    await cv.answer(LOCATION_QUESTION, 'London, UK');
    await startUpdate(cv);
  });

  it('answers 409 to a second Update CV while one runs, and locks the Answers it took', async () => {
    const cv = await given();
    const location = await cv.answer(LOCATION_QUESTION, 'London');
    const generation = await startUpdate(cv);

    const second = await updateCv(cv).expect(409);
    expect(apiErrorSchema.parse(second.body).error.code).toBe(
      'generation_active',
    );
    expect(await cv.question(LOCATION_QUESTION)).toMatchObject({
      locked: true,
    });
    const locked = await cv.agent
      .put(`/api/cvs/${cv.cvId}/questions/${location}/answer`)
      .send({ answer: 'Paris' })
      .expect(409);
    expect(apiErrorSchema.parse(locked.body).error.code).toBe(
      'question_locked',
    );
    await cv.agent
      .post(`/api/cvs/${cv.cvId}/questions/${location}/dismiss`)
      .expect(409);

    // An Answer typed during the run waits for the next Update CV.
    await cv.answer(SUMMARY_QUESTION, 'Small product teams');
    testApp.cvAi
      .returns(
        'update',
        await cv.experienceUpdate({
          location: 'London',
          sourceFactIds: ['f3', 'f5'],
        }),
      )
      .returns('judge', noFindings());
    await run(generation.id);

    expect(testApp.cvAi.calls.update[0]?.answers).toHaveLength(1);
    expect(await cv.question(SUMMARY_QUESTION)).toMatchObject({
      status: 'answered',
      appliedAt: null,
    });
    expect((await cv.content()).summary.rev).toBe(1);
  });

  it('answers 409 when there is no pending Answer', async () => {
    const cv = await given();

    const response = await updateCv(cv).expect(409);

    expect(apiErrorSchema.parse(response.body).error.code).toBe(
      'no_pending_answers',
    );
  });

  it('leaves alone an item the User edits while the update runs', async () => {
    const cv = await given();
    await cv.answer(LOCATION_QUESTION, 'London');
    const generation = await startUpdate(cv);
    const output = await cv.experienceUpdate({
      location: 'London',
      sourceFactIds: ['f3', 'f5'],
    });
    const experienceId = (await cv.content()).experience[0]!.id;

    testApp.cvAi
      .runs('update', async () => {
        await cv.agent
          .patch(`/api/cvs/${cv.cvId}/items/${experienceId}`)
          .send({ rev: 1, location: 'Remote' })
          .expect(200);
        return output;
      })
      .returns('judge', noFindings());
    await run(generation.id);

    const [experience] = (await cv.content()).experience;
    expect(experience).toMatchObject({ location: 'Remote', edited: true });
    expect(experience?.review).toBeUndefined();
    // The Questions of an item the update did not write stay as they were.
    expect((await cv.question(NUMBERS_QUESTION)).status).toBe('open');
  });
});
