import type {
  CvContent,
  CvEducation,
  CvExperience,
  CvSection as Section,
} from '@ai-cv-builder/shared';
import type { ReactNode } from 'react';
import { itemElementId, sectionElementId } from './element-ids.js';

export type CvTemplateMode = 'preview' | 'pdf';

/** Renders `after` marked up against `before`: the preview's word diff of an AI change under review. */
export type CvDiff = (before: string, after: string) => ReactNode;

/** An item's review: its previous version, or `null` when the AI added it. */
type Review<Item> = { prev: Item | null } | undefined;

/**
 * A field of an item, as text: diffed against the same field of `prev` when
 * the item is under review and a `diff` is given, plain otherwise.
 */
function field<Item>(
  diff: CvDiff | undefined,
  item: Item & { review?: Review<Omit<Item, 'review'>> },
  read: (item: Omit<Item, 'review'>) => string,
): ReactNode {
  const now = read(item);
  if (!diff || !item.review) return now;
  return diff(item.review.prev ? read(item.review.prev) : '', now);
}

/** The preview's mark on an item under review, which the review bar selects by. */
function reviewProps(
  diff: CvDiff | undefined,
  id: string,
  review: unknown,
): { 'data-review-id'?: string } {
  return diff && review ? { 'data-review-id': id } : {};
}

/**
 * The CV as it prints: template B (sans, label gutter), sections in the order
 * Profile → Skills → Experience → Education. One component for the on-screen
 * preview and the PDF; only the preview emits element ids, which the 📍 links
 * of Questions scroll to, so the PDF and its off-screen measuring copy carry
 * none. Unknown (`null`) fields are left out. Every value is rendered as text
 * by React, so nothing in the content can become markup. With `diff` (the
 * preview only), an item under review shows its AI change against `prev`.
 */
export function CvTemplate({
  content,
  mode,
  diff: diffIn,
}: {
  content: CvContent;
  mode: CvTemplateMode;
  diff?: CvDiff;
}) {
  const preview = mode === 'preview';
  const diff = preview ? diffIn : undefined;
  const sectionId = (section: Section) =>
    preview ? sectionElementId(section) : undefined;
  const itemId = (id: string) => (preview ? itemElementId(id) : undefined);
  const { contact, summary, skills } = content;
  // A card the User just added is empty until they fill it in: it prints nothing.
  const experience = content.experience.filter(
    (item) =>
      item.title ||
      item.organization ||
      item.location ||
      item.startDate ||
      item.endDate ||
      item.bullets.length > 0,
  );
  const education = content.education.filter(
    (item) =>
      item.degree ||
      item.field ||
      item.institution ||
      item.startDate ||
      item.endDate,
  );
  const contactParts: ReactNode[] = [
    contact.email,
    contact.phone,
    contact.location,
    ...contact.links.map((link) => <CvLink key={link} url={link} />),
  ].filter(Boolean);
  const contactLine = (item: Omit<CvContent['contact'], 'review'>) =>
    [item.email, item.phone, item.location, ...item.links]
      .filter(Boolean)
      .join(' · ');
  const contactReviewed = Boolean(diff && contact.review);

  return (
    <article className="cv">
      <header
        className="cv-header"
        id={sectionId('contact')}
        {...reviewProps(diff, 'contact', contact.review)}
      >
        {(contact.fullName || contactReviewed) && (
          <h1 className="cv-name">
            {field(diff, contact, (item) => item.fullName)}
          </h1>
        )}
        {contactReviewed ? (
          <p className="cv-contact">{field(diff, contact, contactLine)}</p>
        ) : (
          contactParts.length > 0 && (
            <p className="cv-contact">
              {contactParts.map((part, index) => (
                <span key={index}>{part}</span>
              ))}
            </p>
          )
        )}
      </header>

      {(summary.text || (diff && summary.review)) && (
        <CvSection id={sectionId('summary')}>
          <CvRow label="Profile">
            <p
              className="cv-summary"
              {...reviewProps(diff, 'summary', summary.review)}
            >
              {field(diff, summary, (item) => item.text)}
            </p>
          </CvRow>
        </CvSection>
      )}

      {skills.length > 0 && (
        <CvSection id={sectionId('skills')}>
          <CvRow label="Skills">
            <ul className="cv-skills">
              {skills.map((skill) => (
                <li
                  key={skill.id}
                  id={itemId(skill.id)}
                  {...reviewProps(diff, skill.id, skill.review)}
                >
                  {field(diff, skill, (item) => item.name)}
                </li>
              ))}
            </ul>
          </CvRow>
        </CvSection>
      )}

      {experience.length > 0 && (
        <CvSection id={sectionId('experience')}>
          {experience.map((item, index) => (
            <CvRow key={item.id} label={index === 0 ? 'Experience' : undefined}>
              <ExperienceItem item={item} itemId={itemId} diff={diff} />
            </CvRow>
          ))}
        </CvSection>
      )}

      {education.length > 0 && (
        <CvSection id={sectionId('education')}>
          {education.map((item, index) => (
            <CvRow key={item.id} label={index === 0 ? 'Education' : undefined}>
              <EducationItem item={item} itemId={itemId} diff={diff} />
            </CvRow>
          ))}
        </CvSection>
      )}
    </article>
  );
}

