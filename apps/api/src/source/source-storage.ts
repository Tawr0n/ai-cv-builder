import type { Prisma } from '../generated/prisma/client.js';

/** What the User provided to create a CV. Never changes once the CV exists. */
export type Source =
  | { kind: 'pdf'; fileName: string; bytes: Uint8Array }
  | { kind: 'text'; text: string };

/**
 * Where Sources live. Postgres today (bytes in their own table, so opening a
 * CV never loads them); moving PDFs to S3 means one new implementation.
 */
export abstract class SourceStorage {
  /** Joins the caller's transaction, so a CV never exists without its Source. */
  abstract put(
    tx: Prisma.TransactionClient,
    cvId: string,
    source: Source,
  ): Promise<void>;

  /** `null` once the CV is gone. */
  abstract get(cvId: string): Promise<Source | null>;
}
