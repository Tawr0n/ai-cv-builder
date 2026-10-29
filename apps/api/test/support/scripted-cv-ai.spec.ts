import { describe, expect, it } from 'vitest';
import type { CvAiInput, CvAiOutput } from '../../src/ai/cv-ai.js';
import { sampleFacts } from './cv-ai-fixtures.js';
import { ScriptedCvAi } from './scripted-cv-ai.js';

const verdict = (problem: string): CvAiOutput<'judge'> => ({
  findings: [
    {
      itemId: 'summary',
      field: 'text',
      problem,
      softened: null,
      question: '?',
    },
  ],
});
const fix = (value: string): CvAiOutput<'repair'> => ({
  fixes: [{ itemId: 'summary', field: 'text', value, sourceFactIds: ['f1'] }],
});
const judgeInput = (value: string): CvAiInput<'judge'> => ({
  facts: sampleFacts(),
  claims: [
    {
      itemId: 'summary',
      section: 'summary',
      field: 'text',
      value,
      sourceFactIds: ['f1'],
    },
  ],
});
const repairInput = (targetRole: string): CvAiInput<'repair'> => ({
  facts: sampleFacts(),
  targetRole,
  flagged: [],
});

describe('ScriptedCvAi', () => {
  it('returns the scripted results of a step in order', async () => {
    const cvAi = new ScriptedCvAi().returns(
      'judge',
      verdict('first'),
      verdict('second'),
    );

    await expect(cvAi.judge(judgeInput('a'))).resolves.toEqual(
      verdict('first'),
    );
    await expect(cvAi.judge(judgeInput('b'))).resolves.toEqual(
      verdict('second'),
    );
  });

  it('throws a scripted error in its turn', async () => {
    const overloaded = new Error('529 overloaded');
    const cvAi = new ScriptedCvAi()
      .throws('repair', overloaded)
      .returns('repair', fix('repaired'));

    await expect(cvAi.repair(repairInput('a'))).rejects.toBe(overloaded);
    await expect(cvAi.repair(repairInput('a'))).resolves.toEqual(
      fix('repaired'),
    );
  });

  it('runs a scripted function with the call input', async () => {
    const cvAi = new ScriptedCvAi().runs('judge', (input) =>
      Promise.resolve(verdict(`judged ${input.claims[0]?.value}`)),
    );

    await expect(cvAi.judge(judgeInput('draft'))).resolves.toEqual(
      verdict('judged draft'),
    );
  });

  it('fails a call nobody scripted instead of guessing a result', async () => {
    const cvAi = new ScriptedCvAi().returns('repair', fix('repaired'));

    await expect(cvAi.judge(judgeInput('cv content'))).rejects.toThrow(
      'ScriptedCvAi: unexpected call to judge',
    );
  });

  it('records the input of every call per step', async () => {
    const cvAi = new ScriptedCvAi().returns(
      'repair',
      fix('fixed'),
      fix('fixed again'),
    );

    await cvAi.repair(repairInput('broken'));
    await cvAi.repair(repairInput('still broken'));

    expect(cvAi.calls.repair).toEqual([
      repairInput('broken'),
      repairInput('still broken'),
    ]);
    expect(cvAi.calls.extract).toEqual([]);
  });

  it('reports scripted results no call consumed', () => {
    const cvAi = new ScriptedCvAi().returns('judge', verdict('unused'));

    expect(() => cvAi.assertAllConsumed()).toThrow(
      'ScriptedCvAi: 1 scripted judge result(s) never used',
    );
  });
});
