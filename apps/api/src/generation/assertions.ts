import type { CvContent, CvField, CvSection } from '@ai-cv-builder/shared';
import type { Assertion } from '../ai/cv-ai.js';

/** What an Assertion's field holds before it is cut down to a string. */
type FieldValue = string | null | string[];

const has = (value: FieldValue): value is string | string[] =>
  Array.isArray(value) ? value.length > 0 : value !== null && value !== '';

/**
 * Every statement the CV content makes, one Assertion per non-empty field, so the
 * judge can check each against the Facts its item cites. Contact and summary
 * use their reserved ids; links are one Assertion, joined.
 */
export function listAssertions(content: CvContent): Assertion[] {
  const assertions: Assertion[] = [];
  const add = (
    itemId: string,
    section: CvSection,
    sourceFactIds: string[],
    fields: Partial<Record<CvField, FieldValue>>,
  ) => {
    for (const [field, value] of Object.entries(fields) as [
      CvField,
      FieldValue,
    ][]) {
      if (!has(value)) continue;
      assertions.push({
        itemId,
        section,
        field,
        value: Array.isArray(value) ? value.join(', ') : value,
        sourceFactIds,
      });
    }
  };

  const { contact, summary } = content;
  add('contact', 'contact', contact.sourceFactIds, {
    fullName: contact.fullName,
    email: contact.email,
    phone: contact.phone,
    location: contact.location,
    links: contact.links,
  });
  add('summary', 'summary', summary.sourceFactIds, { text: summary.text });
  for (const item of content.experience) {
    add(item.id, 'experience', item.sourceFactIds, {
      organization: item.organization,
      title: item.title,
      startDate: item.startDate,
      endDate: item.endDate,
      location: item.location,
    });
    for (const bullet of item.bullets) {
      add(bullet.id, 'experience', bullet.sourceFactIds, { text: bullet.text });
    }
  }
  for (const item of content.education) {
    add(item.id, 'education', item.sourceFactIds, {
      institution: item.institution,
      degree: item.degree,
      field: item.field,
      startDate: item.startDate,
      endDate: item.endDate,
    });
  }
  for (const skill of content.skills) {
    add(skill.id, 'skills', skill.sourceFactIds, { name: skill.name });
  }
  return assertions;
}
