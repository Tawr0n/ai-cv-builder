import { generationSchema } from '@ai-cv-builder/shared';
import Anthropic from '@anthropic-ai/sdk';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { postCv, SAMPLE_TEXT_SOURCE } from './support/create-cv.js';
import { composeOutput, extractOutput } from './support/cv-ai-fixtures.js';
import { givenUser } from './support/given-user.js';
import { createTestApp, type TestApp } from './support/test-app.js';

/** The only tests that run real pg-boss: queue config (retries, dead letter, concurrency) is only real here. */
describe('Generation queue (real pg-boss)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({
      GENERATION_WORKER: 'true',
      // No job retry, so the first attempt is the last one.
      GENERATION_RETRY_LIMIT: '0',
    });
  });

  afterEach(() => {
    testApp.cvAi.assertAllConsumed();
    testApp.cvAi.reset();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  /** Polls the CV's latest Generation until it matches `expected`. */
  async function eventually(
    agent: Awaited<ReturnType<typeof givenUser>>['agent'],
    cvId: string,
    expected: object,
  ) {
    await expect
      .poll(
        async () =>
          generationSchema.parse(
            (await agent.get(`/api/cvs/${cvId}/generation`)).body,
          ),
        { timeout: 30_000, interval: 250 },
      )
      .toMatchObject(expected);
  }

  it('ends a transient failure on the last attempt as failed / worker_lost', async () => {
    const { agent } = await givenUser(testApp);
    testApp.cvAi.throws(
      'extract',
      Anthropic.APIError.generate(529, undefined, 'overloaded', new Headers()),
    );

    const created = await postCv(agent, { text: SAMPLE_TEXT_SOURCE }).expect(
      201,
    );

    await eventually(agent, created.body.cvId as string, {
      status: 'failed',
      errorCode: 'worker_lost',
    });
    expect(testApp.cvAi.calls.extract).toHaveLength(1);
  }, 40_000);

  it('runs two Generations at the same time', async () => {
    const { agent } = await givenUser(testApp);
    // Each extract waits until the other has started: one at a time never gets there.
    let started = 0;
    let bothStarted!: () => void;
    const together = new Promise<void>((resolve) => (bothStarted = resolve));
    const waitForTheOther = async () => {
      if (++started === 2) bothStarted();
      await together;
      return extractOutput();
    };
    testApp.cvAi
      .runs('extract', waitForTheOther)
      .runs('extract', waitForTheOther)
      .returns('compose', composeOutput(), composeOutput());

    const created = await Promise.all([
      postCv(agent, { text: SAMPLE_TEXT_SOURCE }).expect(201),
      postCv(agent, { text: SAMPLE_TEXT_SOURCE }).expect(201),
    ]);

    for (const { body } of created) {
      await eventually(agent, body.cvId as string, { status: 'succeeded' });
    }
  }, 40_000);
});
