import { describe, expect, it } from 'vitest';
import { ScriptedCvAi } from './scripted-cv-ai.js';

describe('ScriptedCvAi', () => {
  it('returns the scripted results of a step in order', async () => {
    const cvAi = new ScriptedCvAi().returns('judge', 'first', 'second');

    await expect(cvAi.judge('a')).resolves.toBe('first');
    await expect(cvAi.judge('b')).resolves.toBe('second');
  });

  it('throws a scripted error in its turn', async () => {
    const overloaded = new Error('529 overloaded');
    const cvAi = new ScriptedCvAi()
      .throws('repair', overloaded)
      .returns('repair', 'repaired');

    await expect(cvAi.repair('a')).rejects.toBe(overloaded);
    await expect(cvAi.repair('a')).resolves.toBe('repaired');
  });

  it('runs a scripted function with the call input', async () => {
    const cvAi = new ScriptedCvAi().runs('judge', (input) =>
      Promise.resolve(`judged ${String(input)}`),
    );

    await expect(cvAi.judge('draft')).resolves.toBe('judged draft');
  });

  it('fails a call nobody scripted instead of guessing a result', async () => {
    const cvAi = new ScriptedCvAi().returns('repair', 'repaired');

    await expect(cvAi.judge('cv content')).rejects.toThrow(
      'ScriptedCvAi: unexpected call to judge',
    );
  });

  it('records the input of every call per step', async () => {
    const cvAi = new ScriptedCvAi().returns('repair', 'fixed', 'fixed again');

    await cvAi.repair('broken');
    await cvAi.repair('still broken');

    expect(cvAi.calls.repair).toEqual(['broken', 'still broken']);
    expect(cvAi.calls.extract).toEqual([]);
  });

  it('reports scripted results no call consumed', () => {
    const cvAi = new ScriptedCvAi().returns('judge', 'verdict');

    expect(() => cvAi.assertAllConsumed()).toThrow(
      'ScriptedCvAi: 1 scripted judge result(s) never used',
    );
  });
});
