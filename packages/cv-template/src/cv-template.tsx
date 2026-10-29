import type {
  CvContent,
  CvEducation,
  CvExperience,
  CvSection as Section,
} from '@ai-cv-builder/shared';
import type { ReactNode } from 'react';
import { itemElementId, sectionElementId } from './element-ids.js';

export type CvTemplateMode = 'preview' | 'pdf';

/**
 * The CV as it prints: template B (sans, label gutter), sections in the order
 * Profile → Skills → Experience → Education. One component for the on-screen
 * preview and the PDF; only the preview emits element ids, which the 📍 links
 * of Questions scroll to, so the PDF and its off-screen measuring copy carry
 * none. Unknown (`null`) fields are left out. Every value is rendered as text
 * by React, so nothing in the content can become markup.
 */
export function CvTemplate({
  content,
  mode,
}: {
  content: CvContent;
  mode: CvTemplateMode;
}) {
  const preview = mode === 'preview';
  const sectionId = (section: Section) =>
    preview ? sectionElementId(section) : undefined;
  const itemId = (id: string) => (preview ? itemElementId(id) : undefined);
  const { contact, summary, experience, education, skills } = content;
  const contactParts: ReactNode[] = [
    contact.email,
    contact.phone,
    contact.location,
    ...contact.links.map((link) => <CvLink key={link} url={link} />),
  ].filter(Boolean);

  return (
    <article className="cv">
      <header className="cv-header" id={sectionId('contact')}>
        {contact.fullName && <h1 className="cv-name">{contact.fullName}</h1>}
        {contactParts.length > 0 && (
          <p className="cv-contact">
            {contactParts.map((part, index) => (
              <span key={index}>{part}</span>
            ))}
          </p>
        )}
      </header>

      {summary.text && (
        <CvSection id={sectionId('summary')}>
          <CvRow label="Profile">
            <p className="cv-summary">{summary.text}</p>
          </CvRow>
        </CvSection>
      )}

      {skills.length > 0 && (
        <CvSection id={sectionId('skills')}>
          <CvRow label="Skills">
            <ul className="cv-skills">
              {skills.map((skill) => (
                <li key={skill.id} id={itemId(skill.id)}>
                  {skill.name}
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
              <ExperienceItem item={item} itemId={itemId} />
            </CvRow>
          ))}
        </CvSection>
      )}

      {education.length > 0 && (
        <CvSection id={sectionId('education')}>
          {education.map((item, index) => (
            <CvRow key={item.id} label={index === 0 ? 'Education' : undefined}>
              <EducationItem item={item} itemId={itemId} />
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

function ExperienceItem({
  item,
  itemId,
}: {
  item: CvExperience;
  itemId: ItemId;
}) {
  const meta = [
    item.organization,
    dateRange(item.startDate, item.endDate),
    item.location,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="cv-item" id={itemId(item.id)}>
      {item.title && <h3 className="cv-title">{item.title}</h3>}
      {meta && <p className="cv-meta">{meta}</p>}
      {item.bullets.length > 0 && (
        <ul className="cv-bullets">
          {item.bullets.map((bullet) => (
            <li key={bullet.id} id={itemId(bullet.id)}>
              {bullet.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EducationItem({
  item,
  itemId,
}: {
  item: CvEducation;
  itemId: ItemId;
}) {
  const title = [item.degree, item.field].filter(Boolean).join(', ');
  const meta = [item.institution, dateRange(item.startDate, item.endDate)]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="cv-item" id={itemId(item.id)}>
      {title && <h3 className="cv-title">{title}</h3>}
      {meta && <p className="cv-meta">{meta}</p>}
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
