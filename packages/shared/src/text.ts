import { z } from 'zod';

// C0 controls except \t and \n, DEL and C1 controls; \r goes too, so CRLF becomes LF.
// oxlint-disable-next-line no-control-regex -- matching them is the point
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g;

/** Untrusted text as stored: NFC, control characters stripped (except tab and newline), trimmed. */
export function cleanText(value: string): string {
  return value.normalize('NFC').replace(CONTROL_CHARS, '').trim();
}

/** {@link cleanText}, then every run of whitespace (newlines included) folded into one space. */
export function cleanLine(value: string): string {
  return cleanText(value).replace(/\s+/g, ' ');
}

/** A cleaned multi-line string of `min`–`max` characters. */
export const textField = (min: number, max: number) =>
  z.string().transform(cleanText).pipe(z.string().min(min).max(max));

/** A cleaned single-line string of `min`–`max` characters. */
export const lineField = (min: number, max: number) =>
  z.string().transform(cleanLine).pipe(z.string().min(min).max(max));
