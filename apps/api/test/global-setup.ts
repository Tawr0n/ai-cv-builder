import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { execFileSync } from 'node:child_process';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/** One Postgres per test run, migrated the same way the api container migrates on boot. */
export default async function setup(project: TestProject) {
  const container = await new PostgreSqlContainer('postgres:18').start();
  const databaseUrl = container.getConnectionUri();

  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
  project.provide('databaseUrl', databaseUrl);

  return async () => {
    await container.stop();
  };
}
