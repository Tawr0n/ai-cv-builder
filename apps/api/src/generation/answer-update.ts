import {
  type Anchor,
  CV_LIMITS,
  type CvBullet,
  type CvContent,
  cvContentSchema,
  type CvSection,
  type ItemSection,
} from '@ai-cv-builder/shared';
import { randomUUID } from 'node:crypto';
import {
  type Fact,
  InvalidAiOutputError,
  type UpdateOutput,
  type UpdateScope,
} from '../ai/cv-ai.js';
import {
  ANCHOR_FIELDS,
  type DraftQuestion,
  questionText,
} from './questions.js';

/**
 * What one Update CV may rewrite, as keys: the contact, the summary, one item
 * (an Experience with its bullets, an education entry, a skill) or a whole
 * section (an Anchor with no item).
 */
export type ScopeKey = 'contact' | 'summary' | `item:${string}` | ItemSection;

/** Where an Anchor's Answer lands in the content. */
export type Landing =
  | { kind: 'gone' }
  | { kind: 'edited' }
  | { kind: 'scope'; key: ScopeKey; section: CvSection };

const ITEM_SECTIONS: ItemSection[] = ['experience', 'education', 'skills'];

const SECTION_LIMITS: Record<ItemSection, number> = {
  experience: CV_LIMITS.experience,
  education: CV_LIMITS.education,
  skills: CV_LIMITS.skills,
};

/**
 * The scope an Anchor's Answer updates: its item (a bullet's Experience), its
 * section when it names no item, or nothing when the item is gone or Edited.
 */
export function landingOf(anchor: Anchor, content: CvContent): Landing {
  const { section, itemId } = anchor;
  if (section === 'contact' || section === 'summary') {
    return content[section].edited
      ? { kind: 'edited' }
      : { kind: 'scope', key: section, section };
  }
  if (itemId === null) return { kind: 'scope', key: section, section };
  const entry = topItems(content).get(itemId) ?? bulletOwner(content, itemId);
  if (!entry || entry.section !== section) return { kind: 'gone' };
  return entry.item.edited
    ? { kind: 'edited' }
    : { kind: 'scope', key: `item:${entry.item.id}`, section };
}

/** Whether a Question anchored at `landing` belongs to what an update wrote. */
export function inWritten(landing: Landing, written: Set<ScopeKey>): boolean {
  if (landing.kind !== 'scope') return false;
  return (
    written.has(landing.key) ||
    ((ITEM_SECTIONS as string[]).includes(landing.section) &&
      written.has(landing.section as ItemSection))
  );
}

export function toUpdateScope(keys: Set<ScopeKey>): UpdateScope {
  return {
    contact: keys.has('contact'),
    summary: keys.has('summary'),
    itemIds: [...keys]
      .filter((key) => key.startsWith('item:'))
      .map((key) => key.slice('item:'.length)),
    sections: ITEM_SECTIONS.filter((section) => keys.has(section)),
  };
}

/** An Answer as the Fact it becomes: self-contained, because "March 2019" means nothing alone. */
export function answerFact(
  id: string,
  question: { id: string; text: string; answer: string },
): Fact {
  return {
    id,
    text: `Q: ${question.text} A: ${question.answer}`,
    quote: question.answer,
    source: 'answer',
    questionId: question.id,
  };
}

/** `f1`, `f2`, … continued after the highest id in `facts`. */
export function nextFactIds(facts: Fact[], count: number): string[] {
  const highest = Math.max(
    0,
    ...facts.map((fact) => Number(/^f(\d+)$/.exec(fact.id)?.[1] ?? 0)),
  );
  return Array.from({ length: count }, (_, i) => `f${highest + i + 1}`);
}

type TopItem =
  | CvContent['contact']
  | CvContent['summary']
  | CvContent['experience'][number]
  | CvContent['education'][number]
  | CvContent['skills'][number];

interface Entry {
  section: CvSection;
  item: TopItem & { id?: string };
}

