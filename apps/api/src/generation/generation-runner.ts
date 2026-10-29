import type {
  CvContent,
  GenerationErrorCode,
  GenerationStep,
} from '@ai-cv-builder/shared';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import {
  CvAi,
  type ExtractSource,
  type Fact,
  factSchema,
  InvalidAiOutputError,
} from '../ai/cv-ai.js';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { classifyFailure, UnreadableSourceError } from './classify-failure.js';
import { checkComposeOutput } from './compose-check.js';

const ACTIVE = ['queued', 'running'] as const;

/**
 * The Generation job handler: extract → compose, each step retried once on a
 * structural failure. Idempotent, because pg-boss re-runs a job after a crash:
 * Facts are a checkpoint a re-run resumes from, and the final write is guarded
 * so a late or duplicate worker writes nothing.
 */
@Injectable()
export class GenerationRunner {
  private readonly logger = new Logger(GenerationRunner.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cvAi: CvAi,
  ) {}

  /**
   * Resolves when the Generation is finished (or there was nothing to do);
   * rejects with a transient error so pg-boss retries the job.
   */
  async run(generationId: string, signal?: AbortSignal): Promise<void> {
    const claimed = await this.claim(generationId);
    if (!claimed) {
      this.logger.log({ msg: 'nothing to run', generationId });
      return;
    }
    const { cv } = claimed;

    let step: GenerationStep = 'extract';
    try {
      const facts =
        cv.facts === null
          ? await this.extract(generationId, cv.id, cv.source, signal)
          : z.array(factSchema).parse(cv.facts);

      step = 'compose';
      await this.setStep(generationId, step);
      const content = await retryOnceIfInvalid(async () =>
        checkComposeOutput(
          await this.cvAi.compose({ facts, targetRole: cv.targetRole, signal }),
          facts,
        ),
      );

      await this.succeed(generationId, cv.id, content);
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
  private async claim(generationId: string) {
    const generation = await this.prisma.generation.findUnique({
      where: { id: generationId },
      include: { cv: { include: { source: true } } },
    });
    if (!generation || !isActive(generation.status)) return null;

    const { count } = await this.prisma.generation.updateMany({
      where: { id: generationId, status: { in: [...ACTIVE] } },
      data: {
        status: 'running',
        step: 'extract',
        attempt: { increment: 1 },
        startedAt: generation.startedAt ?? new Date(),
      },
    });
    const { cv } = generation;
    if (count === 0 || !cv.source) return null;
    return { cv: { ...cv, source: cv.source } };
  }

  private async extract(
    generationId: string,
    cvId: string,
    stored: {
      kind: 'pdf' | 'text';
      bytes: Uint8Array | null;
      text: string | null;
    },
    signal?: AbortSignal,
  ): Promise<Fact[]> {
    await this.setStep(generationId, 'extract');
    const source: ExtractSource =
      stored.kind === 'pdf'
        ? { kind: 'pdf', bytes: stored.bytes! }
        : { kind: 'text', text: stored.text! };

    const facts = await retryOnceIfInvalid(async () => {
      const output = await this.cvAi.extract({ source, signal });
      if (output.facts.some((fact) => fact.text.trim() === '')) {
        throw new InvalidAiOutputError('extract', 'a Fact is empty');
      }
      return output.facts.map((fact, index): Fact => ({
        id: `f${index + 1}`,
        text: fact.text.trim(),
        quote: fact.quote,
        source: stored.kind,
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
    content: CvContent,
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
        select: { cvId: true },
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
      if (count === 0) return;
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

function isActive(status: string): boolean {
  return (ACTIVE as readonly string[]).includes(status);
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
