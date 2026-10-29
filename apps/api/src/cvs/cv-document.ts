import { randomUUID } from 'node:crypto';
import {
  bulletFieldsSchema,
  contactFieldsSchema,
  CV_LIMITS,
  type CvContent,
  type CvItem,
  educationFieldsSchema,
  experienceFieldsSchema,
  skillFieldsSchema,
  summaryFieldsSchema,
} from '@ai-cv-builder/shared';
import type { z } from 'zod';

/** Which kind an item is, and so which fields a hand edit may change. */
const FIELDS_SCHEMA = {
  contact: contactFieldsSchema,
  summary: summaryFieldsSchema,
  experience: experienceFieldsSchema,
  education: educationFieldsSchema,
  bullet: bulletFieldsSchema,
  skill: skillFieldsSchema,
} as const;

export type ItemKind = keyof typeof FIELDS_SCHEMA;

export interface ItemRef {
  kind: ItemKind;
  item: CvItem;
}

/** The item with this id anywhere in the document, or `undefined`. Ids are unique across it. */
export function findItem(
  content: CvContent,
  itemId: string,
): ItemRef | undefined {
  if (itemId === 'contact') return { kind: 'contact', item: content.contact };
  if (itemId === 'summary') return { kind: 'summary', item: content.summary };
  for (const experience of content.experience) {
    if (experience.id === itemId)
      return { kind: 'experience', item: experience };
    const bullet = experience.bullets.find(({ id }) => id === itemId);
    if (bullet) return { kind: 'bullet', item: bullet };
  }
  const education = content.education.find(({ id }) => id === itemId);
  if (education) return { kind: 'education', item: education };
  const skill = content.skills.find(({ id }) => id === itemId);
  if (skill) return { kind: 'skill', item: skill };
  return undefined;
}

export type PatchResult =
  { ok: true; item: CvItem } | { ok: false; issues: z.core.$ZodIssue[] };

/**
 * A hand edit of one item, in place: the changed fields, `rev` + 1, and
 * `edited` (the AI leaves an Edited item alone). Mutates `content`.
 */
export function patchItem(
  { kind, item }: ItemRef,
  fields: Record<string, unknown>,
): PatchResult {
  const parsed = FIELDS_SCHEMA[kind].safeParse(fields);
  if (!parsed.success) return { ok: false, issues: parsed.error.issues };
  if (Object.keys(parsed.data).length === 0) {
    return {
      ok: false,
      issues: [
        { code: 'custom', path: [], message: 'Send at least one field' },
      ],
    };
  }
  Object.assign(item, parsed.data, { rev: item.rev + 1, edited: true });
  return { ok: true, item };
}

/** Removes an experience, education entry, skill or bullet; `contact` and `summary` cannot go. */
export function removeItem(content: CvContent, itemId: string) {
  const without = (list: { id: string }[]) => {
    const index = list.findIndex(({ id }) => id === itemId);
    if (index !== -1) list.splice(index, 1);
  };
  without(content.experience);
  without(content.education);
  without(content.skills);
  for (const experience of content.experience) without(experience.bullets);
}

export type Direction = 'up' | 'down';

/** The section a movable item lives in, or `undefined` for kinds that have a fixed place. */
export function movableSection({ kind }: ItemRef, content: CvContent) {
  if (kind === 'experience') return content.experience;
  if (kind === 'education') return content.education;
  return undefined;
}

/** Swaps an item with its neighbour; `false` when it is already at that end. Mutates `section`. */
export function moveWithin(
  section: { id: string }[],
  itemId: string,
  direction: Direction,
): boolean {
  const from = section.findIndex(({ id }) => id === itemId);
  const to = direction === 'up' ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= section.length) return false;
  [section[from], section[to]] = [section[to]!, section[from]!];
  return true;
}

export type AddResult = { ok: true } | { ok: false; reason: 'full' };

const OK = { ok: true } as const;
const FULL = { ok: false, reason: 'full' } as const;

/** What a hand-added item starts with: no cited Facts, so the AI never rewrites it. */
const newItemMeta = () => ({ rev: 1, edited: true, sourceFactIds: [] });

export function addExperience(content: CvContent): AddResult {
  if (content.experience.length >= CV_LIMITS.experience) return FULL;
  content.experience.push({
    id: randomUUID(),
    organization: null,
    title: null,
    startDate: null,
    endDate: null,
    location: null,
    bullets: [],
    ...newItemMeta(),
  });
  return OK;
}

export function addEducation(content: CvContent): AddResult {
  if (content.education.length >= CV_LIMITS.education) return FULL;
  content.education.push({
    id: randomUUID(),
    institution: null,
    degree: null,
    field: null,
    startDate: null,
    endDate: null,
    ...newItemMeta(),
  });
  return OK;
}

export function addSkill(content: CvContent, name: string): AddResult {
  if (content.skills.length >= CV_LIMITS.skills) return FULL;
  content.skills.push({ id: randomUUID(), name, ...newItemMeta() });
  return OK;
}

/** Appends a bullet to an experience; `undefined` when there is no such experience. */
export function addBullet(
  content: CvContent,
  experienceId: string,
  text: string,
): AddResult | undefined {
  const experience = content.experience.find(({ id }) => id === experienceId);
  if (!experience) return undefined;
  if (experience.bullets.length >= CV_LIMITS.bulletsPerExperience) return FULL;
  experience.bullets.push({ id: randomUUID(), text, ...newItemMeta() });
  return OK;
}