/** Every reviewable item by id (`contact` and `summary` by those names). */
export function topItems(content: CvContent): Map<string, Entry> {
  const items = new Map<string, Entry>([
    ['contact', { section: 'contact', item: content.contact }],
    ['summary', { section: 'summary', item: content.summary }],
  ]);
  for (const section of ITEM_SECTIONS) {
    for (const item of content[section]) {
      items.set(item.id, { section, item });
    }
  }
  return items;
}

function bulletOwner(content: CvContent, bulletId: string): Entry | undefined {
  const owner = content.experience.find((experience) =>
    experience.bullets.some(({ id }) => id === bulletId),
  );
  return owner && { section: 'experience', item: owner };
}

/** What the reader sees of an item: its fields and bullets, without ids of state (`rev`, citations, review). */
function visible(item: TopItem): string {
  const {
    rev: _rev,
    edited: _edited,
    sourceFactIds: _cited,
    review: _review,
    ...fields
  } = item;
  if ('bullets' in fields) {
    return JSON.stringify({
      ...fields,
      bullets: fields.bullets.map(({ id, text }) => ({ id, text })),
    });
  }
  return JSON.stringify(fields);
}

/** Ids of the items of `next` that are new or read differently than in `base`. */
export function changedItemIds(base: CvContent, next: CvContent): string[] {
  const before = topItems(base);
  return [...topItems(next)]
    .filter(([id, { item }]) => {
      const old = before.get(id);
      return !old || visible(old.item) !== visible(item);
    })
    .map(([id]) => id);
}

/** The ids of the Assertions an update's judge checks: the changed items, an Experience's bullets included. */
export function assertionIdsOf(content: CvContent, itemIds: string[]) {
  const ids = new Set(itemIds);
  for (const experience of content.experience) {
    if (ids.has(experience.id)) {
      for (const bullet of experience.bullets) ids.add(bullet.id);
    }
  }
  return ids;
}

const NEW_ITEM = { rev: 1, edited: false } as const;

/**
 * The structural check on update output, and the only way it reaches the CV
 * content: every item it returns must be in `scope` (or new, in a section in
 * scope), cite Facts that exist, and the result must pass the CV content
 * schema. An item in scope it leaves out stays as it was, and so does every
 * Edited bullet. Throws {@link InvalidAiOutputError} otherwise.
 */
