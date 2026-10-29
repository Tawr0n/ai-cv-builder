import {
  CV_LIMITS,
  cvContentSchema,
  cvViewSchema,
  questionListSchema,
} from '@ai-cv-builder/shared';
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
import type { ComposeOutput, CvAiOutput } from '../src/ai/cv-ai.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { GenerationRunner } from '../src/generation/generation-runner.js';
import {
  composeOutput,
  extractOutput,
  noFindings,
  sampleFacts,
} from './support/cv-ai-fixtures.js';
import { postCv, SAMPLE_TEXT_SOURCE } from './support/create-cv.js';
import { givenUser } from './support/given-user.js';
import { pdfWithPages } from './support/pdf-fixtures.js';
import { createTestApp, type TestApp } from './support/test-app.js';

type AgentOf = Awaited<ReturnType<typeof givenUser>>['agent'];

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

  it('extracts Facts, composes from Facts + Target role only, judges it, and makes the CV ready', async () => {
    const { agent, cvId, generationId } = await givenQueuedGeneration();
    testApp.cvAi
      .returns('extract', extractOutput())
      .returns('compose', composeOutput())
      .returns('judge', noFindings());

    await run(generationId);

    expect(testApp.cvAi.calls.extract).toEqual([
      { source: { kind: 'text', text: SAMPLE_TEXT_SOURCE } },
    ]);
    expect(testApp.cvAi.calls.compose).toEqual([
      { facts: sampleFacts(), targetRole: 'Senior Backend Engineer' },
    ]);
    const [judged] = testApp.cvAi.calls.judge;
    expect(judged?.facts).toEqual(sampleFacts());
    expect(judged?.claims).toEqual(
      expect.arrayContaining([
        {
          itemId: 'summary',
          section: 'summary',
          field: 'text',
          value: 'Backend engineer who built a billing service in Node.js.',
          sourceFactIds: ['f3', 'f4'],
        },
        expect.objectContaining({
          section: 'experience',
          field: 'organization',
          value: 'Analytical Engines Ltd',
          sourceFactIds: ['f3'],
        }),
        expect.objectContaining({
          section: 'experience',
          field: 'text',
          value: 'Built the billing service in Node.js.',
          sourceFactIds: ['f4'],
        }),
      ]),
    );
    expect(testApp.cvAi.calls.repair).toEqual([]);
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
      .returns('compose', composeOutput())
      .returns('judge', noFindings());

    await run(generationId);

    const source = testApp.cvAi.calls.extract[0]?.source;
    assert(source?.kind === 'pdf');
    expect(Buffer.from(source.bytes)).toEqual(pdf);
    expect(testApp.cvAi.calls.compose[0]?.facts[0]?.source).toBe('pdf');
  });

  describe('judge and repair', () => {
    const INVENTED = 'Seasoned backend engineer who led a team of ten.';
    const SUPPORTED =
      'Backend engineer who built a billing service in Node.js.';

    /** Compose wrote a summary its cited Facts do not support. */
    function inventedSummary() {
      const output = composeOutput();
      output.summary.text = INVENTED;
      return output;
    }

    const summaryFinding = (softened: string | null = 'Backend engineer.') => ({
      itemId: 'summary',
      field: 'text' as const,
      problem: 'No fact says the person led a team',
      softened,
      question: 'Did you lead a team? How many people?',
    });

    async function questionsOf(agent: AgentOf, cvId: string) {
      const response = await agent
        .get(`/api/cvs/${cvId}/questions`)
        .expect(200);
      return questionListSchema.parse(response.body).items;
    }

    it('repairs only the flagged Claims, in exactly one call, and keeps the fix', async () => {
      const { agent, cvId, generationId } = await givenQueuedGeneration();
      testApp.cvAi
        .returns('extract', extractOutput())
        .returns('compose', inventedSummary())
        .returns('judge', { findings: [summaryFinding()] }, noFindings())
        .returns('repair', {
          fixes: [
            {
              itemId: 'summary',
              field: 'text',
              value: SUPPORTED,
              sourceFactIds: ['f3', 'f4'],
            },
          ],
        });

      await run(generationId);

      expect(testApp.cvAi.calls.repair).toHaveLength(1);
      expect(testApp.cvAi.calls.repair[0]).toMatchObject({
        targetRole: 'Senior Backend Engineer',
        flagged: [
          {
            claim: { itemId: 'summary', field: 'text', value: INVENTED },
            problem: 'No fact says the person led a team',
          },
        ],
      });
      // The second judge sees only what repair changed.
      expect(testApp.cvAi.calls.judge[1]?.claims).toEqual([
        expect.objectContaining({ itemId: 'summary', value: SUPPORTED }),
      ]);
      const view = cvViewSchema.parse(
        (await agent.get(`/api/cvs/${cvId}`).expect(200)).body,
      );
      expect(view.status).toBe('ready');
      expect(view.content?.summary.text).toBe(SUPPORTED);
      expect(await questionsOf(agent, cvId)).toEqual([]);
    });

    it('softens a Claim still unsupported after repair and asks a Question about it', async () => {
      const { agent, cvId, generationId } = await givenQueuedGeneration();
      testApp.cvAi
        .returns('extract', extractOutput())
        .returns('compose', inventedSummary())
        .returns(
          'judge',
          { findings: [summaryFinding()] },
          { findings: [summaryFinding('Backend engineer.')] },
        )
        .returns('repair', {
          fixes: [
            {
              itemId: 'summary',
              field: 'text',
              value: 'Backend engineer who led a team.',
              sourceFactIds: ['f3'],
            },
          ],
        });

      await run(generationId);

      expect(testApp.cvAi.calls.repair).toHaveLength(1);
      const view = cvViewSchema.parse(
        (await agent.get(`/api/cvs/${cvId}`).expect(200)).body,
      );
      expect(view.content?.summary.text).toBe('Backend engineer.');
      expect(await questionsOf(agent, cvId)).toEqual([
        expect.objectContaining({
          anchor: { section: 'summary', itemId: null, field: 'text' },
          text: 'Did you lead a team? How many people?',
          status: 'open',
        }),
      ]);
    });

    it('drops a bullet nothing supports and anchors its Question to the Experience', async () => {
      const { agent, cvId, generationId } = await givenQueuedGeneration();
      const bulletFinding = (itemId: string) => ({
        itemId,
        field: 'text' as const,
        problem: 'No fact mentions Kubernetes',
        softened: null,
        question: 'Have you worked with Kubernetes?',
      });
      testApp.cvAi
        .returns('extract', extractOutput())
        .returns('compose', composeOutput())
        .runs('judge', async ({ claims }) => {
          const bullet = claims.find((c) => c.value.startsWith('Built'))!;
          return { findings: [bulletFinding(bullet.itemId)] };
        })
        .runs('repair', async ({ flagged }) => ({
          fixes: [
            {
              itemId: flagged[0]!.claim.itemId,
              field: 'text',
              value: 'Ran Kubernetes clusters.',
              sourceFactIds: ['f4'],
            },
          ],
        }))
        .runs('judge', async ({ claims }) => ({
          findings: [bulletFinding(claims[0]!.itemId)],
        }));

      await run(generationId);

      const content = cvViewSchema.parse(
        (await agent.get(`/api/cvs/${cvId}`).expect(200)).body,
      ).content!;
      const experience = content.experience[0]!;
      expect(experience.bullets).toEqual([]);
      expect(await questionsOf(agent, cvId)).toEqual([
        expect.objectContaining({
          anchor: {
            section: 'experience',
            itemId: experience.id,
            field: 'bullets',
          },
          text: 'Have you worked with Kubernetes?',
        }),
      ]);
    });

    it.each<[string, CvAiOutput<'judge'>]>([
      [
        'a Claim that does not exist',
        { findings: [{ ...summaryFinding(), itemId: 'not-an-item' }] },
      ],
      [
        'an empty Question',
        { findings: [{ ...summaryFinding(), question: '  ' }] },
      ],
    ])(
      'treats judge output naming %s as a structural failure: one retry, then invalid_ai_output',
      async (_case, broken) => {
        const { cvId, generationId } = await givenQueuedGeneration();
        testApp.cvAi
          .returns('extract', extractOutput())
          .returns('compose', composeOutput())
          .returns('judge', broken, broken);

        await run(generationId);

        expect(testApp.cvAi.calls.judge).toHaveLength(2);
        expect(testApp.cvAi.calls.repair).toEqual([]);
        expect((await state(cvId, generationId)).generation).toMatchObject({
          status: 'failed',
          errorCode: 'invalid_ai_output',
        });
      },
    );

    it('treats a repair citing an unknown Fact as a structural failure', async () => {
      const { cvId, generationId } = await givenQueuedGeneration();
      const badFix: CvAiOutput<'repair'> = {
        fixes: [
          {
            itemId: 'summary',
            field: 'text',
            value: SUPPORTED,
            sourceFactIds: ['f99'],
          },
        ],
      };
      testApp.cvAi
        .returns('extract', extractOutput())
        .returns('compose', inventedSummary())
        .returns('judge', { findings: [summaryFinding()] })
        .returns('repair', badFix, badFix);

      await run(generationId);

      expect((await state(cvId, generationId)).generation).toMatchObject({
        status: 'failed',
        errorCode: 'invalid_ai_output',
      });
    });
  });

  describe('Questions about missing or vague things', () => {
    async function questionsOf(agent: AgentOf, cvId: string) {
      const response = await agent
        .get(`/api/cvs/${cvId}/questions`)
        .expect(200);
      return questionListSchema.parse(response.body).items;
    }

    it("anchors compose's Questions to the items they are about, in its order", async () => {
      const { agent, cvId, generationId } = await givenQueuedGeneration();
      const output = composeOutput();
      output.questions = [
        {
          section: 'experience',
          itemIndex: 0,
          bulletIndex: 0,
          field: 'text',
          text: 'How many customers did the billing service serve?',
        },
        {
          section: 'summary',
          itemIndex: null,
          bulletIndex: null,
          field: null,
          text: 'What kind of backend work do you want next?',
        },
      ];
      testApp.cvAi
        .returns('extract', extractOutput())
        .returns('compose', output)
        .returns('judge', noFindings());

      await run(generationId);

      const content = cvViewSchema.parse(
        (await agent.get(`/api/cvs/${cvId}`).expect(200)).body,
      ).content!;
      const bullet = content.experience[0]!.bullets[0]!;
      expect(await questionsOf(agent, cvId)).toMatchObject([
        {
          anchor: { section: 'experience', itemId: bullet.id, field: 'text' },
          text: 'How many customers did the billing service serve?',
          status: 'open',
        },
        {
          anchor: { section: 'summary', itemId: null, field: null },
          text: 'What kind of backend work do you want next?',
        },
      ]);
    });

    it('asks about an unknown organization, title or date even when compose did not', async () => {
      const { agent, cvId, generationId } = await givenQueuedGeneration();
      const output = composeOutput();
      Object.assign(output.experience[0]!, {
        organization: null,
        title: null,
        startDate: null,
        endDate: null,
      });
      output.questions = [
        {
          section: 'experience',
          itemIndex: 0,
          bulletIndex: null,
          field: 'title',
          text: 'What was your job title there?',
        },
      ];
      testApp.cvAi
        .returns('extract', extractOutput())
        .returns('compose', output)
        .returns('judge', noFindings());

      await run(generationId);

      const content = cvViewSchema.parse(
        (await agent.get(`/api/cvs/${cvId}`).expect(200)).body,
      ).content!;
      const itemId = content.experience[0]!.id;
      expect(content.experience[0]).toMatchObject({
        organization: null,
        title: null,
      });
      const questions = await questionsOf(agent, cvId);
      expect(questions.map((q) => q.anchor)).toEqual([
        { section: 'experience', itemId, field: 'title' },
        { section: 'experience', itemId, field: 'organization' },
        { section: 'experience', itemId, field: 'startDate' },
        { section: 'experience', itemId, field: 'endDate' },
      ]);
      expect(questions[0]?.text).toBe('What was your job title there?');
    });

    it.each<[string, ComposeOutput['questions'][number]]>([
      [
        'an item that does not exist',
        {
          section: 'experience',
          itemIndex: 3,
          bulletIndex: null,
          field: null,
          text: 'Where?',
        },
      ],
      [
        'a field of another section',
        {
          section: 'skills',
          itemIndex: 0,
          bulletIndex: null,
          field: 'degree',
          text: 'Which degree?',
        },
      ],
    ])(
      'retries compose once when a Question names %s',
      async (_case, question) => {
        const { cvId, generationId } = await givenQueuedGeneration();
        const broken = composeOutput();
        broken.questions = [question];
        testApp.cvAi
          .returns('extract', extractOutput())
          .returns('compose', broken, composeOutput())
          .returns('judge', noFindings());

        await run(generationId);

        expect(testApp.cvAi.calls.compose).toHaveLength(2);
        expect((await state(cvId, generationId)).cv?.status).toBe('ready');
      },
    );
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
      testApp.cvAi
        .returns('compose', composeOutput())
        .returns('judge', noFindings());

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
        .returns('compose', composeOutput())
        .returns('judge', noFindings());
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
        })
        .returns('judge', noFindings());

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
        })
        .returns('judge', noFindings());

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
          .returns('compose', broken(), composeOutput())
          .returns('judge', noFindings());

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
