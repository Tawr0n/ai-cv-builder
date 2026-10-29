import { generationSchema } from '@ai-cv-builder/shared';
import Anthropic from '@anthropic-ai/sdk';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { postCv, SAMPLE_TEXT_SOURCE } from './support/create-cv.js';
import { givenUser } from './support/given-user.js';
import { createTestApp, type TestApp } from './support/test-app.js';

/** The one test that runs real pg-boss: queue config (retries, dead letter) is only real here. */
describe('Generation queue (real pg-boss)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({
      GENERATION_WORKER: 'true',
      // No job retry, so the first attempt is the last one.
      GENERATION_RETRY_LIMIT: '0',
    });
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('ends a transient failure on the last attempt as failed / worker_lost', async () => {
    const { agent } = await givenUser(testApp);
    testApp.cvAi.throws(
      'extract',
      Anthropic.APIError.generate(529, undefined, 'overloaded', new Headers()),
    );

    const created = await postCv(agent, { text: SAMPLE_TEXT_SOURCE }).expect(
      201,
    );

    const cvId = created.body.cvId as string;
    await expect
      .poll(
        async () =>
          generationSchema.parse(
            (await agent.get(`/api/cvs/${cvId}/generation`)).body,
          ),
        { timeout: 30_000, interval: 250 },
      )
      .toMatchObject({ status: 'failed', errorCode: 'worker_lost' });
    expect(testApp.cvAi.calls.extract).toHaveLength(1);
  }, 40_000);
});
