import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { type Source, SourceStorage } from './source-storage.js';

/** {@link SourceStorage} in the `Source` table (PDF bytes as `bytea`). */
@Injectable()
export class PostgresSourceStorage extends SourceStorage {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async put(tx: Prisma.TransactionClient, cvId: string, source: Source) {
    await tx.source.create({
      data:
        source.kind === 'pdf'
          ? {
              cvId,
              kind: 'pdf',
              fileName: source.fileName,
              bytes: new Uint8Array(source.bytes),
            }
          : { cvId, kind: 'text', text: source.text },
    });
  }

  async get(cvId: string): Promise<Source | null> {
    const row = await this.prisma.source.findUnique({ where: { cvId } });
    if (!row) return null;
    // The table's CHECK guarantees the payload matching `kind` is there.
    return row.kind === 'pdf'
      ? {
          kind: 'pdf',
          fileName: row.fileName ?? 'source.pdf',
          bytes: row.bytes!,
        }
      : { kind: 'text', text: row.text! };
  }
}
