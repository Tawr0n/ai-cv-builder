import {
  type CreateCvFields,
  type CvList,
  cvContentSchema,
  type CvView,
  type Generation as GenerationView,
} from '@ai-cv-builder/shared';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { ENV, type Env } from '../env/env.js';
import {
  GenerationsService,
  lockUser,
  toGenerationView,
} from '../generation/generations.service.js';
import { ApiException } from '../http/api.exception.js';
import { PdfRenderer } from '../pdf/pdf-renderer.js';
import { type Source, SourceStorage } from '../source/source-storage.js';
import { assertReadablePdf } from './pdf-check.js';

export interface UploadedPdf {
  originalname: string;
  buffer: Buffer;
}

export interface CvPdf {
  bytes: Buffer;
  /** Human-readable, may be non-ASCII; the controller encodes it for the header. */
  fileName: string;
}

export interface CreatedCv {
  cvId: string;
  /** A known `Idempotency-Key`: the existing CV, nothing new was created. */
  replayed: boolean;
}

/**
 * Ownership rule: every method takes the `userId` of the caller and filters by
 * it; there is no lookup that works without one. A CV of another User is
 * answered exactly like a missing one: 404.
 */
@Injectable()
export class CvsService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly generations: GenerationsService,
    private readonly sources: SourceStorage,
    private readonly pdfs: PdfRenderer,
  ) {}

  async list(userId: string): Promise<CvList> {
    const cvs = await this.prisma.cv.findMany({
      where: { ownerId: userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, targetRole: true, status: true, updatedAt: true },
    });
    return {
      items: cvs.map((cv) => ({
        ...cv,
        updatedAt: cv.updatedAt.toISOString(),
      })),
    };
  }

  /**
   * Creates the CV, its Source and its first Generation, and enqueues the job,
   * in one transaction. The Source is checked before anything is written.
   */
  async create(
    userId: string,
    idempotencyKey: string,
    { targetRole, text }: CreateCvFields,
    file: UploadedPdf | undefined,
  ): Promise<CreatedCv> {
    const source = await this.toSource(text, file);

    return this.prisma.$transaction(async (tx) => {
      // Taken before the key lookup, so two requests with one key cannot both miss it.
      await lockUser(tx, userId);
      const existing = await tx.cv.findUnique({
        where: { ownerId_idempotencyKey: { ownerId: userId, idempotencyKey } },
        select: { id: true },
      });
      if (existing) return { cvId: existing.id, replayed: true };

      const cv = await tx.cv.create({
        data: {
          ownerId: userId,
          targetRole,
          status: 'generating',
          idempotencyKey,
        },
        select: { id: true },
      });
      await this.sources.put(tx, cv.id, source);
      await this.generations.start(tx, { userId, cvId: cv.id });
      return { cvId: cv.id, replayed: false };
    });
  }

  async view(userId: string, cvId: string): Promise<CvView> {
    const cv = await this.prisma.cv.findFirst({
      where: { id: cvId, ownerId: userId },
      include: { generations: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    const [latest] = cv?.generations ?? [];
    if (!cv || !latest) throw cvNotFound();
    return {
      id: cv.id,
      targetRole: cv.targetRole,
      status: cv.status,
      version: cv.version,
      // Parsed on every read, too: the database does not know the document's shape.
      content: cv.content === null ? null : cvContentSchema.parse(cv.content),
      latestGeneration: toGenerationView(latest),
    };
  }

  /** The CV printed as an A4 PDF, rendered on demand; only a `ready` CV has content to print. */
  async pdf(userId: string, cvId: string): Promise<CvPdf> {
    const { status, content, targetRole } = await this.view(userId, cvId);
    if (status !== 'ready' || !content) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'cv_not_ready',
        'The CV has no content to print yet',
      );
    }
    return {
      bytes: await this.pdfs.render(content),
      fileName: `${content.contact.fullName || targetRole} - CV.pdf`,
    };
  }

  /** The CV's most recent Generation of any kind. */
  async latestGeneration(
    userId: string,
    cvId: string,
  ): Promise<GenerationView> {
    const generation = await this.prisma.generation.findFirst({
      where: { cvId, cv: { ownerId: userId } },
      orderBy: { createdAt: 'desc' },
    });
    if (!generation) throw cvNotFound();
    return toGenerationView(generation);
  }

  /** Try again: a new Generation with the same Source and Target role, only after a failure. */
  async retry(userId: string, cvId: string): Promise<GenerationView> {
    const generation = await this.prisma.$transaction(async (tx) => {
      const latest = await tx.generation.findFirst({
        where: { cvId, cv: { ownerId: userId } },
        orderBy: { createdAt: 'desc' },
        select: { status: true },
      });
      if (!latest) throw cvNotFound();
      // A concurrent Try again passes this check too, then meets the one-active index: 409.
      if (latest.status !== 'failed') {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'generation_not_failed',
          'Only a CV whose generation failed can be tried again',
        );
      }
      const started = await this.generations.start(tx, { userId, cvId });
      await tx.cv.update({
        where: { id: cvId },
        data: { status: 'generating' },
      });
      return started;
    });
    return toGenerationView(generation);
  }

  private async toSource(
    text: string | undefined,
    file?: UploadedPdf,
  ): Promise<Source> {
    if ((text === undefined) === (file === undefined)) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'validation_failed',
        'Request validation failed',
        [{ path: ['file'], message: 'Send exactly one of a PDF or text' }],
      );
    }
    if (file) {
      await assertReadablePdf(file.buffer, this.env.PDF_MAX_PAGES);
      return { kind: 'pdf', fileName: file.originalname, bytes: file.buffer };
    }
    return { kind: 'text', text: text! };
  }
}

function cvNotFound() {
  return new ApiException(HttpStatus.NOT_FOUND, 'not_found', 'CV not found');
}