export function checkUpdateOutput(
  output: UpdateOutput,
  base: CvContent,
  scope: UpdateScope,
  facts: Fact[],
  newId: () => string = randomUUID,
): { content: CvContent; questions: DraftQuestion[] } {
  const fail = (why: string): never => {
    throw new InvalidAiOutputError('update', why);
  };
  const factIds = new Set(facts.map(({ id }) => id));
  const cite = (path: string, cited: string[], required = true) => {
    if (required && cited.length === 0) fail(`${path} is uncited`);
    const unknown = cited.filter((id) => !factIds.has(id));
    if (unknown.length > 0) {
      fail(`${path} cites unknown Facts ${unknown.join(', ')}`);
    }
  };
  const next = structuredClone(base);

  if (output.contact) {
    if (!scope.contact) fail('contact is not in scope');
    const { contact } = output;
    cite(
      'contact',
      contact.sourceFactIds,
      [contact.fullName, contact.email, contact.phone, contact.location].some(
        Boolean,
      ) || contact.links.length > 0,
    );
    next.contact = { ...base.contact, ...contact };
  }
  if (output.summary) {
    if (!scope.summary) fail('summary is not in scope');
    cite('summary', output.summary.sourceFactIds, output.summary.text !== '');
    next.summary = { ...base.summary, ...output.summary };
  }

  /** Writes each returned item over its base one, or appends it when it is new. */
  function section<Section extends ItemSection>(
    name: Section,
    returned: { id: string | null }[],
    build: (
      entry: (typeof returned)[number],
      old: CvContent[Section][number] | undefined,
      path: string,
    ) => CvContent[Section][number],
  ) {
    const list = next[name] as CvContent[Section][number][];
    const seen = new Set<string>();
    returned.forEach((entry, i) => {
      const path = `${name}.${i}`;
      if (entry.id === null) {
        if (!scope.sections.includes(name)) {
          fail(`${path} is new, but ${name} is not in scope`);
        }
        list.push(build(entry, undefined, path));
        return;
      }
      const index = list.findIndex(({ id }) => id === entry.id);
      const old = list[index];
      const inScope =
        scope.itemIds.includes(entry.id) ||
        (scope.sections.includes(name) && old !== undefined && !old.edited);
      if (!old || !inScope) fail(`${path} names an item not in scope`);
      if (seen.has(entry.id)) fail(`${path} returns an item twice`);
      seen.add(entry.id);
      list[index] = build(entry, old, path);
    });
  }

  section('experience', output.experience, (entry, old, path) => {
    const {
      id: _id,
      bullets,
      ...fields
    } = entry as UpdateOutput['experience'][number];
    cite(path, fields.sourceFactIds);
    const oldBullets = old?.bullets ?? [];
    const kept: CvBullet[] = bullets.map((bullet, j) => {
      if (bullet.id === null) {
        cite(`${path}.bullets.${j}`, bullet.sourceFactIds);
        return {
          id: newId(),
          text: bullet.text,
          sourceFactIds: bullet.sourceFactIds,
          ...NEW_ITEM,
        };
      }
      const was =
        oldBullets.find(({ id }) => id === bullet.id) ??
        fail(`${path}.bullets.${j} names a bullet of another item`);
      if (was.edited) return was;
      cite(`${path}.bullets.${j}`, bullet.sourceFactIds);
      return { ...was, text: bullet.text, sourceFactIds: bullet.sourceFactIds };
    });
    // The User's own bullets stay, even when the model left them out.
    const missing = oldBullets.filter(
      (bullet) => bullet.edited && !kept.some(({ id }) => id === bullet.id),
    );
    return {
      ...(old ?? { id: newId(), ...NEW_ITEM }),
      ...fields,
      bullets: [...kept, ...missing],
    };
  });
  section('education', output.education, (entry, old, path) => {
    const { id: _id, ...fields } = entry as UpdateOutput['education'][number];
    cite(path, fields.sourceFactIds);
    return { ...(old ?? { id: newId(), ...NEW_ITEM }), ...fields };
  });
  section('skills', output.skills, (entry, old, path) => {
    const { id: _id, ...fields } = entry as UpdateOutput['skills'][number];
    cite(path, fields.sourceFactIds);
    return { ...(old ?? { id: newId(), ...NEW_ITEM }), ...fields };
  });

  const parsed = cvContentSchema.safeParse(next);
  if (!parsed.success) {
    const where = parsed.error.issues.map((issue) => issue.path.join('.'));
    fail(`invalid fields: ${where.join(', ')}`);
  }
  const content = parsed.data!;
  return {
    content,
    questions: anchorUpdateQuestions(output.questions, content),
  };
}

/** Update's Questions as Anchors: an `itemId` must name an item (or bullet) of `content`. */
function anchorUpdateQuestions(
  questions: UpdateOutput['questions'],
  content: CvContent,
): DraftQuestion[] {
  const items = topItems(content);
  return questions.map(({ section, itemId, field, text }, i) => {
    const path = `questions.${i}`;
    const fail = (why: string): never => {
      throw new InvalidAiOutputError('update', `${path} ${why}`);
    };
    const line = questionText('update', text, path);
    const single = section === 'contact' || section === 'summary';
    if (itemId === null || single) {
      if (field !== null && !ANCHOR_FIELDS[section].includes(field)) {
        fail(`names a field ${section} do not have`);
      }
      return {
        anchor: { section, itemId: null, field: single ? field : null },
        text: line,
      };
    }
    const entry = items.get(itemId);
    const bulletOf = entry ? undefined : bulletOwner(content, itemId);
    if ((entry ?? bulletOf)?.section !== section) {
      fail(`names ${section} item ${itemId}, which does not exist`);
    }
    const fields = bulletOf ? ['text'] : ANCHOR_FIELDS[section];
    if (field !== null && !fields.includes(field)) {
      fail('names a field the item does not have');
    }
    return { anchor: { section, itemId, field }, text: line };
  });
}

