import { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, inject, vi } from 'vitest';

// Tests never spend money: an app that still holds the real model adapter
// (not built through createTestApp()) fails as soon as Nest constructs it.
vi.mock('../src/ai/anthropic-cv-ai.js', () => ({
  AnthropicCvAi: class {
    constructor() {
      throw new Error(
        'The real Anthropic adapter must never run in tests: build the app with createTestApp(), which replaces CvAi with ScriptedCvAi.',
      );
    }
  },
}));

process.env.DATABASE_URL = inject('databaseUrl');

const db = new Client({ connectionString: process.env.DATABASE_URL });

beforeAll(async () => {
  await db.connect();
});

beforeEach(async () => {
  const { rows } = await db.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables
     WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  if (rows.length > 0) {
    const tables = rows.map(({ tablename }) => `"${tablename}"`).join(', ');
    await db.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
  }

  // pg-boss jobs too: otherwise jobs queued by earlier files pile up ahead of
  // the one a real-queue test is waiting for. Queue definitions stay.
  const { rows: boss } = await db.query<{ job: string | null }>(
    `SELECT to_regclass('pgboss.job')::text AS job`,
  );
  if (boss[0]?.job) await db.query('TRUNCATE pgboss.job CASCADE');
});

afterAll(async () => {
  await db.end();
});
