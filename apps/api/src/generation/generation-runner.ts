import {
  anchorSchema,
  type CvContent,
  cvContentSchema,
  type CvSection,
  type GenerationErrorCode,
  type GenerationStep,
} from '@ai-cv-builder/shared';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import {
  type Assertion,
  CvAi,
  type Fact,
  factSchema,
  InvalidAiOutputError,
} from '../ai/cv-ai.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  type Cv,
  type GenerationStatus,
  Prisma,
} from '../generated/prisma/client.js';
import { SourceStorage } from '../source/source-storage.js';
import { classifyFailure, UnreadableSourceError } from './classify-failure.js';
import { listAssertions } from './assertions.js';
import { checkComposeOutput } from './compose-check.js';
import {
  applyRepair,
  checkJudgeOutput,
  sameAssertion,
  soften,
} from './judge-check.js';
import {
  anchorComposeQuestions,
  type DraftQuestion,
  missingInfoQuestions,
  reanchor,
} from './questions.js';
import { ACTIVE_GENERATION_STATUSES } from './generations.service.js';
import {
  answerFact,
  assertionIdsOf,
  changedItemIds,
  checkUpdateOutput,
  inWritten,
  nextFactIds,
  type ScopeKey,
  type Landing,
  landingOf,
  toUpdateScope,
  writeUpdate,
} from './answer-update.js';

const ACTIVE: readonly GenerationStatus[] = ACTIVE_GENERATION_STATUSES;

/** One Answer an answer Generation applies, and where it lands in the content it read. */
interface Applied {
  question: { id: string; text: string; answer: string };
  landing: Landing;
  fact: Fact | null;
  /** The Fact is new; `false` when it is the one an earlier Update CV made from this same Answer (then undone). */
  isNewFact: boolean;
}

/** What an answer Generation produced, before it is written over the content as it is by then. */
interface AnswerResult {
  base: CvContent;
  applied: Applied[];
  scope: Set<ScopeKey>;
  updated: CvContent;
  changedIds: string[];
  questions: DraftQuestion[];
}

/**
 * The Generation job handler: extract → compose → judge (with repair), each
 * call retried once on a structural failure; an answer Generation (Update CV)
 * runs update → judge (with repair) over its scope only. Idempotent, because
 * pg-boss re-runs a job after a crash:
 * Facts are a checkpoint a re-run resumes from, and the final write is guarded
 * so a late or duplicate worker writes nothing.
 */
@Injectable()
export class GenerationRunner {
  private readonly logger = new Logger(GenerationRunner.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cvAi: CvAi,
    private readonly sources: SourceStorage,
  ) {}

  /**
   * Resolves when the Generation is finished (or there was nothing to do);
   * rejects with a transient error so pg-boss retries the job.
   */
  async run(generationId: string, signal?: AbortSignal): Promise<void> {
    const assertioned = await this.assertion(generationId);
    if (!assertioned) {
      this.logger.log({ msg: 'nothing to run', generationId });
      return;
    }
    const { cv, kind } = assertioned;

    let step: GenerationStep = kind === 'answer' ? 'compose' : 'extract';
    try {
      if (kind === 'answer') {
        const result = await this.applyAnswers(
          generationId,
          cv,
          signal,
          (s) => {
            step = s;
          },
        );
        await this.succeedAnswers(generationId, cv.id, result);
        return;
      }

      const facts =
        cv.facts === null
          ? await this.extract(generationId, cv.id, signal)
          : z.array(factSchema).parse(cv.facts);

      step = 'compose';
      await this.setStep(generationId, step);
      const composed = await retryOnceIfInvalid(async () => {
        const output = await this.cvAi.compose({
          facts,
          targetRole: cv.targetRole,
          signal,
        });
        const content = checkComposeOutput(output, facts);
        return {
          content,
          questions: anchorComposeQuestions(output.questions, content),
        };
      });

      step = 'judge';
      await this.setStep(generationId, step);
      const judged = await this.judgeAndRepair(
        facts,
        cv.targetRole,
        composed.content,
        signal,
      );

      const asked = reanchor(
        [...composed.questions, ...judged.questions],
        judged.content,
      );
      await this.succeed(generationId, cv.id, {
        content: judged.content,
        questions: [...asked, ...missingInfoQuestions(judged.content, asked)],
      });
    } catch (error) {
      const failure = classifyFailure(error, step);
      this.logger.warn({
        msg: 'generation step failed',
        generationId,
        cvId: cv.id,
        step,
        failure,
        error: loggable(error),
      });
      if (failure.kind === 'transient') throw error;
      await this.fail(generationId, failure.code);
    }
  }

