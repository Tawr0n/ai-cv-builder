import { z } from 'zod';
import { textField } from './text.js';

export const CV_SECTIONS = [
  'contact',
  'summary',
  'experience',
  'education',
  'skills',
] as const;

/** Every field name an Anchor may point at, across all sections (`text` is a summary's or a bullet's). */
export const CV_FIELDS = [
  'fullName',
  'email',
  'phone',
  'location',
  'links',
  'text',
  'organization',
  'title',
  'startDate',
  'endDate',
  'bullets',
  'institution',
  'degree',
  'field',
  'name',
] as const;

export const QUESTION_STATUSES = [
  'open',
  'answered',
  'dismissed',
  'obsolete',
] as const;

export const QUESTION_LIMITS = { text: 500, answer: 1000 } as const;

export type CvSection = (typeof CV_SECTIONS)[number];
export type CvField = (typeof CV_FIELDS)[number];

/**
 * The place in the CV content a Question is about: a section, optionally an
 * item within it (`itemId`, any item including a bullet; `null` for contact
 * and summary, which are one item each), optionally a field of it.
 */
export const anchorSchema = z
  .object({
    section: z.enum(CV_SECTIONS),
    itemId: z.uuid().nullable(),
    field: z.enum(CV_FIELDS).nullable(),
  })
  .meta({ id: 'Anchor' });

export const questionSchema = z
  .object({
    id: z.uuid(),
    anchor: anchorSchema,
    text: z.string(),
    status: z.enum(QUESTION_STATUSES),
    /** The User's Answer; `null` until they answer. */
    answer: z.string().nullable(),
    /** When Update CV turned the Answer into a Fact; `null` while it is pending (and editable). */
    appliedAt: z.iso.datetime().nullable(),
    /** A running Update CV is applying this Answer: it cannot change until that ends. */
    locked: z.boolean(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'Question' });

/** `PUT /api/cvs/:cvId/questions/:questionId/answer`: saves a pending Answer, or changes it. */
export const answerQuestionSchema = z
  .strictObject({ answer: textField(1, QUESTION_LIMITS.answer) })
  .meta({ id: 'AnswerQuestion' });

/** `GET /api/cvs/:cvId/questions`: most important first. */
export const questionListSchema = z
  .object({ items: z.array(questionSchema) })
  .meta({ id: 'QuestionList' });

export type Anchor = z.infer<typeof anchorSchema>;
export type Question = z.infer<typeof questionSchema>;
export type QuestionList = z.infer<typeof questionListSchema>;
export type AnswerQuestion = z.infer<typeof answerQuestionSchema>;

/** Answered, but Update CV has not applied it yet. */
export const isPendingAnswer = (question: Question) =>
  question.status === 'answered' && question.appliedAt === null;
