import {
  type AnswerQuestion,
  answerQuestionSchema,
  type Question,
  type QuestionList,
  type User,
} from '@ai-cv-builder/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ZodValidationPipe } from '../http/zod-validation.pipe.js';
import { QuestionsService } from './questions.service.js';

/** A malformed id can name no CV or Question: answered like any the caller does not own. */
const idPipe = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND });

@Controller('cvs/:cvId/questions')
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Get()
  list(
    @CurrentUser() user: User,
    @Param('cvId', idPipe) cvId: string,
  ): Promise<QuestionList> {
    return this.questions.list(user.id, cvId);
  }

  @Put(':questionId/answer')
  answer(
    @CurrentUser() user: User,
    @Param('cvId', idPipe) cvId: string,
    @Param('questionId', idPipe) questionId: string,
    @Body(new ZodValidationPipe(answerQuestionSchema)) body: AnswerQuestion,
  ): Promise<Question> {
    return this.questions.answer(user.id, cvId, questionId, body.answer);
  }

  @Post(':questionId/dismiss')
  @HttpCode(HttpStatus.OK)
  dismiss(
    @CurrentUser() user: User,
    @Param('cvId', idPipe) cvId: string,
    @Param('questionId', idPipe) questionId: string,
  ): Promise<Question> {
    return this.questions.dismiss(user.id, cvId, questionId);
  }

  @Post(':questionId/reopen')
  @HttpCode(HttpStatus.OK)
  reopen(
    @CurrentUser() user: User,
    @Param('cvId', idPipe) cvId: string,
    @Param('questionId', idPipe) questionId: string,
  ): Promise<Question> {
    return this.questions.reopen(user.id, cvId, questionId);
  }
}