  /** The dead-letter handler: the job's retries are spent, possibly without our handler ever finishing. */
  async markWorkerLost(generationId: string): Promise<void> {
    await this.fail(generationId, 'worker_lost');
  }

  /** Marks a queued or running Generation as running; `null` if it is finished or gone (CV deleted). */
  private async assertion(generationId: string) {
    const generation = await this.prisma.generation.findUnique({
      where: { id: generationId },
      include: { cv: true },
    });
    if (!generation || !ACTIVE.includes(generation.status)) return null;

    const { count } = await this.prisma.generation.updateMany({
      where: { id: generationId, status: { in: [...ACTIVE] } },
      data: {
        status: 'running',
        step: generation.kind === 'answer' ? 'compose' : 'extract',
        attempt: { increment: 1 },
        startedAt: generation.startedAt ?? new Date(),
      },
    });
    return count === 0 ? null : { cv: generation.cv, kind: generation.kind };
  }

  private async extract(
    generationId: string,
    cvId: string,
    signal?: AbortSignal,
  ): Promise<Fact[]> {
    await this.setStep(generationId, 'extract');
    const source = await this.sources.get(cvId);
    // Only when the CV was deleted meanwhile; failing it then writes nothing.
    if (!source) throw new Error('Source not found');

    const facts = await retryOnceIfInvalid(async () => {
      const output = await this.cvAi.extract({ source, signal });
      if (output.facts.some((fact) => fact.text.trim() === '')) {
        throw new InvalidAiOutputError('extract', 'a Fact is empty');
      }
      return output.facts.map((fact, index): Fact => ({
        id: `f${index + 1}`,
        text: fact.text.trim(),
        quote: fact.quote,
        source: source.kind,
      }));
    });
    if (facts.length === 0) throw new UnreadableSourceError();

    // The checkpoint: kept even if a later step fails, so Try again reuses it.
    // A concurrent worker may have stored its own Facts first; the stored ones win.
    await this.prisma.cv.updateMany({
      where: { id: cvId, facts: { equals: Prisma.DbNull } },
      data: { facts },
    });
    const cv = await this.prisma.cv.findUnique({
      where: { id: cvId },
      select: { facts: true },
    });
    return cv?.facts ? z.array(factSchema).parse(cv.facts) : facts;
  }

  /**
   * The judge checks every Assertion; one repair call rewrites the flagged ones;
   * the judge checks only those again, and whatever it still flags is softened
   * into a Question. Each call is retried once on a structural failure.
   */
  private async judgeAndRepair(
    facts: Fact[],
    targetRole: string,
    content: CvContent,
    signal?: AbortSignal,
    /** Only the Assertions of these items; every item when absent. */
    itemIds?: Set<string>,
  ): Promise<{ content: CvContent; questions: DraftQuestion[] }> {
    const judge = (assertions: Assertion[]) =>
      retryOnceIfInvalid(async () =>
        checkJudgeOutput(
          await this.cvAi.judge({ facts, assertions, signal }),
          assertions,
        ),
      );

    const findings = await judge(
      listAssertions(content).filter(
        (assertion) => !itemIds || itemIds.has(assertion.itemId),
      ),
    );
    if (findings.length === 0) return { content, questions: [] };

    const repaired = await retryOnceIfInvalid(async () =>
      applyRepair(
        content,
        findings,
        await this.cvAi.repair({
          facts,
          targetRole,
          flagged: findings.map(({ assertion, problem }) => ({
            assertion,
            problem,
          })),
          signal,
        }),
        facts,
      ),
    );

    const flagged = listAssertions(repaired).filter((assertion) =>
      findings.some((finding) => sameAssertion(finding.assertion, assertion)),
    );
    const surviving = flagged.length > 0 ? await judge(flagged) : [];
    return soften(repaired, surviving);
  }

