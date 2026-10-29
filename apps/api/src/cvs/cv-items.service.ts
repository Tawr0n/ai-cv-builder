import {
  type AddBullet,
  addEmptyItemSchema,
  addSkillSchema,
  type CvContent,
  cvContentSchema,
  type CvItem,
  type CvSection,
  type CvView,
  type MoveItem,
  type PatchItem,
} from '@ai-cv-builder/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { ApiException } from '../http/api.exception.js';
import { ZodValidationPipe } from '../http/zod-validation.pipe.js';
import {
  type AddResult,
  addBullet,
  addEducation,
  addExperience,
  addSkill,
  findItem,
  movableSection,
  moveWithin,
  patchItem,
  removeItem,
} from './cv-document.js';
import { CvsService } from './cvs.service.js';

/**
 * Hand edits of the CV document (ADR 0001): item operations that run under a
 * row lock on the CV, so two requests (or a request and the worker) never
 * interleave their read-modify-write. Same ownership rule as `CvsService`:
 * every method filters by the caller's `userId`; a foreign CV is a missing one.
 */
@Injectable()
export class CvItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cvs: CvsService,
  ) {}

  /** Changes fields of one item; `rev` must be the item's current one. Returns the item. */
  async patch(
    userId: string,
    cvId: string,
    itemId: string,
    { rev, ...fields }: PatchItem,
  ): Promise<CvItem> {
    return this.prisma.$transaction(async (tx) => {
      const { content } = await lockContent(tx, userId, cvId);
      const ref = findItem(content, itemId);
      if (!ref) throw itemNotFound();
      if (ref.item.rev !== rev) throw itemConflict(ref.item);

      const result = patchItem(ref, fields);
      if (!result.ok) {
        throw new ApiException(
          HttpStatus.BAD_REQUEST,
          'validation_failed',
          'Request validation failed',
          result.issues.map(({ path, message }) => ({
            path: path.map((key) =>
              typeof key === 'symbol' ? String(key) : key,
            ),
            message,
          })),
        );
      }
      await tx.cv.update({ where: { id: cvId }, data: { content } });
      return result.item;
    });
  }

  /** Appends an item to a section, with no `rev` (appending commutes). Returns the CV view. */
  async add(
    userId: string,
    cvId: string,
    section: CvSection,
    body: unknown,
  ): Promise<CvView> {
    await this.prisma.$transaction(async (tx) => {
      const { content } = await lockContent(tx, userId, cvId);
      let result: AddResult;
      if (section === 'experience') {
        new ZodValidationPipe(addEmptyItemSchema).transform(body);
        result = addExperience(content);
      } else if (section === 'education') {
        new ZodValidationPipe(addEmptyItemSchema).transform(body);
        result = addEducation(content);
      } else {
        const { name } = new ZodValidationPipe(addSkillSchema).transform(body);
        result = addSkill(content, name);
      }
      if (!result.ok) throw sectionFull();
      await tx.cv.update({ where: { id: cvId }, data: { content } });
    });
    return this.cvs.view(userId, cvId);
  }

  /**
   * Removes an item; `rev` must be the removed item's own. Moves the following
   * items up one place, so the CV `version` goes up. Returns the CV view.
   */
  async remove(
    userId: string,
    cvId: string,
    itemId: string,
    rev: number,
  ): Promise<CvView> {
    await this.prisma.$transaction(async (tx) => {
      const { content } = await lockContent(tx, userId, cvId);
      const ref = findItem(content, itemId);
      if (!ref) throw itemNotFound();
      if (ref.kind === 'contact' || ref.kind === 'summary') {
        throw fixedItem(`The ${ref.kind} cannot be removed`);
      }
      if (ref.item.rev !== rev) throw itemConflict(ref.item);

      removeItem(content, itemId);
      await tx.cv.update({
        where: { id: cvId },
        data: { content, version: { increment: 1 } },
      });
    });
    return this.cvs.view(userId, cvId);
  }

  /**
   * Moves an experience or education entry one place; `version` must be the
   * CV's current one, because the order is shared by every item of the section.
   * At either end nothing changes. Returns the CV view.
   */
  async move(
    userId: string,
    cvId: string,
    itemId: string,
    { direction, version }: MoveItem,
  ): Promise<CvView> {
    await this.prisma.$transaction(async (tx) => {
      const locked = await lockContent(tx, userId, cvId);
      const { content } = locked;
      const ref = findItem(content, itemId);
      if (!ref) throw itemNotFound();
      const section = movableSection(ref, content);
      if (!section) {
        throw fixedItem('Only experience and education can be moved');
      }
      if (locked.version !== version) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'version_conflict',
          'The order was changed since you loaded it',
          undefined,
          { order: section.map(({ id }) => id), version: locked.version },
        );
      }

      if (!moveWithin(section, itemId, direction)) return;
      await tx.cv.update({
        where: { id: cvId },
        data: { content, version: { increment: 1 } },
      });
    });
    return this.cvs.view(userId, cvId);
  }

  /** Appends a bullet to an experience, with no `rev`; the experience's `rev` stays. Returns the CV view. */
  async addBullet(
    userId: string,
    cvId: string,
    experienceId: string,
    { text }: AddBullet,
  ): Promise<CvView> {
    await this.prisma.$transaction(async (tx) => {
      const { content } = await lockContent(tx, userId, cvId);
      const result = addBullet(content, experienceId, text);
      if (!result) throw itemNotFound();
      if (!result.ok) throw sectionFull();
      await tx.cv.update({ where: { id: cvId }, data: { content } });
    });
    return this.cvs.view(userId, cvId);
  }
}

function sectionFull() {
  return new ApiException(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'limit_reached',
    'This section cannot hold more items',
  );
}

/** Locks the CV row (owner only) and returns its parsed content and `version`. */
async function lockContent(
  tx: Prisma.TransactionClient,
  userId: string,
  cvId: string,
): Promise<{ content: CvContent; version: number }> {
  const rows = await tx.$queryRaw<{ content: unknown; version: number }[]>`
    SELECT "content", "version" FROM "Cv"
    WHERE "id" = ${cvId}::uuid AND "ownerId" = ${userId}::uuid
    FOR UPDATE`;
  const [row] = rows;
  if (!row) {
    throw new ApiException(HttpStatus.NOT_FOUND, 'not_found', 'CV not found');
  }
  if (row.content === null) {
    throw new ApiException(
      HttpStatus.CONFLICT,
      'cv_not_ready',
      'This CV has no content yet',
    );
  }
  // Parsed on every read, too: the database does not know the document's shape.
  return {
    content: cvContentSchema.parse(row.content),
    version: row.version,
  };
}

/** `contact`, `summary`, skills and bullets have a fixed place or no removal: the request is wrong, not stale. */
function fixedItem(what: string) {
  return new ApiException(
    HttpStatus.BAD_REQUEST,
    'validation_failed',
    'Request validation failed',
    [{ path: ['itemId'], message: what }],
  );
}

function itemNotFound() {
  return new ApiException(HttpStatus.NOT_FOUND, 'not_found', 'Item not found');
}

function itemConflict(current: CvItem) {
  return new ApiException(
    HttpStatus.CONFLICT,
    'item_conflict',
    'This item was changed since you loaded it',
    undefined,
    { current },
  );
}
