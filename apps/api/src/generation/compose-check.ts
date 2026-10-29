import {
  type Anchor,
  type CvContent,
  cvContentSchema,
  type CvField,
  type CvSection,
} from '@ai-cv-builder/shared';
import { randomUUID } from 'node:crypto';
import {
  type ComposeOutput,
  type Fact,
  InvalidAiOutputError,
} from '../ai/cv-ai.js';
import { type DraftQuestion, questionText } from './judge-check.js';

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

/** The fields an Anchor may name, per section; a bullet's only field is `text`. */
const FIELDS: Record<CvSection, readonly CvField[]> = {
  contact: ['fullName', 'email', 'phone', 'location', 'links'],
  summary: ['text'],
  experience: [
    'organization',
    'title',
    'startDate',
    'endDate',
    'location',
    'bullets',
  ],
  education: ['institution', 'degree', 'field', 'startDate', 'endDate'],
  skills: ['name'],
};

/**
 * Turns compose's Questions, which point at items by index, into Anchors on the
 * server-assigned ids of `content` (built from the same output, so indexes
 * match). A Question naming an item or field that does not exist is a
 * structural failure.
 */
export function anchorComposeQuestions(
  questions: ComposeOutput['questions'],
  content: CvContent,
): DraftQuestion[] {
  return questions.map((question, i) => {
    const path = `questions.${i}`;
    const fail = (why: string): never => {
      throw new InvalidAiOutputError('compose', `${path} ${why}`);
    };
    const { section, itemIndex, bulletIndex, field } = question;
    const text = questionText('compose', question.text, path);

    // Contact and summary are one item each: their indexes say nothing.
    if (section === 'contact' || section === 'summary' || itemIndex === null) {
      if (field !== null && !FIELDS[section].includes(field)) {
        fail(`names a field ${section} does not have`);
      }
      const whole = section !== 'contact' && section !== 'summary';
      return {
        anchor: { section, itemId: null, field: whole ? null : field },
        text,
      };
    }

    const items: { id: string }[] = content[section];
    const item =
      items[itemIndex] ??
      fail(`names ${section} item ${itemIndex}, which does not exist`);

    if (bulletIndex !== null) {
      const bullet =
        (section === 'experience'
          ? content.experience[itemIndex]?.bullets[bulletIndex]
          : undefined) ?? fail('names a bullet that does not exist');
      if (field !== null && field !== 'text') {
        fail('names a field bullets do not have');
      }
      return { anchor: { section, itemId: bullet.id, field }, text };
    }
    if (field !== null && !FIELDS[section].includes(field)) {
      fail(`names a field ${section} does not have`);
    }
    return { anchor: { section, itemId: item.id, field }, text };
  });
}

/** The Question for each Experience field the Facts may leave unknown. */
const UNKNOWN_EXPERIENCE: {
  field: 'organization' | 'title' | 'startDate' | 'endDate';
  text: string;
}[] = [
  { field: 'organization', text: 'What is the name of the organization?' },
  { field: 'title', text: 'What was your title or role there?' },
  { field: 'startDate', text: 'When did you start (month and year)?' },
  {
    field: 'endDate',
    text: 'When did it end (month and year), or is it your current role?',
  },
];

/**
 * A Question for every unknown name, email, organization, title or date that
 * `asked` does not already cover, so a gap is never left unasked when the
 * model forgot to ask.
 */
export function missingInfoQuestions(
  content: CvContent,
  asked: DraftQuestion[],
): DraftQuestion[] {
  const covered = new Set(asked.map(({ anchor }) => anchorKey(anchor)));
  const questions: DraftQuestion[] = [];
  const ask = (anchor: Anchor, text: string) => {
    if (!covered.has(anchorKey(anchor))) questions.push({ anchor, text });
  };

  if (content.contact.fullName === '') {
    ask(
      { section: 'contact', itemId: null, field: 'fullName' },
      'What is your full name?',
    );
  }
  if (content.contact.email === '') {
    ask(
      { section: 'contact', itemId: null, field: 'email' },
      'What email address should employers use?',
    );
  }
  for (const item of content.experience) {
    for (const { field, text } of UNKNOWN_EXPERIENCE) {
      if (item[field] === null) {
        ask({ section: 'experience', itemId: item.id, field }, text);
      }
    }
  }
  return questions;
}

/** A Question whose item is gone (softening dropped it) falls back to its section as a whole. */
export function reanchor(
  questions: DraftQuestion[],
  content: CvContent,
): DraftQuestion[] {
  const ids = new Set([
    ...content.experience.flatMap((e) => [e.id, ...e.bullets.map((b) => b.id)]),
    ...content.education.map((e) => e.id),
    ...content.skills.map((s) => s.id),
  ]);
  return questions.map((question) =>
    question.anchor.itemId === null || ids.has(question.anchor.itemId)
      ? question
      : {
          ...question,
          anchor: {
            section: question.anchor.section,
            itemId: null,
            field: null,
          },
        },
  );
}

const anchorKey = ({ section, itemId, field }: Anchor) =>
  `${section}/${itemId ?? ''}/${field ?? ''}`;
