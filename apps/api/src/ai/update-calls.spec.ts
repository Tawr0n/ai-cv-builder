import type { CvContent } from '@ai-cv-builder/shared';
import { describe, expect, it } from 'vitest';
import type { UpdateScope } from './cv-ai.js';
import { updateCalls } from './update-calls.js';

const content = {
  experience: [{ id: 'e1' }],
  education: [{ id: 'd1' }],
  skills: [{ id: 's1' }],
} as unknown as CvContent;

const nothing: UpdateScope = {
  contact: false,
  summary: false,
  itemIds: [],
  sections: [],
};

describe('updateCalls', () => {
  it('asks for only the parts the scope touches, in one call', () => {
    const scope = { ...nothing, itemIds: ['e1'], summary: true };

    expect(updateCalls(scope, content)).toEqual([
      {
        scope,
        parts: {
          contact: false,
          summary: true,
          experience: true,
          education: false,
          skills: false,
        },
      },
    ]);
  });

  it('counts a section in scope and an item of it alike', () => {
    const [call] = updateCalls(
      { ...nothing, sections: ['skills'], itemIds: ['d1'] },
      content,
    );

    expect(call!.parts).toMatchObject({
      experience: false,
      education: true,
      skills: true,
    });
  });

  it('splits the contact from the rest when all of it at once would not fit the structured-output grammar', () => {
    const scope = {
      contact: true,
      summary: true,
      itemIds: ['e1', 'd1', 's1'],
      sections: [],
    };

    const calls = updateCalls(scope, content);

    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({
      scope: { ...nothing, contact: true },
      parts: {
        contact: true,
        summary: false,
        experience: false,
        education: false,
        skills: false,
      },
    });
    expect(calls[1]).toEqual({
      scope: { ...scope, contact: false },
      parts: {
        contact: false,
        summary: true,
        experience: true,
        education: true,
        skills: true,
      },
    });
  });
});
