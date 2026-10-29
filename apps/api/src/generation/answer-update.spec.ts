import type { CvContent } from '@ai-cv-builder/shared';
import { describe, expect, it } from 'vitest';
import {
  composeOutput,
  sampleFacts,
} from '../../test/support/cv-ai-fixtures.js';
import {
  InvalidAiOutputError,
  type UpdateOutput,
  type UpdateScope,
} from '../ai/cv-ai.js';
import { checkUpdateOutput, targetOf } from './answer-update.js';
import { checkComposeOutput } from './compose-check.js';

let next = 0;
const newId = () =>
  `00000000-0000-4000-8000-${String(++next).padStart(12, '0')}`;

/** The sample CV, its bullet edited by the User. */
function sampleContent(): CvContent {
  const content = checkComposeOutput(composeOutput(), sampleFacts(), newId);
  content.experience[0]!.bullets[0]!.edited = true;
  return content;
}

const experienceScope = (content: CvContent): UpdateScope => ({
  contact: false,
  summary: false,
  itemIds: [content.experience[0]!.id],
  sections: [],
});

function update(
  content: CvContent,
  experience: UpdateOutput['experience'],
): UpdateOutput {
  return {
    contact: null,
    summary: null,
    experience,
    education: [],
    skills: [],
    questions: [],
  };
}

function experienceOut(content: CvContent) {
  const { id, organization, title, startDate, endDate, location, bullets } =
    content.experience[0]!;
  return {
    id,
    organization,
    title,
    startDate,
    endDate,
    location,
    sourceFactIds: ['f3'],
    bullets: bullets.map(({ id: bulletId, text }) => ({
      id: bulletId,
      text,
      sourceFactIds: ['f4'],
    })),
  };
}

function rejectionOf(run: () => unknown): InvalidAiOutputError {
  try {
    run();
  } catch (error) {
    if (error instanceof InvalidAiOutputError) return error;
    throw error;
  }
  throw new Error('expected the check to reject the output');
}

describe('checkUpdateOutput', () => {
  it('keeps an Edited bullet as the User wrote it, even when the model rewrites or drops it', () => {
    const content = sampleContent();
    const [bullet] = content.experience[0]!.bullets;
    const rewritten = {
      ...experienceOut(content),
      location: 'London',
      bullets: [
        { id: bullet!.id, text: 'Something else.', sourceFactIds: ['f4'] },
      ],
    };

    const kept = checkUpdateOutput(
      update(content, [rewritten]),
      content,
      experienceScope(content),
      sampleFacts(),
    );
    const dropped = checkUpdateOutput(
      update(content, [{ ...rewritten, bullets: [] }]),
      content,
      experienceScope(content),
      sampleFacts(),
    );

    expect(kept.content.experience[0]).toMatchObject({
      location: 'London',
      bullets: [bullet],
    });
    expect(dropped.content.experience[0]!.bullets).toEqual([bullet]);
  });

  it.each([
    [
      'an item that is not in scope',
      (content: CvContent): UpdateOutput => ({
        ...update(content, []),
        summary: { text: 'Rewritten.', sourceFactIds: ['f3'] },
      }),
    ],
    [
      'a new item in a section that is not in scope',
      (content: CvContent) =>
        update(content, [
          experienceOut(content),
          { ...experienceOut(content), id: null },
        ]),
    ],
    [
      'a citation of a Fact that does not exist',
      (content: CvContent) =>
        update(content, [
          { ...experienceOut(content), sourceFactIds: ['f99'] },
        ]),
    ],
    [
      'a bullet of another item',
      (content: CvContent) =>
        update(content, [
          {
            ...experienceOut(content),
            bullets: [{ id: newId(), text: 'x', sourceFactIds: ['f4'] }],
          },
        ]),
    ],
    [
      'a Question about an item that does not exist',
      (content: CvContent): UpdateOutput => ({
        ...update(content, [experienceOut(content)]),
        questions: [
          {
            section: 'experience',
            itemId: newId(),
            field: null,
            text: 'Where?',
          },
        ],
      }),
    ],
  ])('rejects %s', (_, output) => {
    const content = sampleContent();

    const error = rejectionOf(() =>
      checkUpdateOutput(
        output(content),
        content,
        experienceScope(content),
        sampleFacts(),
      ),
    );

    expect(error.step).toBe('update');
  });

  it('appends a new item when its section is in scope', () => {
    const content = sampleContent();

    const { content: updated } = checkUpdateOutput(
      update(content, [{ ...experienceOut(content), id: null, bullets: [] }]),
      content,
      { contact: false, summary: false, itemIds: [], sections: ['experience'] },
      sampleFacts(),
      newId,
    );

    expect(updated.experience).toHaveLength(2);
    expect(updated.experience[1]).toMatchObject({ rev: 1, edited: false });
  });
});

describe('targetOf', () => {
  it("lands an Answer about a bullet on the bullet's Experience", () => {
    const content = sampleContent();
    content.experience[0]!.bullets[0]!.edited = false;
    const [experience] = content.experience;

    expect(
      targetOf(
        {
          section: 'experience',
          itemId: experience!.bullets[0]!.id,
          field: 'text',
        },
        content,
      ),
    ).toEqual({
      kind: 'scope',
      key: `item:${experience!.id}`,
      section: 'experience',
    });
  });

  it('lands nowhere when the item is gone or Edited', () => {
    const content = sampleContent();
    content.summary.edited = true;

    expect(
      targetOf(
        { section: 'experience', itemId: newId(), field: null },
        content,
      ),
    ).toEqual({ kind: 'gone' });
    expect(
      targetOf({ section: 'summary', itemId: null, field: 'text' }, content),
    ).toEqual({ kind: 'edited' });
  });
});