type ItemId = (id: string) => string | undefined;

function CvSection({
  id,
  children,
}: {
  id: string | undefined;
  children: ReactNode;
}) {
  return (
    <section className="cv-section" id={id}>
      {children}
    </section>
  );
}

/**
 * One row per item; the first row of a section carries its label in the
 * gutter. A row never splits across pages, so a heading always stays with its
 * first item.
 */
function CvRow({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="cv-row">
      {label && <h2 className="cv-label">{label}</h2>}
      <div className="cv-body">{children}</div>
    </div>
  );
}

type Fields<Item> = Omit<Item, 'review'>;

const experienceMeta = (item: Fields<CvExperience>) =>
  [item.organization, dateRange(item.startDate, item.endDate), item.location]
    .filter(Boolean)
    .join(' · ');

function ExperienceItem({
  item,
  itemId,
  diff,
}: {
  item: CvExperience;
  itemId: ItemId;
  diff: CvDiff | undefined;
}) {
  const reviewing = Boolean(diff && item.review);
  const prevBullets = item.review?.prev?.bullets ?? [];
  // Under review, bullets the change dropped stay visible, struck through.
  const bullets = reviewing
    ? [
        ...item.bullets.map((bullet) => ({
          id: bullet.id,
          text: diff!(
            prevBullets.find(({ id }) => id === bullet.id)?.text ?? '',
            bullet.text,
          ),
        })),
        ...prevBullets
          .filter(({ id }) => !item.bullets.some((b) => b.id === id))
          .map((bullet) => ({
            id: bullet.id,
            text: diff!(bullet.text, ''),
          })),
      ]
    : item.bullets.map(({ id, text }) => ({ id, text: text as ReactNode }));
  const meta = experienceMeta(item);
  return (
    <div
      className="cv-item"
      id={itemId(item.id)}
      {...reviewProps(diff, item.id, item.review)}
    >
      {(item.title || reviewing) && (
        <h3 className="cv-title">{field(diff, item, (i) => i.title ?? '')}</h3>
      )}
      {(meta || reviewing) && (
        <p className="cv-meta">{field(diff, item, experienceMeta)}</p>
      )}
      {bullets.length > 0 && (
        <ul className="cv-bullets">
          {bullets.map((bullet) => (
            <li key={bullet.id} id={itemId(bullet.id)}>
              {bullet.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const educationTitle = (item: Fields<CvEducation>) =>
  [item.degree, item.field].filter(Boolean).join(', ');
const educationMeta = (item: Fields<CvEducation>) =>
  [item.institution, dateRange(item.startDate, item.endDate)]
    .filter(Boolean)
    .join(' · ');

function EducationItem({
  item,
  itemId,
  diff,
}: {
  item: CvEducation;
  itemId: ItemId;
  diff: CvDiff | undefined;
}) {
  const reviewing = Boolean(diff && item.review);
  return (
    <div
      className="cv-item"
      id={itemId(item.id)}
      {...reviewProps(diff, item.id, item.review)}
    >
      {(educationTitle(item) || reviewing) && (
        <h3 className="cv-title">{field(diff, item, educationTitle)}</h3>
      )}
      {(educationMeta(item) || reviewing) && (
        <p className="cv-meta">{field(diff, item, educationMeta)}</p>
      )}
    </div>
  );
}

/** Only `http(s)` links become clickable; anything else (`javascript:` included) stays plain text. */
function CvLink({ url }: { url: string }) {
  const shown = url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
  const href = safeHref(url);
  return href ? (
    <a href={href} rel="noopener noreferrer" target="_blank">
      {shown}
    </a>
  ) : (
    shown
  );
}

function safeHref(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
      ? parsed.href
      : null;
  } catch {
    return null;
  }
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** `2019-03` → `Mar 2019`, `2019` stays, `present` → `Present`. */
function formatDate(date: string): string {
  if (date === 'present') return 'Present';
  const [year, month] = date.split('-');
  return month ? `${MONTHS[Number(month) - 1]} ${year}` : date;
}

function dateRange(start: string | null, end: string | null): string {
  if (!start && !end) return '';
  if (!end) return formatDate(start!);
  if (!start) return `until ${formatDate(end)}`;
  return `${formatDate(start)} – ${formatDate(end)}`;
}
