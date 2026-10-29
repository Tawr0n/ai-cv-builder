import {
  type AddBullet,
  addBulletSchema,
  type CvItem,
  type CvSection,
  cvSectionSchema,
  type CvView,
  itemIdSchema,
  type MoveItem,
  moveItemSchema,
  type PatchItem,
  patchItemSchema,
  removeItemQuerySchema,
  type User,
} from '@ai-cv-builder/shared';
import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ZodValidationPipe } from '../http/zod-validation.pipe.js';
import { CvItemsService } from './cv-items.service.js';

/** A malformed id can name no CV or item: answered like any CV the caller does not own. */
const cvIdPipe = new ParseUUIDPipe({
  errorHttpStatusCode: HttpStatus.NOT_FOUND,
});
const itemIdPipe = new ZodValidationPipe(itemIdSchema);

@Controller('cvs/:cvId')
export class CvItemsController {
  constructor(private readonly items: CvItemsService) {}

  @Patch('items/:itemId')
  patch(
    @CurrentUser() user: User,
    @Param('cvId', cvIdPipe) cvId: string,
    @Param('itemId', itemIdPipe) itemId: string,
    @Body(new ZodValidationPipe(patchItemSchema)) body: PatchItem,
  ): Promise<CvItem> {
    return this.items.patch(user.id, cvId, itemId, body);
  }

  /** `{}` for experience and education (an empty card), `{ name }` for a skill. */
  @Post('sections/:section/items')
  add(
    @CurrentUser() user: User,
    @Param('cvId', cvIdPipe) cvId: string,
    @Param('section', new ZodValidationPipe(cvSectionSchema))
    section: CvSection,
    @Body() body: unknown,
  ): Promise<CvView> {
    return this.items.add(user.id, cvId, section, body);
  }

  /** `rev` (a query parameter, as `DELETE` has no body) is the removed item's own. */
  @Delete('items/:itemId')
  remove(
    @CurrentUser() user: User,
    @Param('cvId', cvIdPipe) cvId: string,
    @Param('itemId', itemIdPipe) itemId: string,
    @Query(new ZodValidationPipe(removeItemQuerySchema))
    { rev }: { rev: number },
  ): Promise<CvView> {
    return this.items.remove(user.id, cvId, itemId, rev);
  }

  @Post('items/:itemId/move')
  @HttpCode(HttpStatus.OK)
  move(
    @CurrentUser() user: User,
    @Param('cvId', cvIdPipe) cvId: string,
    @Param('itemId', itemIdPipe) itemId: string,
    @Body(new ZodValidationPipe(moveItemSchema)) body: MoveItem,
  ): Promise<CvView> {
    return this.items.move(user.id, cvId, itemId, body);
  }

  @Post('items/:experienceId/bullets')
  addBullet(
    @CurrentUser() user: User,
    @Param('cvId', cvIdPipe) cvId: string,
    @Param('experienceId', cvIdPipe) experienceId: string,
    @Body(new ZodValidationPipe(addBulletSchema)) body: AddBullet,
  ): Promise<CvView> {
    return this.items.addBullet(user.id, cvId, experienceId, body);
  }
}