/** The item without its review state: what a review's `prev` holds. */
function snapshot<Item extends TopItem>(item: Item): Omit<Item, 'review'> {
  const { review: _review, ...rest } = item;
  return rest;
}

/**
 * Writes an update's changed items into the content as it is now (`fresh`,
 * mutated): an item the User changed or removed since the update read `base`
 * is skipped, the User's own bullets always stay, and each written item keeps
 * a snapshot of what it was before the AI's first unreviewed change. Returns
 * the scopes it wrote, so their Questions can be replaced.
 */
export function writeUpdate(
  fresh: CvContent,
  base: CvContent,
  updated: CvContent,
  changedIds: string[],
  scope: Set<ScopeKey>,
  questionIdsFor: (section: CvSection, itemId: string) => string[],
): Set<ScopeKey> {
  const written = new Set<ScopeKey>();
  const baseItems = topItems(base);
  const freshItems = topItems(fresh);
  const updatedItems = topItems(updated);

  for (const id of changedIds) {
    const { section, item } = updatedItems.get(id)!;
    const was = baseItems.get(id);
    const questionIds = questionIdsFor(section, id);

    if (!was) {
      // New in a section in scope: appended, if the User left room.
      const name = section as ItemSection;
      const list = fresh[name] as TopItem[];
      if (list.length >= SECTION_LIMITS[name]) continue;
      list.push({ ...item, review: { prev: null, questionIds } } as TopItem);
      written.add(name);
      continue;
    }

    const now = freshItems.get(id);
    if (!now || now.item.rev !== was.item.rev || now.item.edited) continue;
    const next = {
      ...item,
      rev: now.item.rev + 1,
      edited: false,
      review: {
        prev: now.item.review ? now.item.review.prev : snapshot(now.item),
        questionIds: [
          ...new Set([...(now.item.review?.questionIds ?? []), ...questionIds]),
        ],
      },
    } as TopItem;
    if ('bullets' in next && 'bullets' in now.item) {
      next.bullets = mergeBullets(
        next.bullets,
        (was.item as typeof now.item).bullets,
        now.item.bullets,
      );
    }
    replaceTop(fresh, section, next);
    if (section === 'contact' || section === 'summary') written.add(section);
    else {
      written.add(`item:${id}`);
      if (scope.has(section)) written.add(section);
    }
  }
  return written;
}

/**
 * The update's bullets over the Experience as it is now: a bullet the User
 * edited or added meanwhile wins, one the User removed stays removed.
 */
function mergeBullets(
  updated: CvBullet[],
  base: CvBullet[],
  now: CvBullet[],
): CvBullet[] {
  const nowById = new Map(now.map((bullet) => [bullet.id, bullet]));
  const baseIds = new Set(base.map(({ id }) => id));
  const merged = updated.flatMap((bullet) => {
    const current = nowById.get(bullet.id);
    if (baseIds.has(bullet.id) && !current) return [];
    return [current?.edited ? current : bullet];
  });
  const added = now.filter(
    (bullet) => bullet.edited && !merged.some(({ id }) => id === bullet.id),
  );
  return [...merged, ...added];
}

function replaceTop(content: CvContent, section: CvSection, item: TopItem) {
  if (section === 'contact') content.contact = item as CvContent['contact'];
  else if (section === 'summary') {
    content.summary = item as CvContent['summary'];
  } else {
    const list = content[section] as TopItem[];
    const index = list.findIndex(
      (entry) => (entry as { id: string }).id === (item as { id: string }).id,
    );
    list[index] = item;
  }
}
