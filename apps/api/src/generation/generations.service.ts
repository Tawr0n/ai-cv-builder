import type { Generation as GenerationView } from '@ai-cv-builder/shared';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../env/env.js';
import { isUniqueViolation } from '../database/prisma-errors.js';
import type { Generation, Prisma } from '../generated/prisma/client.js';
import { ApiException } from '../http/api.exception.js';
import { GenerationQueue } from './generation-queue.js';

/** A Generation in one of these is active: it counts toward the per-User limit. */
export const ACTIVE_GENERATION_STATUSES = ['queued', 'running'] as const;

/** Starts Generations and shapes them for the API. */
@Injectable()
export class GenerationsService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly queue: GenerationQueue,
  ) {}

  /**
   * Creates a queued Generation and its job inside `tx`. Holds the User's row
   * lock until `tx` ends, so concurrent starts count active Generations one at
   * a time: over the limit → 429; another active one on this CV → 409.
   */
  async start(
    tx: Prisma.TransactionClient,
    { userId, cvId }: { userId: string; cvId: string },
  ): Promise<Generation> {
    await lockUser(tx, userId);
    const active = await tx.generation.count({
      where: { userId, status: { in: [...ACTIVE_GENERATION_STATUSES] } },
    });
    if (active >= this.env.MAX_ACTIVE_GENERATIONS) {
      throw new ApiException(
        HttpStatus.TOO_MANY_REQUESTS,
        'too_many_active_generations',
        `At most ${this.env.MAX_ACTIVE_GENERATIONS} CVs can generate at once; wait for one to finish`,
      );
    }

    let generation: Generation;
    try {
      generation = await tx.generation.create({
        data: { cvId, userId, kind: 'initial' },
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw generationActive();
      throw error;
    }
    await this.queue.enqueue(tx, generation.id);
    return generation;
  }
}

/** Serialises every Generation start of one User until the transaction ends. */
export async function lockUser(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT 1 FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
}

function generationActive() {
  return new ApiException(
    HttpStatus.CONFLICT,
    'generation_active',
    'This CV is already generating',
  );
}

export function toGenerationView(generation: Generation): GenerationView {
  return {
    id: generation.id,
    kind: generation.kind,
    status: generation.status,
    step: generation.step,
    errorCode: generation.errorCode,
    createdAt: generation.createdAt.toISOString(),
    finishedAt: generation.finishedAt?.toISOString() ?? null,
  };
}
