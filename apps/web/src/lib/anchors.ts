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

/** Every item under review, in the order the CV shows them, with a name for the review bar. */
export function reviewedItems(
  content: CvContent,
): { id: string; rev: number; name: string }[] {
  const named = (section: CvSection, id: string | null) =>
    anchorLabel({ section, itemId: id, field: null }, content);
  return [
    ...(content.contact.review
      ? [
          {
            id: 'contact',
            rev: content.contact.rev,
            name: named('contact', null),
          },
        ]
      : []),
    ...(content.summary.review
      ? [
          {
            id: 'summary',
            rev: content.summary.rev,
            name: named('summary', null),
          },
        ]
      : []),
    ...(['skills', 'experience', 'education'] as const).flatMap((section) =>
      content[section]
        .filter((item) => item.review)
        .map((item) => ({
          id: item.id,
          rev: item.rev,
          name: named(section, item.id),
        })),
    ),
  ];
}
