import { CV_LIMITS, cvContentSchema } from '@ai-cv-builder/shared';
import Anthropic from '@anthropic-ai/sdk';
import {
  afterAll,
  afterEach,
  assert,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';
import type { ComposeOutput } from '../src/ai/cv-ai.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { GenerationRunner } from '../src/generation/generation-runner.js';
import {
  composeOutput,
  extractOutput,
  sampleFacts,
} from './support/cv-ai-fixtures.js';
import { postCv, SAMPLE_TEXT_SOURCE } from './support/create-cv.js';
import { givenUser } from './support/given-user.js';
import { pdfWithPages } from './support/pdf-fixtures.js';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('Generation pipeline (job handler, scripted model)', () => {
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

  /** A CV created through the API, its first Generation queued and not yet picked up. */
  async function givenQueuedGeneration(
    source: { text?: string; pdf?: Buffer } = {},
  ) {
    const { agent } = await givenUser(testApp);
    const created = await postCv(agent, {
      targetRole: 'Senior Backend Engineer',
      ...(source.pdf
        ? { pdf: source.pdf }
        : { text: source.text ?? SAMPLE_TEXT_SOURCE }),
    }).expect(201);
    const cvId = created.body.cvId as string;
    const { id: generationId } = await prisma().generation.findFirstOrThrow({
      where: { cvId },
    });
    return { agent, cvId, generationId };
  }

  async function state(cvId: string, generationId: string) {
    const [cv, generation] = await Promise.all([
      prisma().cv.findUnique({ where: { id: cvId } }),
      prisma().generation.findUnique({ where: { id: generationId } }),
    ]);
    return { cv, generation };
  }

  it('extracts Facts, composes from Facts + Target role only, and makes the CV ready', async () => {
    const { agent, cvId, generationId } = await givenQueuedGeneration();
    testApp.cvAi
      .returns('extract', extractOutput())
      .returns('compose', composeOutput());

    await run(generationId);

    expect(testApp.cvAi.calls.extract).toEqual([
      { source: { kind: 'text', text: SAMPLE_TEXT_SOURCE } },
    ]);
    expect(testApp.cvAi.calls.compose).toEqual([
      { facts: sampleFacts(), targetRole: 'Senior Backend Engineer' },
    ]);
    const { cv, generation } = await state(cvId, generationId);
    expect(generation).toMatchObject({
      status: 'succeeded',
      step: null,
      errorCode: null,
      attempt: 1,
    });
    expect(cv?.status).toBe('ready');
    const view = (await agent.get(`/api/cvs/${cvId}`).expect(200)).body;
    const content = cvContentSchema.parse(view.content);
    expect(content.experience[0]).toMatchObject({
      organization: 'Analytical Engines Ltd',
      sourceFactIds: ['f3'],
      edited: false,
    });
    expect(view.latestGeneration).toMatchObject({ status: 'succeeded' });
  });

  it('sends a PDF Source to extract as its bytes', async () => {
    const pdf = await pdfWithPages(1);
    const { generationId } = await givenQueuedGeneration({ pdf });
    testApp.cvAi
      .returns('extract', extractOutput())
      .returns('compose', composeOutput());

    await run(generationId);

    const source = testApp.cvAi.calls.extract[0]?.source;
    assert(source?.kind === 'pdf');
    expect(Buffer.from(source.bytes)).toEqual(pdf);
    expect(testApp.cvAi.calls.compose[0]?.facts[0]?.source).toBe('pdf');
  });

  describe('Facts checkpoint', () => {
    it('keeps the Facts when a later step fails, for Try again to reuse', async () => {
      const { cvId, generationId } = await givenQueuedGeneration();
      testApp.cvAi
        .returns('extract', extractOutput())
        .throws('compose', apiError(401));

      await run(generationId);

      const { cv } = await state(cvId, generationId);
      expect(cv?.facts).toEqual(sampleFacts());
    });

    it('resumes from stored Facts without calling extract', async () => {
      const { cvId, generationId } = await givenQueuedGeneration();
      await prisma().cv.update({
        where: { id: cvId },
        data: { facts: sampleFacts() },
      });
      testApp.cvAi.returns('compose', composeOutput());

      await run(generationId);

      expect(testApp.cvAi.calls.extract).toEqual([]);
      expect(testApp.cvAi.calls.compose[0]?.facts).toEqual(sampleFacts());
      expect((await state(cvId, generationId)).generation?.status).toBe(
        'succeeded',
      );
    });
  });

  describe('a late or duplicate worker', () => {
    it('does nothing for a Generation that already finished', async () => {
      const { cvId, generationId } = await givenQueuedGeneration();
      testApp.cvAi
        .returns('extract', extractOutput())
        .returns('compose', composeOutput());
      await run(generationId);
      const before = await state(cvId, generationId);

      await run(generationId);

      expect(testApp.cvAi.calls.compose).toHaveLength(1);
      expect(await state(cvId, generationId)).toEqual(before);
    });

    it('writes nothing when another worker finished the Generation first', async () => {
      const { cvId, generationId } = await givenQueuedGeneration();
      testApp.cvAi
        .returns('extract', extractOutput())
        .runs('compose', async () => {
          await prisma().generation.update({
            where: { id: generationId },
            data: { status: 'succeeded', finishedAt: new Date() },
          });
          return composeOutput();
        });

      await run(generationId);

      const { cv } = await state(cvId, generationId);
      expect(cv?.content).toBeNull();
      expect(cv?.status).toBe('generating');
    });

    it('completes as a no-op when the CV was deleted mid-run', async () => {
      const { cvId, generationId } = await givenQueuedGeneration();
      testApp.cvAi
        .returns('extract', extractOutput())
        .runs('compose', async () => {
          await prisma().cv.delete({ where: { id: cvId } });
          return composeOutput();
        });

      await expect(run(generationId)).resolves.toBeUndefined();

      expect(await state(cvId, generationId)).toEqual({
        cv: null,
        generation: null,
      });
    });
  });

  describe('structural failures', () => {
    const uncited = (): ComposeOutput => {
      const output = composeOutput();
      output.skills[0]!.sourceFactIds = [];
      return output;
    };
    const overLimit = (): ComposeOutput => {
      const output = composeOutput();
      output.experience[0]!.bullets[0]!.text = 'x'.repeat(CV_LIMITS.bullet + 1);
      return output;
    };
    const unknownFact = (): ComposeOutput => {
      const output = composeOutput();
      output.summary.sourceFactIds = ['f42'];
      return output;
    };

    it.each([
      ['an uncited item', uncited],
      ['an over-limit field', overLimit],
      ['an unknown Fact id', unknownFact],
    ])(
      'retries compose once after %s, then succeeds',
      async (_case, broken) => {
        const { cvId, generationId } = await givenQueuedGeneration();
        testApp.cvAi
          .returns('extract', extractOutput())
          .returns('compose', broken(), composeOutput());

        await run(generationId);

        expect(testApp.cvAi.calls.compose).toHaveLength(2);
        expect((await state(cvId, generationId)).cv?.status).toBe('ready');
      },
    );

    it('fails with invalid_ai_output when the retry is broken too', async () => {
      const { cvId, generationId } = await givenQueuedGeneration();
      testApp.cvAi
        .returns('extract', extractOutput())
        .returns('compose', uncited(), uncited());

      await run(generationId);

      expect(testApp.cvAi.calls.compose).toHaveLength(2);
      const { cv, generation } = await state(cvId, generationId);
      expect(generation).toMatchObject({
        status: 'failed',
        errorCode: 'invalid_ai_output',
      });
      expect(generation?.finishedAt).toBeInstanceOf(Date);
      expect(cv?.status).toBe('failed');
      expect(cv?.content).toBeNull();
    });

    it('fails with unreadable_source when extract finds no Facts', async () => {
      const { generationId, cvId } = await givenQueuedGeneration();
      testApp.cvAi.returns('extract', { facts: [] });

      await run(generationId);

      expect((await state(cvId, generationId)).generation?.errorCode).toBe(
        'unreadable_source',
      );
    });
  });

  describe('model errors', () => {
    it('rethrows a transient error for a job retry and leaves the Generation running', async () => {
      const { cvId, generationId } = await givenQueuedGeneration();
      const overloaded = apiError(529);
      testApp.cvAi
        .returns('extract', extractOutput())
        .throws('compose', overloaded);

      await expect(run(generationId)).rejects.toBe(overloaded);

      const { cv, generation } = await state(cvId, generationId);
      expect(generation).toMatchObject({ status: 'running', step: 'compose' });
      expect(cv?.status).toBe('generating');
    });

    it('fails at once on a permanent error, without retrying the step', async () => {
      const { cvId, generationId } = await givenQueuedGeneration();
      testApp.cvAi.throws('extract', apiError(401));

      await run(generationId);

      expect(testApp.cvAi.calls.extract).toHaveLength(1);
      expect((await state(cvId, generationId)).generation).toMatchObject({
        status: 'failed',
        errorCode: 'ai_unavailable',
      });
    });
  });
});

function apiError(status: number) {
  return Anthropic.APIError.generate(
    status,
    undefined,
    `HTTP ${status}`,
    new Headers(),
  );
}
