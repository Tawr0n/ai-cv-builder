import {
  type Anchor,
  type CvContent,
  cvContentSchema,
} from '@ai-cv-builder/shared';
import {
  type Assertion,
  type CvAiOutput,
  type CvAiStep,
  type Fact,
  InvalidAiOutputError,
} from '../ai/cv-ai.js';
import { type DraftQuestion, questionText } from './questions.js';

export interface Finding {
  assertion: Assertion;
  problem: string;
  softened: string | null;
  question: string;
}

/** Whether two refer to the same field of the same item. */
export const sameAssertion = (
  a: Pick<Assertion, 'itemId' | 'field'>,
  b: Assertion,
) => a.itemId === b.itemId && a.field === b.field;

/**
 * The structural check on judge output: every finding names an Assertion the judge
 * was shown and carries a usable Question. Throws {@link InvalidAiOutputError}.
 */
export function checkJudgeOutput(
  output: CvAiOutput<'judge'>,
  assertions: Assertion[],
): Finding[] {
  return output.findings.map((finding, i) => {
    const assertion = assertions.find((c) => sameAssertion(finding, c));
    if (!assertion) {
      throw new InvalidAiOutputError(
        'judge',
        `findings.${i} names no Assertion it was shown`,
      );
    }
    return {
      assertion,
      problem: finding.problem,
      softened: finding.softened,
      question: questionText('judge', finding.question, `findings.${i}`),
    };
  });
}

/**
 * Applies repair output to the flagged Assertions only: a fix for anything else, or
 * one citing an unknown Fact, is a structural failure, and so is a result that
 * fails the CV content schema. A flagged Assertion without a fix stays as it was.
 */
export function applyRepair(
  content: CvContent,
  findings: Finding[],
  output: CvAiOutput<'repair'>,
  facts: Fact[],
): CvContent {
  const factIds = new Set(facts.map((f) => f.id));
  let repaired = content;
  output.fixes.forEach((fix, i) => {
    const finding = findings.find((f) => sameAssertion(fix, f.assertion));
    if (!finding) {
      throw new InvalidAiOutputError(
        'repair',
        `fixes.${i} rewrites an Assertion that was not flagged`,
      );
    }
    const unknown = fix.sourceFactIds.filter((id) => !factIds.has(id));
    if (unknown.length > 0) {
      throw new InvalidAiOutputError(
        'repair',
        `fixes.${i} cites unknown Facts ${unknown.join(', ')}`,
      );
    }
    repaired = setAssertion(
      repaired,
      finding.assertion,
      fix.value,
      fix.sourceFactIds,
    ).content;
  });
  return parsed('repair', repaired);
}

/**
 * The last resort for Assertions still unsupported after repair: each is cut back
 * to the judge's softened version (or dropped) and becomes a Question.
 */
export function soften(
  content: CvContent,
  findings: Finding[],
): { content: CvContent; questions: DraftQuestion[] } {
  let softened = content;
  const questions = findings.map(({ assertion, softened: value, question }) => {
    const result = setAssertion(softened, assertion, value, []);
    softened = result.content;
    return { anchor: result.anchor, text: question };
  });
  return { content: parsed('judge', softened), questions };
}

/**
 * Writes `value` into the Assertion's field (`null` removes it: an unknown field
 * becomes `null`, a required text becomes empty, a bullet or skill goes) and
 * adds `sourceFactIds` to its item's citations. Returns where the Assertion lives
 * afterwards: the parent Experience for a dropped bullet.
 */
function setAssertion(
  content: CvContent,
  assertion: Assertion,
  value: string | null,
  sourceFactIds: string[],
): { content: CvContent; anchor: Anchor } {
  const next = structuredClone(content);
  const cite = (item: { sourceFactIds: string[] }) => {
    item.sourceFactIds = [
      ...new Set([...item.sourceFactIds, ...sourceFactIds]),
    ];
  };
  const write = (item: object) =>
    Object.assign(item, { [assertion.field]: value });
  const anchor: Anchor = {
    section: assertion.section,
    itemId:
      assertion.itemId === 'contact' || assertion.itemId === 'summary'
        ? null
        : assertion.itemId,
    field: assertion.field,
  };

  if (assertion.itemId === 'contact') {
    const { contact } = next;
    if (assertion.field === 'links') {
      contact.links = value === null ? [] : value.split(/,\s*/).filter(Boolean);
    } else if (assertion.field === 'fullName' || assertion.field === 'email') {
      contact[assertion.field] = value ?? '';
    } else {
      write(contact);
    }
    cite(contact);
    return { content: next, anchor };
  }
  if (assertion.itemId === 'summary') {
    next.summary.text = value ?? '';
    cite(next.summary);
    return { content: next, anchor };
  }

  for (const experience of next.experience) {
    if (experience.id === assertion.itemId) {
      write(experience);
      cite(experience);
      return { content: next, anchor };
    }
    const index = experience.bullets.findIndex(
      (b) => b.id === assertion.itemId,
    );
    if (index === -1) continue;
    if (value === null) {
      experience.bullets.splice(index, 1);
      return {
        content: next,
        anchor: {
          section: 'experience',
          itemId: experience.id,
          field: 'bullets',
        },
      };
    }
    const bullet = experience.bullets[index]!;
    bullet.text = value;
    cite(bullet);
    return { content: next, anchor };
  }
  const education = next.education.find((e) => e.id === assertion.itemId);
  if (education) {
    write(education);
    cite(education);
    return { content: next, anchor };
  }
  const index = next.skills.findIndex((s) => s.id === assertion.itemId);
  if (index !== -1) {
    if (value === null) {
      next.skills.splice(index, 1);
      return {
        content: next,
        anchor: { section: 'skills', itemId: null, field: null },
      };
    }
    next.skills[index]!.name = value;
    cite(next.skills[index]!);
    return { content: next, anchor };
  }
  // listAssertions only lists items that exist, so this is a bug, not bad output.
  throw new Error(`Assertion ${assertion.itemId}.${assertion.field} not found`);
}

function parsed(step: CvAiStep, content: CvContent): CvContent {
  const result = cvContentSchema.safeParse(content);
  if (!result.success) {
    const where = result.error.issues.map((issue) => issue.path.join('.'));
    throw new InvalidAiOutputError(step, `invalid fields: ${where.join(', ')}`);
  }
  return result.data;
}
