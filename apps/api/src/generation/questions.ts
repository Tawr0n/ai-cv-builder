import {
  type Anchor,
  cleanLine,
  type CvContent,
  type CvField,
  type CvSection,
  QUESTION_LIMITS,
} from '@ai-cv-builder/shared';
import {
  type ComposeOutput,
  type CvAiStep,
  InvalidAiOutputError,
} from '../ai/cv-ai.js';

/** A Question the pipeline asks, before it is stored. */
export interface DraftQuestion {
  anchor: Anchor;
  text: string;
}

/** A Question's text as stored: one clean line within the limit. */
export function questionText(
  step: CvAiStep,
  text: string,
  path: string,
): string {
  const line = cleanLine(text);
  if (line === '' || line.length > QUESTION_LIMITS.text) {
    throw new InvalidAiOutputError(
      step,
      `${path}.question is empty or too long`,
    );
  }
  return line;
}

/** The fields an Anchor may name, per section; a bullet's only field is `text`. */
export const ANCHOR_FIELDS: Record<CvSection, readonly CvField[]> = {
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

    const fieldOf = (fields: readonly CvField[], what: string) => {
      if (field !== null && !fields.includes(field)) {
        fail(`names a field ${what} do not have`);
      }
    };

    // Contact and summary are one item each: their indexes say nothing.
    if (section === 'contact' || section === 'summary' || itemIndex === null) {
      fieldOf(ANCHOR_FIELDS[section], section);
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
      // A bullet has one field, its text. `bullets` (the Experience field it
      // lives in) is what a model naturally writes next to a bulletIndex.
      const bulletField = field === 'bullets' ? 'text' : field;
      if (bulletField !== null && bulletField !== 'text') {
        fail('names a field bullets do not have');
      }
      return {
        anchor: { section, itemId: bullet.id, field: bulletField },
        text,
      };
    }
    fieldOf(ANCHOR_FIELDS[section], section);
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
 * A Question for every gap the CV must not keep that `asked` does not already
 * cover: an unknown name, email, summary, organization, title or date, or no
 * Experience and education at all. So a gap is never left unasked when the
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
  if (content.summary.text === '') {
    ask(
      { section: 'summary', itemId: null, field: 'text' },
      'How would you describe yourself for this role in a sentence or two?',
    );
  }
  if (content.experience.length === 0 && content.education.length === 0) {
    ask(
      { section: 'experience', itemId: null, field: null },
      'Do you have any jobs, internships, volunteering, projects or education to add?',
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
