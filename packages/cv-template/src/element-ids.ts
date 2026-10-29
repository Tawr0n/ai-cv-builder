import type { CvSection } from '@ai-cv-builder/shared';

/** The preview's element for a whole section (contact is the header). */
export const sectionElementId = (section: CvSection) => `cv-section-${section}`;

/** The preview's element for one item: an Experience, a bullet, an education entry or a skill. */
export const itemElementId = (id: string) => `cv-item-${id}`;
