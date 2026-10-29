'use client';

import { CvTemplate } from '@ai-cv-builder/cv-template';
import type { CvContent } from '@ai-cv-builder/shared';
import { useEffect, useRef, useState } from 'react';

/** What fits on an A4 page between the 14 mm top and 16 mm bottom margins, in CSS px (96 per inch). */
const PAGE_CONTENT_PX = ((297 - 14 - 16) * 96) / 25.4;

/**
 * The indexes of the rows that start a new page (page 2, 3, …) if the CV is
 * printed: rows are laid out one under another and, like Chromium does, a row
 * that would cross the bottom of the page moves to the top of the next one.
 */
export function pageStartRows(
  rows: { top: number; height: number }[],
  pageHeight = PAGE_CONTENT_PX,
): number[] {
  const starts: number[] = [];
  let pageTop = 0;
  rows.forEach(({ top, height }, index) => {
    if (top > pageTop && top + height - pageTop > pageHeight) {
      starts.push(index);
      pageTop = top;
    }
  });
  return starts;
}

/**
 * The on-screen preview with a labelled rule before each row that is expected
 * to start a new page of the PDF. The estimate comes from laying the same
 * template out off-screen in `pdf` mode at the printed width (180 mm); the PDF
 * stays authoritative. Re-measured after every change, resize and font load.
 */
export function PagedCvPreview({ content }: { content: CvContent }) {
  const previewRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [marks, setMarks] = useState<{ top: number; page: number }[]>([]);

  useEffect(() => {
    const preview = previewRef.current;
    const measure = measureRef.current;
    if (!preview || !measure) return;

    const update = () => {
      const printed = Array.from(
        measure.querySelectorAll<HTMLElement>('.cv-row'),
      );
      const shown = Array.from(
        preview.querySelectorAll<HTMLElement>(':scope > .cv .cv-row'),
      );
      const starts = pageStartRows(
        printed.map((row) => ({
          top: row.offsetTop,
          height: row.offsetHeight,
        })),
      );
      const next = starts.flatMap((index, page) => {
        const row = shown[index];
        return row ? [{ top: row.offsetTop - 6, page: page + 2 }] : [];
      });
      setMarks((current) =>
        current.length === next.length &&
        current.every((mark, i) => mark.top === next[i]?.top)
          ? current
          : next,
      );
    };

    update();
    void document.fonts.ready.then(update);
    document.fonts.addEventListener('loadingdone', update);
    const resize = new ResizeObserver(update);
    resize.observe(preview);
    return () => {
      document.fonts.removeEventListener('loadingdone', update);
      resize.disconnect();
    };
  }, [content]);

  return (
    <div ref={previewRef} className="cv-paged">
      <CvTemplate content={content} mode="preview" />
      {marks.map(({ top, page }) => (
        <div
          key={page}
          className="cv-page-break"
          style={{ top }}
          aria-hidden="true"
        >
          <span>Page {page}</span>
        </div>
      ))}
      <div ref={measureRef} className="cv-measure" aria-hidden="true" inert>
        <CvTemplate content={content} mode="pdf" />
      </div>
    </div>
  );
}
