import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // SWC emits the decorator metadata Nest's dependency injection relies on.
  plugins: [swc.vite()],
  test: {
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    globalSetup: ['test/global-setup.ts'],
    setupFiles: ['test/setup.ts'],
    // Every file shares one Postgres and truncates it before each test.
    fileParallelism: false,
    env: {
      ANTHROPIC_API_KEY: 'never-used-by-tests',
      // Tests run the Generation handler directly; one test turns the worker on.
      GENERATION_WORKER: 'false',
    },
  },
});
