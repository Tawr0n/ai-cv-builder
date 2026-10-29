import { type CvContent, cvContentSchema } from '@ai-cv-builder/shared';
import { randomUUID } from 'node:crypto';
import {
  type ComposeOutput,
  type Fact,
  InvalidAiOutputError,
} from '../ai/cv-ai.js';

const NEW_ITEM = { rev: 1, edited: false } as const;

/**
 * The structural check on compose output, and the only way it becomes CV
 * content: every item gets a server-assigned id, then the result must pass the
 * CV content schema (field limits included) and every item that says anything
 * must cite Facts that exist. Throws {@link InvalidAiOutputError} otherwise.
 * Meaning-level checks (does the Fact really support the item?) are the judge's.
 */
export function checkComposeOutput(
  output: ComposeOutput,
  facts: Fact[],
  newId: () => string = randomUUID,
): CvContent {
  const { contact, summary, experience, education, skills } = output;
  const candidate = {
    contact: { ...contact, ...NEW_ITEM },
    summary: { ...summary, ...NEW_ITEM },
    experience: experience.map(({ bullets, ...item }) => ({
      id: newId(),
      ...item,
      bullets: bullets.map((bullet) => ({
        id: newId(),
        ...bullet,
        ...NEW_ITEM,
      })),
      ...NEW_ITEM,
    })),
    education: education.map((item) => ({ id: newId(), ...item, ...NEW_ITEM })),
    skills: skills.map((item) => ({ id: newId(), ...item, ...NEW_ITEM })),
  };

  const parsed = cvContentSchema.safeParse(candidate);
  if (!parsed.success) {
    const where = parsed.error.issues.map((issue) => issue.path.join('.'));
    throw new InvalidAiOutputError(
      'compose',
      `invalid fields: ${where.join(', ')}`,
    );
  }

  const problems = citationProblems(
    parsed.data,
    new Set(facts.map((f) => f.id)),
  );
  if (problems.length > 0) {
    throw new InvalidAiOutputError('compose', problems.join('; '));
  }
  return parsed.data;
}

function citationProblems(content: CvContent, factIds: Set<string>): string[] {
  const problems: string[] = [];
  /** `required`: the item says something, so it must rest on at least one Fact. */
  const check = (path: string, cited: string[], required = true) => {
    if (required && cited.length === 0) problems.push(`${path} is uncited`);
    const unknown = cited.filter((id) => !factIds.has(id));
    if (unknown.length > 0) {
      problems.push(`${path} cites unknown Facts ${unknown.join(', ')}`);
    }
  };

  const { contact, summary } = content;
  check(
    'contact',
    contact.sourceFactIds,
    [contact.fullName, contact.email, contact.phone, contact.location].some(
      Boolean,
    ) || contact.links.length > 0,
  );
  check('summary', summary.sourceFactIds, summary.text !== '');
  content.experience.forEach((item, i) => {
    check(`experience.${i}`, item.sourceFactIds);
    item.bullets.forEach((bullet, j) =>
      check(`experience.${i}.bullets.${j}`, bullet.sourceFactIds),
    );
  });
  content.education.forEach((item, i) =>
    check(`education.${i}`, item.sourceFactIds),
  );
  content.skills.forEach((item, i) => check(`skills.${i}`, item.sourceFactIds));
  return problems;
}
