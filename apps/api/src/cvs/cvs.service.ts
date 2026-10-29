import type { CvList } from '@ai-cv-builder/shared';
import { Injectable } from '@nestjs/common';

/**
 * Ownership rule: every method takes the `userId` of the caller and filters by
 * it; there is no lookup that works without one.
 */
@Injectable()
export class CvsService {
  list(_userId: string): Promise<CvList> {
    return Promise.resolve({ items: [] });
  }
}
