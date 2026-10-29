import {
  type Anchor,
  cleanLine,
  type CvContent,
  cvContentSchema,
  QUESTION_LIMITS,
} from '@ai-cv-builder/shared';
import {
  type Claim,
  type CvAiOutput,
  type CvAiStep,
  type Fact,
  InvalidAiOutputError,
} from '../ai/cv-ai.js';

export interface Finding {
  claim: Claim;
  problem: string;
  softened: string | null;
  question: string;
}

/** A Question the pipeline asks, before it is stored. */
export interface DraftQuestion {
  anchor: Anchor;
  text: string;
}

const sameClaim = (a: Pick<Claim, 'itemId' | 'field'>, b: Claim) =>
  a.itemId === b.itemId && a.field === b.field;

/**
 * The structural check on judge output: every finding names a Claim the judge
 * was shown and carries a usable Question. Throws {@link InvalidAiOutputError}.
 */
export function checkJudgeOutput(
  output: CvAiOutput<'judge'>,
  claims: Claim[],
): Finding[] {
  return output.findings.map((finding, i) => {
    const claim = claims.find((c) => sameClaim(finding, c));
    if (!claim) {
      throw new InvalidAiOutputError(
        'judge',
        `findings.${i} names no Claim it was shown`,
      );
    }
    return {
      claim,
      problem: finding.problem,
      softened: finding.softened,
      question: questionText('judge', finding.question, `findings.${i}`),
    };
  });
}

/**
 * Applies repair output to the flagged Claims only: a fix for anything else, or
 * one citing an unknown Fact, is a structural failure, and so is a result that
 * fails the CV content schema. A flagged Claim without a fix stays as it was.
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
    const finding = findings.find((f) => sameClaim(fix, f.claim));
    if (!finding) {
      throw new InvalidAiOutputError(
        'repair',
        `fixes.${i} rewrites a Claim that was not flagged`,
      );
    }
    const unknown = fix.sourceFactIds.filter((id) => !factIds.has(id));
    if (unknown.length > 0) {
      throw new InvalidAiOutputError(
        'repair',
        `fixes.${i} cites unknown Facts ${unknown.join(', ')}`,
      );
    }
    repaired = setClaim(
      repaired,
      finding.claim,
      fix.value,
      fix.sourceFactIds,
    ).content;
  });
  return parsed('repair', repaired);
}

/**
 * The last resort for Claims still unsupported after repair: each is cut back
 * to the judge's softened version (or dropped) and becomes a Question.
 */
export function soften(
  content: CvContent,
  findings: Finding[],
): { content: CvContent; questions: DraftQuestion[] } {
  let softened = content;
  const questions = findings.map(({ claim, softened: value, question }) => {
    const result = setClaim(softened, claim, value, []);
    softened = result.content;
    return { anchor: result.anchor, text: question };
  });
  return { content: parsed('judge', softened), questions };
}

/**
 * Writes `value` into the Claim's field (`null` removes it: an unknown field
 * becomes `null`, a required text becomes empty, a bullet or skill goes) and
 * adds `sourceFactIds` to its item's citations. Returns where the Claim lives
 * afterwards: the parent Experience for a dropped bullet.
 */
function setClaim(
  content: CvContent,
  claim: Claim,
  value: string | null,
  sourceFactIds: string[],
): { content: CvContent; anchor: Anchor } {
  const next = structuredClone(content);
  const cite = (item: { sourceFactIds: string[] }) => {
    item.sourceFactIds = [
      ...new Set([...item.sourceFactIds, ...sourceFactIds]),
    ];
  };
  const write = (item: object) => Object.assign(item, { [claim.field]: value });
  const anchor: Anchor = {
    section: claim.section,
    itemId:
      claim.itemId === 'contact' || claim.itemId === 'summary'
        ? null
        : claim.itemId,
    field: claim.field,
  };

  if (claim.itemId === 'contact') {
    const { contact } = next;
    if (claim.field === 'links') {
      contact.links = value === null ? [] : value.split(/,\s*/).filter(Boolean);
    } else if (claim.field === 'fullName' || claim.field === 'email') {
      contact[claim.field] = value ?? '';
    } else {
      write(contact);
    }
    cite(contact);
    return { content: next, anchor };
  }
  if (claim.itemId === 'summary') {
    next.summary.text = value ?? '';
    cite(next.summary);
    return { content: next, anchor };
  }

  for (const experience of next.experience) {
    if (experience.id === claim.itemId) {
      write(experience);
      cite(experience);
      return { content: next, anchor };
    }
    const index = experience.bullets.findIndex((b) => b.id === claim.itemId);
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
  const education = next.education.find((e) => e.id === claim.itemId);
  if (education) {
    write(education);
    cite(education);
    return { content: next, anchor };
  }
  const index = next.skills.findIndex((s) => s.id === claim.itemId);
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
  // listClaims only lists items that exist, so this is a bug, not bad output.
  throw new Error(`Claim ${claim.itemId}.${claim.field} not found`);
}

function parsed(step: CvAiStep, content: CvContent): CvContent {
  const result = cvContentSchema.safeParse(content);
  if (!result.success) {
    const where = result.error.issues.map((issue) => issue.path.join('.'));
    throw new InvalidAiOutputError(step, `invalid fields: ${where.join(', ')}`);
  }
  return result.data;
}

/** A Question's text as stored: one clean line within the limit. */
export function questionText(
  step: CvAiStep,
  text: string,
  path: string,
): string {
  const line = cleanLine(text);
  if (line === '' || line.length > QUESTION_LIMITS.text) {
    throw new InvalidAiOutputError(
      step,
      `${path}.question is empty or too long`,
    );
  }
  return line;
}
