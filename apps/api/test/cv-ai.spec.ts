import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CvAi } from '../src/ai/cv-ai.js';
import { AppModule } from '../src/app.module.js';
import { ScriptedCvAi } from './support/scripted-cv-ai.js';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('CvAi in tests', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('is the scripted fake in every test app', () => {
    expect(testApp.app.get(CvAi)).toBeInstanceOf(ScriptedCvAi);
    expect(testApp.app.get(CvAi)).toBe(testApp.cvAi);
  });

  it('refuses to start the app with the real Anthropic adapter', async () => {
    await expect(
      Test.createTestingModule({ imports: [AppModule] }).compile(),
    ).rejects.toThrow(/real Anthropic adapter/);
  });
});
