import { CV_LIMITS } from '@ai-cv-builder/shared';
import { describe, expect, it } from 'vitest';
import {
  composeOutput,
  sampleFacts,
} from '../../test/support/cv-ai-fixtures.js';
import { type ComposeOutput, InvalidAiOutputError } from '../ai/cv-ai.js';
import { checkComposeOutput } from './compose-check.js';

function rejectionOf(output: ComposeOutput): InvalidAiOutputError {
  try {
    checkComposeOutput(output, sampleFacts());
  } catch (error) {
    if (error instanceof InvalidAiOutputError) return error;
    throw error;
  }
  throw new Error('expected the check to reject the output');
}

function withBullet(text: string, sourceFactIds = ['f4']): ComposeOutput {
  const output = composeOutput();
  output.experience[0]!.bullets = [{ text, sourceFactIds }];
  return output;
}

describe('checkComposeOutput', () => {
  it('turns compose output into CV content with server-assigned ids', () => {
    let next = 0;
    const id = () => `00000000-0000-4000-8000-00000000000${++next}`;

    const content = checkComposeOutput(composeOutput(), sampleFacts(), id);

    expect(content.experience).toEqual([
      expect.objectContaining({
        id: '00000000-0000-4000-8000-000000000001',
        organization: 'Analytical Engines Ltd',
        rev: 1,
        edited: false,
        bullets: [
          expect.objectContaining({
            id: '00000000-0000-4000-8000-000000000002',
            rev: 1,
            edited: false,
          }),
        ],
      }),
    ]);
    expect(content.skills[0]?.id).toBe('00000000-0000-4000-8000-000000000003');
    expect(content.contact).toMatchObject({ rev: 1, edited: false });
  });

  it('turns a blank unknown field into null', () => {
    const output = composeOutput();
    output.experience[0]!.organization = '   ';

    const content = checkComposeOutput(output, sampleFacts());

    expect(content.experience[0]?.organization).toBeNull();
  });

  it('accepts an empty summary without citations: it becomes a Question later', () => {
    const output = composeOutput();
    output.summary = { text: '', sourceFactIds: [] };

    expect(checkComposeOutput(output, sampleFacts()).summary.text).toBe('');
  });

  describe('structural failures', () => {
    it.each<[string, (output: ComposeOutput) => void]>([
      [
        'an uncited bullet',
        (o) => (o.experience[0]!.bullets[0]!.sourceFactIds = []),
      ],
      ['an uncited Experience', (o) => (o.experience[0]!.sourceFactIds = [])],
      ['an uncited skill', (o) => (o.skills[0]!.sourceFactIds = [])],
      ['an uncited summary', (o) => (o.summary.sourceFactIds = [])],
      ['uncited contact details', (o) => (o.contact.sourceFactIds = [])],
      ['an unknown Fact id', (o) => (o.skills[0]!.sourceFactIds = ['f99'])],
      [
        'a date that is not YYYY-MM',
        (o) => (o.experience[0]!.startDate = 'spring 2019'),
      ],
      ['an email that is not one', (o) => (o.contact.email = 'ada at example')],
    ])('rejects %s', (_case, breakOutput) => {
      const output = composeOutput();
      breakOutput(output);

      expect(rejectionOf(output).step).toBe('compose');
    });
  });

  describe('field limits (the same schema a hand edit must pass)', () => {
    it('accepts a bullet of exactly the limit', () => {
      const bullet = 'x'.repeat(CV_LIMITS.bullet);

      const content = checkComposeOutput(withBullet(bullet), sampleFacts());

      expect(content.experience[0]?.bullets[0]?.text).toBe(bullet);
    });

    it('rejects a bullet one character over the limit', () => {
      expect(
        rejectionOf(withBullet('x'.repeat(CV_LIMITS.bullet + 1))).reason,
      ).toMatch(/experience\.0\.bullets\.0\.text/);
    });

    it('rejects more bullets than an Experience may have', () => {
      const output = composeOutput();
      output.experience[0]!.bullets = Array.from(
        { length: CV_LIMITS.bulletsPerExperience + 1 },
        () => ({ text: 'Built it.', sourceFactIds: ['f4'] }),
      );

      expect(rejectionOf(output).reason).toMatch(/experience\.0\.bullets/);
    });

    it('rejects a summary over the limit', () => {
      const output = composeOutput();
      output.summary.text = 'x'.repeat(CV_LIMITS.summary + 1);

      expect(rejectionOf(output).reason).toMatch(/summary\.text/);
    });

    it('counts length after trimming and stripping control characters', () => {
      const bullet = `  ${'x'.repeat(CV_LIMITS.bullet)}\u0007  `;

      const content = checkComposeOutput(withBullet(bullet), sampleFacts());

      expect(content.experience[0]?.bullets[0]?.text).toHaveLength(
        CV_LIMITS.bullet,
      );
    });
  });
});