  /**
   * Update CV: each Answer this Generation took becomes a Fact; one update call
   * rewrites the scopes they anchor (never an Edited or a gone item), and the
   * judge checks only what it changed. Nothing is written here.
   */
  private async applyAnswers(
    generationId: string,
    cv: Cv,
    signal: AbortSignal | undefined,
    onStep: (step: GenerationStep) => void,
  ): Promise<AnswerResult> {
    const base = cvContentSchema.parse(cv.content);
    const facts = z.array(factSchema).parse(cv.facts);
    const questions = await this.prisma.question.findMany({
      where: { generationId, status: 'answered', appliedAt: null },
      orderBy: { position: 'asc' },
    });
    const answered = questions.flatMap((question) =>
      question.answer === null
        ? []
        : [
            {
              question: { ...question, answer: question.answer },
              landing: landingOf(anchorSchema.parse(question.anchor), base),
            },
          ],
    );
    const earlier = (question: Applied['question']) =>
      facts.find(
        (fact) =>
          fact.questionId === question.id && fact.quote === question.answer,
      );
    const ids = nextFactIds(
      facts,
      answered.filter(
        ({ question, landing }) =>
          landing.kind !== 'gone' && !earlier(question),
      ).length,
    );
    const applied: Applied[] = answered.map(({ question, landing }) => {
      if (landing.kind === 'gone') {
        return { question, landing, fact: null, isNewFact: false };
      }
      const reused = earlier(question);
      return {
        question,
        landing,
        fact: reused ?? answerFact(ids.shift()!, question),
        isNewFact: !reused,
      };
    });
    const answers = applied.flatMap(({ fact }) => (fact ? [fact] : []));
    const allFacts = [...facts, ...answers];
    const scope = new Set(
      applied.flatMap(({ landing }) =>
        landing.kind === 'scope' ? [landing.key] : [],
      ),
    );
    const nothing = { updated: base, changedIds: [], questions: [] };
    if (scope.size === 0) return { base, applied, scope, ...nothing };

    onStep('compose');
    await this.setStep(generationId, 'compose');
    const updateScope = toUpdateScope(scope);
    const rewritten = await retryOnceIfInvalid(async () =>
      checkUpdateOutput(
        await this.cvAi.update({
          facts: allFacts,
          answers,
          targetRole: cv.targetRole,
          content: base,
          scope: updateScope,
          signal,
        }),
        base,
        updateScope,
        allFacts,
      ),
    );
    const changed = changedItemIds(base, rewritten.content);
    if (changed.length === 0) return { base, applied, scope, ...nothing };

    onStep('judge');
    await this.setStep(generationId, 'judge');
    const judged = await this.judgeAndRepair(
      allFacts,
      cv.targetRole,
      rewritten.content,
      signal,
      assertionIdsOf(rewritten.content, changed),
    );
    return {
      base,
      applied,
      scope,
      updated: judged.content,
      changedIds: changedItemIds(base, judged.content),
      questions: reanchor(
        [...rewritten.questions, ...judged.questions],
        judged.content,
      ),
    };
  }

