import { z } from 'zod';
import {
  cvBulletSchema,
  cvContactSchema,
  cvEducationSchema,
  cvExperienceSchema,
  cvSkillSchema,
  cvSummarySchema,
} from './cv-content.js';

/** Items with a reserved id instead of a UUID: there is exactly one of each per CV. */
export const RESERVED_ITEM_IDS = ['contact', 'summary'] as const;

/** Sections whose items the User can add, remove and (except skills) move. */
export const ITEM_SECTIONS = ['experience', 'education', 'skills'] as const;

export const itemIdSchema = z.union([z.uuid(), z.enum(RESERVED_ITEM_IDS)]);
export const itemSectionSchema = z.enum(ITEM_SECTIONS);

/** Any one item of the CV, as `PATCH` returns it (an experience carries its bullets). */
export const cvItemSchema = z
  .union([
    cvContactSchema,
    cvSummarySchema,
    cvExperienceSchema,
    cvEducationSchema,
    cvBulletSchema,
    cvSkillSchema,
  ])
  .meta({ id: 'CvItem' });

/** The fields of an item the User may change; everything else (`id`, `rev`, `edited`, ...) is the server's. */
const editable = <Shape extends z.ZodRawShape>(
  schema: z.ZodObject<Shape>,
  fields: { [Field in keyof Shape]?: true },
) => z.strictObject(schema.pick(fields as never).partial().shape);

export const contactFieldsSchema = editable(cvContactSchema, {
  fullName: true,
  email: true,
  phone: true,
  location: true,
  links: true,
});
export const summaryFieldsSchema = editable(cvSummarySchema, { text: true });
export const experienceFieldsSchema = editable(cvExperienceSchema, {
  organization: true,
  title: true,
  startDate: true,
  endDate: true,
  location: true,
});
export const educationFieldsSchema = editable(cvEducationSchema, {
  institution: true,
  degree: true,
  field: true,
  startDate: true,
  endDate: true,
});
export const bulletFieldsSchema = editable(cvBulletSchema, { text: true });
export const skillFieldsSchema = editable(cvSkillSchema, { name: true });

/**
 * `PATCH /items/:itemId`: the base `rev` plus the fields to change. Which
 * fields are allowed depends on the kind of item, so the server checks the
 * rest of the body against the matching `*FieldsSchema` once it has found the item.
 */
export const patchItemSchema = z
  .looseObject({ rev: z.int().positive() })
  .meta({ id: 'PatchItem' });

/** `POST /sections/skills/items`. Experience and education are added empty. */
export const addSkillSchema = skillFieldsSchema
  .required()
  .meta({ id: 'AddSkill' });
export const addEmptyItemSchema = z
  .strictObject({})
  .meta({ id: 'AddEmptyItem' });
/** `POST /items/:experienceId/bullets` */
export const addBulletSchema = bulletFieldsSchema
  .required()
  .meta({ id: 'AddBullet' });

/** `DELETE /items/:itemId?rev=`: the removed item's own `rev`. */
export const removeItemQuerySchema = z.strictObject({
  rev: z.coerce.number().int().positive(),
});

export const moveItemSchema = z
  .strictObject({
    direction: z.enum(['up', 'down']),
    version: z.int().positive(),
  })
  .meta({ id: 'MoveItem' });

export type CvItem = z.infer<typeof cvItemSchema>;
export type AddBullet = z.infer<typeof addBulletSchema>;
export type ItemSection = z.infer<typeof itemSectionSchema>;
export type PatchItem = z.infer<typeof patchItemSchema>;
export type MoveItem = z.infer<typeof moveItemSchema>;
