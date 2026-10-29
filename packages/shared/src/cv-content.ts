import { z } from 'zod';
import { cleanLine, lineField, textField } from './text.js';

/**
 * Limits on CV content. The same schema guards a hand edit and AI output, so
 * the AI can never produce a CV the User could not save after one edit.
 */
export const CV_LIMITS = {
  shortField: 200,
  summary: 1500,
  bullet: 300,
  experience: 30,
  bulletsPerExperience: 15,
  education: 15,
  skills: 50,
  links: 10,
} as const;

/** `YYYY-MM`, or `YYYY` when the Source gives only the year. */
export const cvDateSchema = z
  .string()
  .regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/, 'Expected YYYY-MM or YYYY');

/** A short single-line field the Source may not state: blank becomes `null`. */
const unknownOrLine = z
  .string()
  .nullable()
  .transform((value) => (value === null ? null : cleanLine(value) || null))
  .pipe(z.string().max(CV_LIMITS.shortField).nullable());

const shortLine = lineField(0, CV_LIMITS.shortField);

/** Ids of the Facts an item rests on (`f1`, `f2`, ...). */
const sourceFactIds = z.array(z.string().min(1));

/** What every item carries besides its fields: optimistic-concurrency `rev`, hand-edit flag, cited Facts. */
const itemMeta = {
  rev: z.int().positive(),
  edited: z.boolean(),
  sourceFactIds,
};

export const cvContactSchema = z.object({
  fullName: shortLine,
  /** Empty until known; otherwise a valid address. */
  email: shortLine.pipe(z.union([z.literal(''), z.email()])),
  phone: unknownOrLine,
  location: unknownOrLine,
  links: z.array(lineField(1, CV_LIMITS.shortField)).max(CV_LIMITS.links),
  ...itemMeta,
});

export const cvSummarySchema = z.object({
  text: textField(0, CV_LIMITS.summary),
  ...itemMeta,
});

export const cvBulletSchema = z.object({
  id: z.uuid(),
  text: lineField(1, CV_LIMITS.bullet),
  ...itemMeta,
});

export const cvExperienceSchema = z.object({
  id: z.uuid(),
  organization: unknownOrLine,
  title: unknownOrLine,
  startDate: cvDateSchema.nullable(),
  /** `present` for a current role, `null` when unknown. */
  endDate: z.union([cvDateSchema, z.literal('present')]).nullable(),
  location: unknownOrLine,
  bullets: z.array(cvBulletSchema).max(CV_LIMITS.bulletsPerExperience),
  ...itemMeta,
});

export const cvEducationSchema = z.object({
  id: z.uuid(),
  institution: unknownOrLine,
  degree: unknownOrLine,
  field: unknownOrLine,
  startDate: cvDateSchema.nullable(),
  endDate: cvDateSchema.nullable(),
  ...itemMeta,
});

export const cvSkillSchema = z.object({
  id: z.uuid(),
  name: lineField(1, CV_LIMITS.shortField),
  ...itemMeta,
});

/**
 * CV content: one JSONB document (ADR 0001). Experience is ordered by
 * relevance to the Target role; `null` means the Source does not say.
 */
export const cvContentSchema = z
  .object({
    contact: cvContactSchema,
    summary: cvSummarySchema,
    experience: z.array(cvExperienceSchema).max(CV_LIMITS.experience),
    education: z.array(cvEducationSchema).max(CV_LIMITS.education),
    skills: z.array(cvSkillSchema).max(CV_LIMITS.skills),
  })
  .meta({ id: 'CvContent' });

export type CvContent = z.infer<typeof cvContentSchema>;
export type CvExperience = z.infer<typeof cvExperienceSchema>;
export type CvEducation = z.infer<typeof cvEducationSchema>;
