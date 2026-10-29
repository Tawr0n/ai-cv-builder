import { PDFDocument } from 'pdf-lib';

/** A valid PDF with `pages` blank pages. */
export async function pdfWithPages(pages: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage();
  return Buffer.from(await doc.save());
}

/** A PDF whose trailer declares encryption, which is all a reader checks before refusing it. */
export async function encryptedPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.addPage();
  doc.context.trailerInfo.Encrypt = doc.context.register(
    doc.context.obj({ Filter: 'Standard' }),
  );
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}

/** Starts like a PDF, then is not one. */
export function corruptPdf(): Buffer {
  return Buffer.from('%PDF-1.7\nthis is not really a pdf\n%%EOF');
}

/** A real PDF padded past `bytes` with a trailing comment, so only its size is wrong. */
export async function pdfLargerThan(bytes: number): Promise<Buffer> {
  const pdf = await pdfWithPages(1);
  return Buffer.concat([pdf, Buffer.alloc(bytes - pdf.length + 1, '%')]);
}
