import { HttpStatus } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import { ApiException } from '../http/api.exception.js';

const PDF_MAGIC = Buffer.from('%PDF-');

/**
 * Checks an uploaded PDF before any Generation exists. The client's
 * `Content-Type` and file name are ignored: only the bytes count. Scanned
 * (image-only) PDFs pass, since Claude reads every page as an image too.
 */
export async function assertReadablePdf(bytes: Buffer, maxPages: number) {
  if (!bytes.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
    throw new ApiException(
      HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      'not_a_pdf',
      'The file is not a PDF',
    );
  }

  let encrypted: boolean;
  let pages: number;
  try {
    // Loaded despite encryption so it can be told apart from corruption:
    // pdf-lib's own EncryptedPDFError fails `instanceof` (ES5 build).
    const doc = await PDFDocument.load(bytes, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    encrypted = doc.isEncrypted;
    // Walks the page tree, which is where a damaged file usually breaks.
    pages = doc.getPageCount();
  } catch {
    throw unprocessable('pdf_unreadable', 'The PDF could not be read');
  }
  if (encrypted) {
    throw unprocessable('pdf_encrypted', 'The PDF is password-protected');
  }
  // A PDF with no pages parsed but holds nothing to read.
  if (pages === 0) {
    throw unprocessable('pdf_unreadable', 'The PDF has no pages');
  }
  if (pages > maxPages) {
    throw unprocessable(
      'pdf_too_many_pages',
      `The PDF has ${pages} pages; at most ${maxPages} are allowed`,
    );
  }
}

function unprocessable(code: string, message: string) {
  return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, code, message);
}
