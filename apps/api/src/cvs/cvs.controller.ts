import {
  type CreateCvFields,
  createCvFieldsSchema,
  type CreateCvResponse,
  createGenerationSchema,
  type CvList,
  type CvView,
  type Generation,
  idempotencyKeySchema,
  type QuestionList,
  type User,
} from '@ai-cv-builder/shared';
import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ZodValidationPipe } from '../http/zod-validation.pipe.js';
import { CvsService, type UploadedPdf } from './cvs.service.js';
import { FileTooLargeInterceptor } from './file-too-large.interceptor.js';
import { IdempotencyKey } from './idempotency-key.decorator.js';

/** A malformed id can name no CV: answered like any CV the caller does not own. */
const cvIdPipe = new ParseUUIDPipe({
  errorHttpStatusCode: HttpStatus.NOT_FOUND,
});

/** `Content-Disposition` with an ASCII fallback name and the real one as RFC 5987 UTF-8. */
function attachment(fileName: string): string {
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="cv.pdf"; filename*=UTF-8''${encoded}`;
}

@Controller('cvs')
export class CvsController {
  constructor(private readonly cvs: CvsService) {}

  @Get()
  list(@CurrentUser() user: User): Promise<CvList> {
    return this.cvs.list(user.id);
  }

  /** Multipart: `targetRole` plus exactly one of a `file` (PDF) or `text`. */
  @Post()
  @UseInterceptors(FileTooLargeInterceptor, FileInterceptor('file'))
  async create(
    @CurrentUser() user: User,
    @IdempotencyKey(new ZodValidationPipe(idempotencyKeySchema))
    idempotencyKey: string,
    @Body(new ZodValidationPipe(createCvFieldsSchema)) fields: CreateCvFields,
    @UploadedFile() file: UploadedPdf | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CreateCvResponse> {
    const { cvId, replayed } = await this.cvs.create(
      user.id,
      idempotencyKey,
      fields,
      file,
    );
    if (replayed) res.status(HttpStatus.OK);
    return { cvId };
  }

  @Get(':cvId')
  view(
    @CurrentUser() user: User,
    @Param('cvId', cvIdPipe) cvId: string,
  ): Promise<CvView> {
    return this.cvs.view(user.id, cvId);
  }

  /** Rendered on demand and never cached: it always matches the stored content. */
  @Get(':cvId/pdf')
  async pdf(
    @CurrentUser() user: User,
    @Param('cvId', cvIdPipe) cvId: string,
    @Res() res: Response,
  ): Promise<void> {
    const { bytes, fileName } = await this.cvs.pdf(user.id, cvId);
    res
      .status(HttpStatus.OK)
      .type('application/pdf')
      .set('Content-Disposition', attachment(fileName))
      .set('Cache-Control', 'no-store')
      .send(bytes);
  }

  @Get(':cvId/generation')
  latestGeneration(
    @CurrentUser() user: User,
    @Param('cvId', cvIdPipe) cvId: string,
  ): Promise<Generation> {
    return this.cvs.latestGeneration(user.id, cvId);
  }

  @Get(':cvId/questions')
  questions(
    @CurrentUser() user: User,
    @Param('cvId', cvIdPipe) cvId: string,
  ): Promise<QuestionList> {
    return this.cvs.questions(user.id, cvId);
  }

  @Post(':cvId/generations')
  retry(
    @CurrentUser() user: User,
    @Param('cvId', cvIdPipe) cvId: string,
    @Body(new ZodValidationPipe(createGenerationSchema)) _body: unknown,
  ): Promise<Generation> {
    return this.cvs.retry(user.id, cvId);
  }
}
