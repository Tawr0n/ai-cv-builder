import {
  apiErrorSchema,
  createCvResponseSchema,
  cvListSchema,
  generationSchema,
  PDF_LIMITS,
} from '@ai-cv-builder/shared';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/database/prisma.service.js';
import {
  type CreateCvRequest,
  postCv,
  SAMPLE_TEXT_SOURCE,
} from './support/create-cv.js';
import { givenUser } from './support/given-user.js';
import {
  corruptPdf,
  encryptedPdf,
  pdfLargerThan,
  pdfWithPages,
} from './support/pdf-fixtures.js';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('POST /api/cvs', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  const prisma = () => testApp.app.get(PrismaService);

  it('creates a CV from free text and queues its first Generation', async () => {
    const { agent } = await givenUser(testApp);

    const created = await postCv(agent, { text: SAMPLE_TEXT_SOURCE }).expect(
      201,
    );

    const { cvId } = createCvResponseSchema.parse(created.body);
    const list = cvListSchema.parse((await agent.get('/api/cvs')).body);
    expect(list.items).toEqual([
      expect.objectContaining({
        id: cvId,
        targetRole: 'Senior Backend Engineer',
        status: 'generating',
      }),
    ]);
    const generation = generationSchema.parse(
      (await agent.get(`/api/cvs/${cvId}/generation`).expect(200)).body,
    );
    expect(generation).toMatchObject({
      kind: 'initial',
      status: 'queued',
      step: null,
      errorCode: null,
    });
  });

  it('creates a CV from a PDF and keeps its bytes as the Source', async () => {
    const { agent } = await givenUser(testApp);
    const pdf = await pdfWithPages(PDF_LIMITS.maxPages);

    const created = await postCv(agent, { pdf }).expect(201);

    const { cvId } = createCvResponseSchema.parse(created.body);
    const source = await prisma().source.findUniqueOrThrow({ where: { cvId } });
    expect(source.kind).toBe('pdf');
    expect(Buffer.from(source.bytes!)).toEqual(pdf);
  });

  describe('rejects a PDF before any Generation exists', () => {
    it.each([
      ['not a PDF', 415, 'not_a_pdf', () => Buffer.from('just some text')],
      [
        'over 5 MB',
        413,
        'file_too_large',
        () => pdfLargerThan(PDF_LIMITS.maxBytes),
      ],
      [
        'over 5 pages',
        422,
        'pdf_too_many_pages',
        () => pdfWithPages(PDF_LIMITS.maxPages + 1),
      ],
      ['encrypted', 422, 'pdf_encrypted', encryptedPdf],
      ['corrupt', 422, 'pdf_unreadable', corruptPdf],
    ])('%s → %i %s', async (_case, status, code, makePdf) => {
      const { agent } = await givenUser(testApp);

      const response = await postCv(agent, { pdf: await makePdf() });

      expect(response.status).toBe(status);
      expect(apiErrorSchema.parse(response.body).error.code).toBe(code);
      expect(await prisma().cv.count()).toBe(0);
    });
  });

  describe('validation', () => {
    it.each<[string, () => Promise<CreateCvRequest>]>([
      [
        'both a PDF and text',
        async () => ({ text: SAMPLE_TEXT_SOURCE, pdf: await pdfWithPages(1) }),
      ],
      ['neither a PDF nor text', async () => ({})],
      [
        'text under 50 characters',
        async () => ({ text: 'Too short to be a background.' }),
      ],
      [
        'a one-letter Target role',
        async () => ({ text: SAMPLE_TEXT_SOURCE, targetRole: 'X' }),
      ],
      [
        'no Idempotency-Key',
        async () => ({ text: SAMPLE_TEXT_SOURCE, idempotencyKey: null }),
      ],
    ])('rejects %s with 400 validation_failed', async (_case, makeRequest) => {
      const { agent } = await givenUser(testApp);

      const response = await postCv(agent, await makeRequest()).expect(400);

      expect(apiErrorSchema.parse(response.body).error.code).toBe(
        'validation_failed',
      );
    });

    it('stores the Target role on one line, trimmed', async () => {
      const { agent } = await givenUser(testApp);

      const created = await postCv(agent, {
        text: SAMPLE_TEXT_SOURCE,
        targetRole: '  Senior\nBackend   Engineer ',
      }).expect(201);

      const cv = await prisma().cv.findUniqueOrThrow({
        where: { id: created.body.cvId as string },
      });
      expect(cv.targetRole).toBe('Senior Backend Engineer');
    });
  });

  it('replays a known Idempotency-Key: same cvId, one Generation', async () => {
    const { agent } = await givenUser(testApp);
    const idempotencyKey = randomUUID();

    const first = await postCv(agent, {
      text: SAMPLE_TEXT_SOURCE,
      idempotencyKey,
    }).expect(201);
    const replay = await postCv(agent, {
      text: SAMPLE_TEXT_SOURCE,
      idempotencyKey,
    }).expect(200);

    expect(replay.body).toEqual(first.body);
    expect(await prisma().generation.count()).toBe(1);
  });

  it('does not share Idempotency-Keys between Users', async () => {
    const ada = await givenUser(testApp);
    const bob = await givenUser(testApp);
    const idempotencyKey = randomUUID();

    const first = await postCv(ada.agent, {
      text: SAMPLE_TEXT_SOURCE,
      idempotencyKey,
    }).expect(201);
    const second = await postCv(bob.agent, {
      text: SAMPLE_TEXT_SOURCE,
      idempotencyKey,
    }).expect(201);

    expect(second.body.cvId).not.toBe(first.body.cvId);
  });

  it('lets exactly 3 of 5 concurrent creates through; the rest get 429', async () => {
    const { agent } = await givenUser(testApp);

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        postCv(agent, { text: SAMPLE_TEXT_SOURCE }),
      ),
    );

    const statuses = responses
      .map((response) => response.status)
      .sort((a, b) => a - b);
    expect(statuses).toEqual([201, 201, 201, 429, 429]);
    const rejected = responses.find((response) => response.status === 429)!;
    expect(apiErrorSchema.parse(rejected.body).error.code).toBe(
      'too_many_active_generations',
    );
    expect(await prisma().generation.count()).toBe(3);
  });
});