  /**
   * The single final write of an answer Generation, guarded like {@link succeed}:
   * under the CV's row lock, the changed items go over the content as it is
   * now (an item the User changed meanwhile is skipped), the Facts are added,
   * the Answers are applied, and the open Questions of every scope written are
   * replaced by the new ones.
   */
  private async succeedAnswers(
    generationId: string,
    cvId: string,
    { base, applied, scope, updated, changedIds, questions }: AnswerResult,
  ) {
    const written = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.generation.updateMany({
        where: { id: generationId, status: 'running' },
        data: { status: 'succeeded', step: null, finishedAt: new Date() },
      });
      if (count === 0) return false;
      const [row] = await tx.$queryRaw<{ content: unknown; facts: unknown }[]>`
        SELECT "content", "facts" FROM "Cv" WHERE "id" = ${cvId}::uuid FOR UPDATE`;
      if (!row) return false;
      const content = cvContentSchema.parse(row.content);
      const facts = z.array(factSchema).parse(row.facts);

      const questionIdsFor = (section: CvSection, itemId: string) =>
        applied
          .filter(
            ({ landing }) =>
              landing.kind === 'scope' &&
              // An item's own Answers, and those about its section as a whole.
              (landing.key === `item:${itemId}` || landing.key === section),
          )
          .map(({ question }) => question.id);
      const writtenScopes = writeUpdate(
        content,
        base,
        updated,
        changedIds,
        scope,
        questionIdsFor,
      );

      await tx.cv.update({
        where: { id: cvId },
        data: {
          content,
          facts: [
            ...facts,
            ...applied.flatMap(({ fact, isNewFact }) =>
              fact && isNewFact ? [fact] : [],
            ),
          ],
        },
      });
      const appliedAt = new Date();
      for (const { question, fact } of applied) {
        await tx.question.update({
          where: { id: question.id },
          data: fact ? { appliedAt } : { status: 'obsolete' },
        });
      }

      // The open Questions of what was rewritten give way to what the update asked.
      const open = await tx.question.findMany({
        where: { cvId, status: 'open' },
        select: { id: true, anchor: true },
      });
      const replaced = open.filter(({ anchor }) =>
        inWritten(
          landingOf(anchorSchema.parse(anchor), content),
          writtenScopes,
        ),
      );
      await tx.question.updateMany({
        where: { id: { in: replaced.map(({ id }) => id) } },
        data: { status: 'obsolete' },
      });
      const kept = await tx.question.findMany({
        where: { cvId, status: 'open' },
        select: { anchor: true, text: true },
      });
      const asked = questions.filter(({ anchor }) =>
        inWritten(landingOf(anchor, content), writtenScopes),
      );
      const unasked = missingInfoQuestions(content, [
        ...asked,
        ...kept.map(({ anchor, text }) => ({
          anchor: anchorSchema.parse(anchor),
          text,
        })),
      ]).filter(({ anchor }) =>
        inWritten(landingOf(anchor, content), writtenScopes),
      );
      const { _max } = await tx.question.aggregate({
        where: { cvId },
        _max: { position: true },
      });
      const start = (_max.position ?? -1) + 1;
      await tx.question.createMany({
        data: [...asked, ...unasked].map(({ anchor, text }, i) => ({
          cvId,
          anchor,
          text,
          position: start + i,
        })),
      });
      return true;
    });
    this.logger.log({
      msg: written ? 'answers applied' : 'generation already finished',
      generationId,
      cvId,
    });
  }

  private async setStep(generationId: string, step: GenerationStep) {
    await this.prisma.generation.updateMany({
      where: { id: generationId, status: 'running' },
      data: { step },
    });
  }

  /** The single final write, guarded: only the worker that still finds its Generation running writes. */
  private async succeed(
    generationId: string,
    cvId: string,
    { content, questions }: { content: CvContent; questions: DraftQuestion[] },
  ) {
    const written = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.generation.updateMany({
        where: { id: generationId, status: 'running' },
        data: { status: 'succeeded', step: null, finishedAt: new Date() },
      });
      if (count === 0) return false;
      await tx.cv.update({
        where: { id: cvId },
        data: { content, status: 'ready' },
      });
      await tx.question.createMany({
        data: questions.map(({ anchor, text }, position) => ({
          cvId,
          anchor,
          text,
          position,
        })),
      });
      return true;
    });
    this.logger.log({
      msg: written ? 'generation succeeded' : 'generation already finished',
      generationId,
      cvId,
    });
  }

  private async fail(generationId: string, errorCode: GenerationErrorCode) {
    await this.prisma.$transaction(async (tx) => {
      const generation = await tx.generation.findUnique({
        where: { id: generationId },
        select: { cvId: true, kind: true },
      });
      if (!generation) return;
      const { count } = await tx.generation.updateMany({
        where: { id: generationId, status: { in: [...ACTIVE] } },
        data: {
          status: 'failed',
          step: null,
          errorCode,
          finishedAt: new Date(),
        },
      });
      // A failed Update CV leaves the CV as it was: ready, its Answers pending.
      if (count === 0 || generation.kind === 'answer') return;
      await tx.cv.update({
        where: { id: generation.cvId },
        data: { status: 'failed' },
      });
    });
  }
}

/** The step layer of retries: one more call after unusable output, nothing else. */
async function retryOnceIfInvalid<T>(attempt: () => Promise<T>): Promise<T> {
  try {
    return await attempt();
  } catch (error) {
    if (!(error instanceof InvalidAiOutputError)) throw error;
    return attempt();
  }
}

/** For logs only: the error's kind and Anthropic request id, never Source or CV text. */
function loggable(error: unknown) {
  if (error instanceof InvalidAiOutputError) {
    return { name: error.name, step: error.step, reason: error.reason };
  }
  if (error instanceof Error) {
    const requestId = (error as { requestID?: string | null }).requestID;
    return { name: error.name, ...(requestId && { requestId }) };
  }
  return { name: typeof error };
}
