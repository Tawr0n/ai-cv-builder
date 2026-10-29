import { type CvContent, cvContentSchema } from '@ai-cv-builder/shared';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/database/prisma.service.js';
import { postCv, SAMPLE_TEXT_SOURCE } from './support/create-cv.js';
import { givenUser } from './support/given-user.js';
import { createTestApp, type TestApp } from './support/test-app.js';

type Agent = ReturnType<typeof request.agent>;

const meta = { rev: 1, edited: false, sourceFactIds: [] as string[] };

function content(overrides: Partial<CvContent> = {}): CvContent {
  return cvContentSchema.parse({
    contact: {
      fullName: 'Олена Шевченко',
      email: 'olena@example.com',
      phone: null,
      location: 'Київ',
      links: ['https://example.com/olena'],
      ...meta,
    },
    summary: { text: 'Бекенд-інженерка з досвідом у Node.js.', ...meta },
    experience: [
      {
        id: randomUUID(),
        organization: 'Аналітичні двигуни',
        title: 'Backend Engineer',
        startDate: '2019',
        endDate: 'present',
        location: null,
        bullets: [
          { id: randomUUID(), text: 'Зробила білінговий сервіс.', ...meta },
        ],
        ...meta,
      },
    ],
    education: [],
    skills: [{ id: randomUUID(), name: 'Node.js', ...meta }],
    ...overrides,
  });
}

/** Text of a PDF as a reader would select it. */
function pdfText(bytes: Buffer): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'cv-pdf-'));
  try {
    const file = path.join(dir, 'cv.pdf');
    writeFileSync(file, bytes);
    return execFileSync('pdftotext', [file, '-'], { encoding: 'utf8' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** `GET /pdf`, with the body collected as bytes rather than parsed. */
function getPdf(agent: Agent, cvId: string) {
  return agent
    .get(`/api/cvs/${cvId}/pdf`)
    .buffer(true)
    .parse((res, done) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => done(null, Buffer.concat(chunks)));
    });
}

describe('GET /api/cvs/:cvId/pdf', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  /** A CV of a fresh User; `ready` is the content of a finished CV, `null` leaves it generating. */
  async function givenCv(ready: CvContent | null) {
    const user = await givenUser(testApp);
    const created = await postCv(user.agent, {
      text: SAMPLE_TEXT_SOURCE,
    }).expect(201);
    const cvId = created.body.cvId as string;
    if (ready) {
      await testApp.app.get(PrismaService).cv.update({
        where: { id: cvId },
        data: { status: 'ready', content: ready },
      });
    }
    return { ...user, cvId };
  }

  it("answers 404 for another User's CV, exactly as for a missing one", async () => {
    const { cvId } = await givenCv(content());
    const stranger = await givenUser(testApp);

    const foreign = await stranger.agent.get(`/api/cvs/${cvId}/pdf`);
    const missing = await stranger.agent.get(`/api/cvs/${randomUUID()}/pdf`);

    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual(missing.body);
  });

  it('answers 409 cv_not_ready while the CV is still generating', async () => {
    const { agent, cvId } = await givenCv(null);

    const response = await agent.get(`/api/cvs/${cvId}/pdf`).expect(409);

    expect(response.body.error.code).toBe('cv_not_ready');
  });

  it('downloads an A4 PDF whose text is selectable, Cyrillic included', async () => {
    const { agent, cvId } = await givenCv(content());

    const response = await getPdf(agent, cvId).expect(200);

    expect(response.headers['content-type']).toBe('application/pdf');
    expect(response.headers['content-disposition']).toMatch(/^attachment;/);
    const bytes = response.body as Buffer;
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    const text = pdfText(bytes);
    expect(text).toContain('Олена Шевченко');
    expect(text).toContain('Node.js');
    // A4 is 210 x 297 mm = 595.3 x 841.9 pt; Chromium rounds the box a little.
    const box = /\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/.exec(
      bytes.toString('latin1'),
    );
    expect(Number(box?.[1])).toBeCloseTo(595.3, 0);
    expect(Number(box?.[2])).toBeCloseTo(841.9, 0);
  }, 30_000);

  it('embeds Inter, so the look does not depend on the fonts installed', async () => {
    const { agent, cvId } = await givenCv(content());

    const response = await getPdf(agent, cvId).expect(200);

    const dir = mkdtempSync(path.join(tmpdir(), 'cv-pdf-'));
    try {
      const file = path.join(dir, 'cv.pdf');
      writeFileSync(file, response.body as Buffer);
      const fonts = execFileSync('pdffonts', [file], { encoding: 'utf8' });
      expect(fonts).toMatch(/Inter/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  it('answers 503 pdf_render_failed when a render takes too long', async () => {
    const slow = await createTestApp({ PDF_RENDER_TIMEOUT_MS: '1' });
    try {
      const user = await givenUser(slow);
      const created = await postCv(user.agent, {
        text: SAMPLE_TEXT_SOURCE,
      }).expect(201);
      const cvId = created.body.cvId as string;
      await slow.app.get(PrismaService).cv.update({
        where: { id: cvId },
        data: { status: 'ready', content: content() },
      });

      const response = await user.agent.get(`/api/cvs/${cvId}/pdf`).expect(503);

      expect(response.body.error.code).toBe('pdf_render_failed');
    } finally {
      await slow.app.close();
    }
  }, 30_000);

  it('prints markup in a field as text', async () => {
    const hostile = '<script>alert(1)</script><img src=x onerror=alert(1)>';
    const { agent, cvId } = await givenCv(
      content({ summary: { text: hostile, ...meta } }),
    );

    const response = await getPdf(agent, cvId).expect(200);

    expect(pdfText(response.body as Buffer)).toContain(hostile);
  }, 30_000);
});
