import { Prisma } from '../generated/prisma/client.js';

const PRISMA_UNIQUE_VIOLATION = 'P2002';

/** The write hit a unique constraint or unique index. */
export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === PRISMA_UNIQUE_VIOLATION
  );
}
