import type {
  CvContent,
  CvEducation,
  CvExperience,
} from '@ai-cv-builder/shared';
import type { ReactNode } from 'react';

/**
 * The CV as it prints: template B (sans, label gutter), sections in the order
 * Profile → Skills → Experience → Education. One component for the on-screen
 * preview and the PDF; `mode` will decide which editor hooks are emitted at
 * all. Unknown (`null`) fields are left out. Every value is rendered as text
 * by React, so nothing in the content can become markup.
 */
export function CvTemplate({
  content,
}: {
  content: CvContent;
  mode: 'preview' | 'pdf';
}) {
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

  return (
    <article className="cv">
      <header className="cv-header">
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
        <CvSection label="Profile">
          <p className="cv-summary">{summary.text}</p>
        </CvSection>
      )}

      {skills.length > 0 && (
        <CvSection label="Skills">
          <ul className="cv-skills">
            {skills.map((skill) => (
              <li key={skill.id}>{skill.name}</li>
            ))}
          </ul>
        </CvSection>
      )}

      {experience.length > 0 && (
        <CvSection label="Experience">
          {experience.map((item) => (
            <ExperienceItem key={item.id} item={item} />
          ))}
        </CvSection>
      )}

      {education.length > 0 && (
        <CvSection label="Education">
          {education.map((item) => (
            <EducationItem key={item.id} item={item} />
          ))}
        </CvSection>
      )}
    </article>
  );
}

function CvSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="cv-section">
      <h2 className="cv-label">{label}</h2>
      <div className="cv-body">{children}</div>
    </section>
  );
}

function ExperienceItem({ item }: { item: CvExperience }) {
  const meta = [
    item.organization,
    dateRange(item.startDate, item.endDate),
    item.location,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="cv-item">
      {item.title && <h3 className="cv-title">{item.title}</h3>}
      {meta && <p className="cv-meta">{meta}</p>}
      {item.bullets.length > 0 && (
        <ul className="cv-bullets">
          {item.bullets.map((bullet) => (
            <li key={bullet.id}>{bullet.text}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EducationItem({ item }: { item: CvEducation }) {
  const title = [item.degree, item.field].filter(Boolean).join(', ');
  const meta = [item.institution, dateRange(item.startDate, item.endDate)]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="cv-item">
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
