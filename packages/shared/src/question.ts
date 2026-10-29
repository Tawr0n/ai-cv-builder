import { z } from 'zod';

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

export const QUESTION_LIMITS = { text: 500 } as const;

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
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'Question' });

/** `GET /api/cvs/:cvId/questions`: most important first. */
export const questionListSchema = z
  .object({ items: z.array(questionSchema) })
  .meta({ id: 'QuestionList' });

export type Anchor = z.infer<typeof anchorSchema>;
export type Question = z.infer<typeof questionSchema>;
export type QuestionList = z.infer<typeof questionListSchema>;
