import type {
  Anchor,
  CvContent,
  CvField,
  CvSection,
} from '@ai-cv-builder/shared';
import { itemElementId, sectionElementId } from '@ai-cv-builder/cv-template';

/** Where a 📍 link scrolls: the anchored item if it exists, else its section. */
export function anchorElementIds(anchor: Anchor): string[] {
  const section = sectionElementId(anchor.section);
  return anchor.itemId ? [itemElementId(anchor.itemId), section] : [section];
}

const SECTION_LABELS: Record<CvSection, string> = {
  contact: 'Contact',
  summary: 'Profile',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
};

const FIELD_LABELS: Record<CvField, string> = {
  fullName: 'name',
  email: 'email',
  phone: 'phone',
  location: 'location',
  links: 'links',
  text: 'text',
  organization: 'organization',
  title: 'title',
  startDate: 'start date',
  endDate: 'end date',
  bullets: 'bullets',
  institution: 'institution',
  degree: 'degree',
  field: 'field of study',
  name: 'skill',
};

/** A short human name for the place an Anchor points at, e.g. "Experience · Acme · title". */
export function anchorLabel(anchor: Anchor, content: CvContent): string {
  const parts = [SECTION_LABELS[anchor.section]];
  const item = anchor.itemId ? itemName(anchor.itemId, content) : null;
  if (item) parts.push(item);
  if (anchor.field && anchor.field !== 'text') {
    parts.push(FIELD_LABELS[anchor.field]);
  }
  return parts.join(' · ');
}

function itemName(id: string, content: CvContent): string | null {
  for (const [index, experience] of content.experience.entries()) {
    const name =
      experience.organization ?? experience.title ?? `entry ${index + 1}`;
    if (experience.id === id) return name;
    if (experience.bullets.some((bullet) => bullet.id === id)) {
      return `${name}, bullet`;
    }
  }
  const education = content.education.find((item) => item.id === id);
  if (education) return education.institution ?? education.degree ?? null;
  return content.skills.find((skill) => skill.id === id)?.name ?? null;
}

/**
 * The id of the editor card an Anchor belongs to: `contact`, `summary`, or
 * the item (a bullet's Experience); `null` for a section as a whole.
 */
export function anchorItemId(
  anchor: Anchor,
  content: CvContent,
): string | null {
  if (anchor.section === 'contact' || anchor.section === 'summary') {
    return anchor.section;
  }
  if (!anchor.itemId) return null;
  const owner = content.experience.find(({ bullets }) =>
    bullets.some(({ id }) => id === anchor.itemId),
  );
  return owner?.id ?? anchor.itemId;
}

const dash = (value: string | null | undefined) => value?.trim() || '—';
const span = (start: string | null, end: string | null) =>
  start || end ? `${start ?? '?'} – ${end ?? '?'}` : '—';

type Contact = CvContent['contact'];
type Experience = CvContent['experience'][number];
type Education = CvContent['education'][number];

/** An item as plain lines, the same shape before and after, so a change reads as a diff. */
function itemLines(
  id: string,
  item: Pick<Contact, 'fullName' | 'email' | 'phone' | 'location' | 'links'> &
    Partial<
      Pick<
        Experience,
        'organization' | 'title' | 'bullets' | 'startDate' | 'endDate'
      >
    > &
    Partial<Pick<Education, 'institution' | 'degree' | 'field'>> & {
      text?: string;
      name?: string;
    },
  section: 'contact' | 'summary' | 'skills' | 'experience' | 'education',
): string[] {
  switch (section) {
    case 'contact':
      return [
        `Name: ${dash(item.fullName)}`,
        `Email: ${dash(item.email)}`,
        `Phone: ${dash(item.phone)}`,
        `Location: ${dash(item.location)}`,
        `Links: ${item.links.length ? item.links.join(', ') : '—'}`,
      ];
    case 'summary':
      return [dash(item.text)];
    case 'skills':
      return [dash(item.name)];
    case 'experience':
      return [
        `${dash(item.title)} · ${dash(item.organization)} · ${span(item.startDate ?? null, item.endDate ?? null)}`,
        ...(item.bullets ?? []).map((bullet) => `• ${bullet.text}`),
      ];
    case 'education':
      return [
        `${dash(item.degree)} · ${dash(item.institution)} · ${dash(item.field)} · ${span(item.startDate ?? null, item.endDate ?? null)}`,
      ];
  }
}

export interface ReviewedItem {
  id: string;
  rev: number;
  name: string;
  /** The item before the AI's change; empty when the AI added it. */
  before: string[];
  after: string[];
}

/** Every item under review, in the order the CV shows them, with a name and its before and after lines. */
export function reviewedItems(content: CvContent): ReviewedItem[] {
  const named = (section: CvSection, id: string | null) =>
    anchorLabel({ section, itemId: id, field: null }, content);
  const items: ReviewedItem[] = [];
  const add = (
    section: 'contact' | 'summary' | 'skills' | 'experience' | 'education',
    item: {
      id?: string;
      rev: number;
      review?: { prev: object | null };
    },
    id: string,
  ) => {
    if (!item.review) return;
    items.push({
      id,
      rev: item.rev,
      name: named(
        section,
        section === 'contact' || section === 'summary' ? null : id,
      ),
      before: item.review.prev
        ? itemLines(id, item.review.prev as never, section)
        : [],
      after: itemLines(id, item as never, section),
    });
  };
  add('contact', content.contact, 'contact');
  add('summary', content.summary, 'summary');
  for (const section of ['skills', 'experience', 'education'] as const) {
    for (const item of content[section]) add(section, item, item.id);
  }
  return items;
}
