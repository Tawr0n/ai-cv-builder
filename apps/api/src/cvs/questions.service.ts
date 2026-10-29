import {
  anchorSchema,
  type Question as QuestionView,
  type QuestionList,
} from '@ai-cv-builder/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma, Question } from '../generated/prisma/client.js';
import { ACTIVE_GENERATION_STATUSES } from '../generation/generations.service.js';
import { ApiException } from '../http/api.exception.js';

/** A Question with what decides whether it is locked: the Generation that took its Answer. */
type LoadedQuestion = Question & {
  generation: { status: string } | null;
};

const WITH_GENERATION = {
  generation: { select: { status: true } },
} as const;

/** Not taken by an active Update CV, so the User may change it. */
const UNLOCKED: Prisma.QuestionWhereInput = {
  OR: [
    { generationId: null },
    { generation: { status: { notIn: [...ACTIVE_GENERATION_STATUSES] } } },
  ],
};

/**
 * The CV's Questions and the User's Answers. An Answer is pending (editable)
 * until Update CV applies it; while an Update CV that took it runs, it is
 * locked. Same ownership rule as `CvsService`: a foreign CV is a missing one.
 */
@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The CV's Questions, most important first. */
  async list(userId: string, cvId: string): Promise<QuestionList> {
    const cv = await this.prisma.cv.findFirst({
      where: { id: cvId, ownerId: userId },
      select: {
        questions: {
          orderBy: { position: 'asc' },
          include: WITH_GENERATION,
        },
      },
    });
    if (!cv) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'not_found', 'CV not found');
    }
    return { items: cv.questions.map(toQuestionView) };
  }

  /** Saves the Answer as pending, or changes a pending one. */
  answer(userId: string, cvId: string, questionId: string, answer: string) {
    return this.change(
      userId,
      cvId,
      questionId,
      { OR: [{ status: 'open' }, { status: 'answered', appliedAt: null }] },
      { status: 'answered', answer },
    );
  }

  /** "Not relevant": an open or pending Question goes, with its Answer. */
  dismiss(userId: string, cvId: string, questionId: string) {
    return this.change(
      userId,
      cvId,
      questionId,
      { OR: [{ status: 'open' }, { status: 'answered', appliedAt: null }] },
      { status: 'dismissed', answer: null },
    );
  }

  /** Undoes a dismissal. */
  reopen(userId: string, cvId: string, questionId: string) {
    return this.change(
      userId,
      cvId,
      questionId,
      { status: 'dismissed' },
      { status: 'open' },
    );
  }

  /**
   * One guarded write: it changes the Question only while it is still in an
   * `allowed` state and unlocked, so a concurrent Update CV cannot take an
   * Answer halfway through being changed.
   */
  private async change(
    userId: string,
    cvId: string,
    questionId: string,
    allowed: Prisma.QuestionWhereInput,
    data: Prisma.QuestionUpdateManyMutationInput,
  ): Promise<QuestionView> {
    const where = { id: questionId, cvId, cv: { ownerId: userId } };
    const { count } = await this.prisma.question.updateMany({
      where: { ...where, AND: [allowed, UNLOCKED] },
      data,
    });
    const question = await this.prisma.question.findFirst({
      where,
      include: WITH_GENERATION,
    });
    if (!question) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'not_found',
        'Question not found',
      );
    }
    if (count === 0) {
      throw isLocked(question)
        ? new ApiException(
            HttpStatus.CONFLICT,
            'question_locked',
            'Update CV is applying this answer; wait until it finishes',
          )
        : new ApiException(
            HttpStatus.CONFLICT,
            'question_closed',
            'This question can no longer be changed that way',
          );
    }
    return toQuestionView(question);
  }
}

const isLocked = (question: LoadedQuestion) =>
  question.generation !== null &&
  (ACTIVE_GENERATION_STATUSES as readonly string[]).includes(
    question.generation.status,
  );

function toQuestionView(question: LoadedQuestion): QuestionView {
  return {
    id: question.id,
    anchor: anchorSchema.parse(question.anchor),
    text: question.text,
    status: question.status,
    answer: question.answer,
    appliedAt: question.appliedAt?.toISOString() ?? null,
    locked: isLocked(question),
    createdAt: question.createdAt.toISOString(),
  };
}
