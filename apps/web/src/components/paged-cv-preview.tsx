'use client';

import { type CvDiff, CvTemplate } from '@ai-cv-builder/cv-template';
import type { CvContent } from '@ai-cv-builder/shared';
import { useEffect, useRef, useState } from 'react';

/**
 * What fits on an A4 page between the 14 mm top and 16 mm bottom margins, in
 * CSS px (96 per inch). Mirrors `@page` in cv-template's server.ts; the 180 mm
 * measuring width in globals.css is the same page's content width.
 */
const PAGE_CONTENT_PX = ((297 - 14 - 16) * 96) / 25.4;

const MM_PX = 96 / 25.4;
/** The sheet is laid out at a real A4 size and scaled to fit the pane. */
const PAGE_WIDTH_PX = 210 * MM_PX;
const PAGE_HEIGHT_PX = 297 * MM_PX;
const PAGE_TOP_PX = 14 * MM_PX;
/** Grey space between two sheets. */
const PAGE_GAP_PX = 24;

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
 * The on-screen preview drawn as whole A4 sheets: a short CV still fills one
 * full page, and a longer one is split by a grey gap labelled with the next
 * page number, before each row that is expected to start a new page of the
 * PDF (that row moves to the top of its sheet). The estimate comes from laying the same
 * template out off-screen in `pdf` mode at the printed width (180 mm); the PDF
 * stays authoritative. Re-measured after every change, resize and font load.
 * Items under review show `diff`; tapping one selects it.
 */
export function PagedCvPreview({
  content,
  diff,
  selected = null,
  onSelect,
}: {
  content: CvContent;
  diff?: CvDiff;
  selected?: string | null;
  onSelect?: (itemId: string) => void;
}) {
  const previewRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [marks, setMarks] = useState<{ top: number; page: number }[]>([]);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(PAGE_HEIGHT_PX);

  // Fit the A4 width to the pane (never enlarged past real size).
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const fit = () =>
      setScale(Math.min(1, frame.clientWidth / PAGE_WIDTH_PX) || 1);
    fit();
    const resize = new ResizeObserver(fit);
    resize.observe(frame);
    return () => resize.disconnect();
  }, []);

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
      // Lay the sheets out: each page start moves to the top of its own sheet.
      for (const row of shown) row.style.marginTop = '';
      const pages = starts.length + 1;
      const sheet = preview.querySelector<HTMLElement>(':scope > .cv');
      if (sheet) {
        sheet.style.boxSizing = 'border-box';
        sheet.style.minHeight = `${
          pages * PAGE_HEIGHT_PX + (pages - 1) * PAGE_GAP_PX
        }px`;
      }
      const next = starts.flatMap((index, page) => {
        const row = shown[index];
        if (!row) return [];
        const target =
          (page + 1) * (PAGE_HEIGHT_PX + PAGE_GAP_PX) + PAGE_TOP_PX;
        const base = parseFloat(getComputedStyle(row).marginTop) || 0;
        row.style.marginTop = `${Math.max(base, base + target - row.offsetTop)}px`;
        return [
          {
            top: (page + 1) * (PAGE_HEIGHT_PX + PAGE_GAP_PX) - PAGE_GAP_PX,
            page: page + 2,
          },
        ];
      });
      setHeight((current) =>
        current === preview.offsetHeight ? current : preview.offsetHeight,
      );
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

  useEffect(() => {
    for (const element of previewRef.current?.querySelectorAll<HTMLElement>(
      '[data-review-id]',
    ) ?? []) {
      element.classList.toggle(
        'cv-review-selected',
        element.dataset.reviewId === selected,
      );
    }
  }, [content, selected]);

  return (
    <div ref={frameRef} className="cv-frame" style={{ height: height * scale }}>
      <div
        ref={previewRef}
        className="cv-paged"
        style={{ width: PAGE_WIDTH_PX, transform: `scale(${scale})` }}
        onClick={(event) => {
          const reviewed = (event.target as HTMLElement).closest<HTMLElement>(
            '[data-review-id]',
          );
          if (reviewed?.dataset.reviewId) onSelect?.(reviewed.dataset.reviewId);
        }}
      >
        <CvTemplate content={content} mode="preview" diff={diff} />
        {marks.map(({ top, page }) => (
          <div
            key={page}
            className="cv-page-break"
            style={{ top, height: PAGE_GAP_PX }}
            aria-hidden="true"
          >
            <span>Page {page}</span>
          </div>
        ))}
        <div ref={measureRef} className="cv-measure" aria-hidden="true" inert>
          <CvTemplate content={content} mode="pdf" />
        </div>
      </div>
    </div>
  );
}
