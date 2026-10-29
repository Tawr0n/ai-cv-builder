import type { CvContent } from '@ai-cv-builder/shared';
import { z } from 'zod';
import {
  type UpdateOutput,
  type UpdateScope,
  updateOutputSchema,
} from './cv-ai.js';

/** Which parts of `UpdateOutput` one call asks the model for. */
export interface UpdateParts {
  contact: boolean;
  summary: boolean;
  experience: boolean;
  education: boolean;
  skills: boolean;
}

export interface UpdateCall {
  scope: UpdateScope;
  parts: UpdateParts;
}

/**
 * The calls one Update CV takes. The structured-outputs grammar the API
 * compiles from the schema has a size limit, and update's schema (every part,
 * with an `id` on every item) is over it, so a call only asks for the parts
 * the scope touches. The contact together with all three lists is still over
 * it: the contact then gets a call of its own.
 */
export function updateCalls(
  scope: UpdateScope,
  content: CvContent,
): UpdateCall[] {
  const touches = (section: 'experience' | 'education' | 'skills') =>
    scope.sections.includes(section) ||
    content[section].some(({ id }) => scope.itemIds.includes(id));
  const parts: UpdateParts = {
    contact: scope.contact,
    summary: scope.summary,
    experience: touches('experience'),
    education: touches('education'),
    skills: touches('skills'),
  };

  if (parts.contact && parts.experience && parts.education && parts.skills) {
    return [
      {
        scope: { contact: true, summary: false, itemIds: [], sections: [] },
        parts: {
          contact: true,
          summary: false,
          experience: false,
          education: false,
          skills: false,
        },
      },
      {
        scope: { ...scope, contact: false },
        parts: { ...parts, contact: false },
      },
    ];
  }
  return [{ scope, parts }];
}

/** `updateOutputSchema` cut down to `parts` (and the Questions, always). */
export function updateSchemaFor(
  parts: UpdateParts,
): z.ZodType<Partial<UpdateOutput>> {
  const { shape } = updateOutputSchema;
  // The conditional spreads lose their types; the shape is a subset of `updateOutputSchema`'s.
  return z.object({
    ...(parts.contact ? { contact: shape.contact.unwrap() } : {}),
    ...(parts.summary ? { summary: shape.summary.unwrap() } : {}),
    ...(parts.experience ? { experience: shape.experience } : {}),
    ...(parts.education ? { education: shape.education } : {}),
    ...(parts.skills ? { skills: shape.skills } : {}),
    questions: shape.questions,
  }) as unknown as z.ZodType<Partial<UpdateOutput>>;
}

/** The answers of several calls as one `UpdateOutput`; a part no call asked for is null or empty. */
export function mergeUpdateOutputs(
  outputs: Partial<UpdateOutput>[],
): UpdateOutput {
  const merged: UpdateOutput = {
    contact: null,
    summary: null,
    experience: [],
    education: [],
    skills: [],
    questions: [],
  };
  for (const output of outputs) {
    merged.contact = output.contact ?? merged.contact;
    merged.summary = output.summary ?? merged.summary;
    merged.experience.push(...(output.experience ?? []));
    merged.education.push(...(output.education ?? []));
    merged.skills.push(...(output.skills ?? []));
    merged.questions.push(...(output.questions ?? []));
  }
  return merged;
}
