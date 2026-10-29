import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Not `env('DATABASE_URL')`: that throws when the variable is missing, and
  // `prisma generate` (run on install, in CI and in the image build) needs no database.
  datasource: { url: process.env.DATABASE_URL },
});
