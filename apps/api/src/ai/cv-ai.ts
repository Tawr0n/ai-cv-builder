import {
  CV_FIELDS,
  CV_SECTIONS,
  type CvField,
  type CvSection,
} from '@ai-cv-builder/shared';
import { z } from 'zod';
import type { Source } from '../source/source-storage.js';

/** A single statement about the User that CV content may rest on; `id` is assigned by us (`f1`, `f2`, ...). */
export const factSchema = z.object({
  id: z.string(),
  text: z.string(),
  /** The Source's own words the Fact was taken from. */
  quote: z.string(),
  source: z.enum(['pdf', 'text']),
});

export type Fact = z.infer<typeof factSchema>;

/** What extract returns: Facts without ids, which the pipeline numbers. */
export const extractOutputSchema = z.object({
  facts: z.array(
    z.object({
      text: z
        .string()
        .describe('One atomic statement about the person, in English'),
      quote: z
        .string()
        .describe('The exact words of the source this fact comes from'),
    }),
  ),
});

const questionText = z
  .string()
  .describe(
    'A short question to the person, in the language of the quotes of the facts',
  );

const cited = {
  sourceFactIds: z
    .array(z.string())
    .describe('Ids of every fact this item rests on, e.g. ["f3", "f7"]'),
};
const unknown = (description: string) =>
  z
    .string()
    .nullable()
    .describe(`${description}; null when the facts do not say`);
const date = (description: string) =>
  unknown(`${description} as YYYY-MM, or YYYY when only the year is known`);

/**
 * What compose returns: CV content without our ids, `rev` or `edited`. Kept to
 * the structured-outputs subset (no length limits: the pipeline checks those
 * after parsing, against the same schema a hand edit must pass).
 */
export const composeOutputSchema = z.object({
  contact: z.object({
    fullName: z.string().describe('Empty string when unknown'),
    email: z.string().describe('Empty string when unknown'),
    phone: unknown('Phone number'),
    location: unknown('City and country'),
    links: z.array(z.string()).describe('Profile or portfolio URLs'),
    ...cited,
  }),
  summary: z.object({
    text: z.string().describe('2–4 sentences aimed at the target role'),
    ...cited,
  }),
  experience: z
    .array(
      z.object({
        organization: unknown('Organization name'),
        title: unknown('Job title, exactly as stated'),
        startDate: date('Start'),
        endDate: unknown(
          'End as YYYY-MM or YYYY, "present" for a current role, null when the facts do not say',
        ),
        location: unknown('Location'),
        bullets: z.array(
          z.object({
            text: z.string().describe('One concise line, about 20 words'),
            ...cited,
          }),
        ),
        ...cited,
      }),
    )
    .describe('Most relevant to the target role first; newer first on a tie'),
  education: z.array(
    z.object({
      institution: unknown('Institution'),
      degree: unknown('Degree'),
      field: unknown('Field of study'),
      startDate: date('Start'),
      endDate: date('End'),
      ...cited,
    }),
  ),
  skills: z.array(z.object({ name: z.string(), ...cited })),
  questions: z
    .array(
      z.object({
        section: z.enum(CV_SECTIONS),
        itemIndex: z
          .number()
          .int()
          .nullable()
          .describe(
            '0-based index of the item in its section; null for contact, summary or the section as a whole',
          ),
        bulletIndex: z
          .number()
          .int()
          .nullable()
          .describe('0-based index of the bullet in the experience, or null'),
        field: z.enum(CV_FIELDS).nullable().describe('The field, or null'),
        text: questionText,
      }),
    )
    .describe(
      'One question per missing or vague thing, most important first; no limit',
    ),
});

export type ComposeOutput = z.infer<typeof composeOutputSchema>;

/**
 * One statement in CV content the judge checks: one field of one item, with
 * the Facts the item cites. `itemId` is the item's id, or `contact` / `summary`.
 */
export interface Assertion {
  itemId: string;
  section: CvSection;
  field: CvField;
  value: string;
  sourceFactIds: string[];
}

/** What the judge returns: only the Assertions its cited Facts do not support. */
export const judgeOutputSchema = z.object({
  findings: z.array(
    z.object({
      itemId: z.string(),
      field: z.enum(CV_FIELDS),
      problem: z
        .string()
        .describe('What the assertion says that its cited facts do not'),
      softened: z
        .string()
        .nullable()
        .describe(
          'The assertion cut back to exactly what the cited facts state; null when nothing of it is supported',
        ),
      question: questionText.describe(
        'A question that would get the missing fact from the person, in the language of the quotes of the facts',
      ),
    }),
  ),
});

export type JudgeFinding = z.infer<
  typeof judgeOutputSchema
>['findings'][number];

/** What repair returns: a replacement for each flagged Assertion. */
export const repairOutputSchema = z.object({
  fixes: z.array(
    z.object({
      itemId: z.string(),
      field: z.enum(CV_FIELDS),
      value: z
        .string()
        .nullable()
        .describe('The new value; null when no fact supports any of it'),
      ...cited,
    }),
  ),
});

export type ExtractSource =
  { kind: 'pdf'; bytes: Uint8Array } | { kind: 'text'; text: string };

/** Aborted when the job running the Generation expires: the call must stop. */
interface Abortable {
  signal?: AbortSignal;
}

/** Input and output of each pipeline step: parsed domain types, never raw SDK messages. */
export interface CvAiSteps {
  extract: {
    input: { source: Source } & Abortable;
    output: z.infer<typeof extractOutputSchema>;
  };
  /** Compose sees only the Facts and the Target role, never the Source. */
  compose: {
    input: { facts: Fact[]; targetRole: string } & Abortable;
    output: ComposeOutput;
  };
  /** Judge audits each Assertion against the Facts it cites. */
  judge: {
    input: { facts: Fact[]; assertions: Assertion[] } & Abortable;
    output: z.infer<typeof judgeOutputSchema>;
  };
  /** Repair rewrites only the Assertions the judge flagged. */
  repair: {
    input: {
      facts: Fact[];
      targetRole: string;
      flagged: { assertion: Assertion; problem: string }[];
    } & Abortable;
    output: z.infer<typeof repairOutputSchema>;
  };
}

export type CvAiStep = keyof CvAiSteps;
export type CvAiInput<S extends CvAiStep> = CvAiSteps[S]['input'];
export type CvAiOutput<S extends CvAiStep> = CvAiSteps[S]['output'];

/**
 * The model's answer could not be used: a refusal, output cut off at
 * `max_tokens`, or output that fails the pipeline's structural check. The step
 * is retried once, then the Generation fails with `invalid_ai_output`.
 */
export class InvalidAiOutputError extends Error {
  constructor(
    readonly step: CvAiStep,
    readonly reason: string,
  ) {
    super(`${step}: ${reason}`);
    this.name = 'InvalidAiOutputError';
  }
}

/**
 * The port between the Generation pipeline and the model: one method per step.
 * Structural validation of the output lives in the pipeline, outside the port,
 * so no implementation (the fake included) can skip it.
 */
export abstract class CvAi {
  abstract extract(input: CvAiInput<'extract'>): Promise<CvAiOutput<'extract'>>;
  abstract compose(input: CvAiInput<'compose'>): Promise<CvAiOutput<'compose'>>;
  abstract judge(input: CvAiInput<'judge'>): Promise<CvAiOutput<'judge'>>;
  abstract repair(input: CvAiInput<'repair'>): Promise<CvAiOutput<'repair'>>;
}
