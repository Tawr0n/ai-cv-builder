import { randomUUID } from 'node:crypto';
import type request from 'supertest';

type Agent = ReturnType<typeof request.agent>;

export const SAMPLE_TEXT_SOURCE =
  'Ada Lovelace, ada@example.com. Backend engineer at Analytical Engines Ltd since 2019: built the billing service in Node.js.';

export interface CreateCvRequest {
  targetRole?: string;
  text?: string;
  pdf?: Buffer;
  idempotencyKey?: string | null;
}

/** `POST /api/cvs` as the create form sends it: multipart, with an `Idempotency-Key`. */
export function postCv(
  agent: Agent,
  {
    targetRole = 'Senior Backend Engineer',
    text,
    pdf,
    idempotencyKey = randomUUID(),
  }: CreateCvRequest = {},
) {
  let req = agent.post('/api/cvs').field('targetRole', targetRole);
  if (idempotencyKey !== null) req = req.set('idempotency-key', idempotencyKey);
  if (text !== undefined) req = req.field('text', text);
  if (pdf) {
    req = req.attach('file', pdf, {
      filename: 'cv.pdf',
      contentType: 'application/pdf',
    });
  }
  return req;
}
