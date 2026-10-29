import type { CvContent } from '@ai-cv-builder/shared';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CvTemplate } from './cv-template.js';

const PACKAGE_ROOT = new URL('../', import.meta.url);

/** The subsets of Inter we bundle; `unicode-range` makes a page load only the ones its text uses. */
const SUBSETS = [
  {
    name: 'cyrillic',
    range: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116',
  },
  {
    name: 'latin',
    range:
      'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  },
];
const WEIGHTS = [400, 600, 700];

/** The stylesheet and the fonts never change while the process runs: read them once. */
let assets: { fontFaces: string; css: string } | undefined;

function loadAssets() {
  assets ??= {
    // Fonts travel inside the document as data URIs: the renderer blocks every request.
    fontFaces: SUBSETS.flatMap(({ name, range }) =>
      WEIGHTS.map((weight) => {
        const file = new URL(
          `fonts/inter-${name}-${weight}-normal.woff2`,
          PACKAGE_ROOT,
        );
        const data = readFileSync(file).toString('base64');
        return `@font-face{font-family:Inter;font-style:normal;font-weight:${weight};src:url(data:font/woff2;base64,${data}) format('woff2');unicode-range:${range}}`;
      }),
    ).join('\n'),
    css: readFileSync(new URL('cv.css', PACKAGE_ROOT), 'utf8'),
  };
  return assets;
}

/**
 * The CV as a complete, self-contained HTML document for printing: A4 pages
 * with 14/15/16 mm margins, the bundled Inter, no script, and nothing to fetch.
 * User text is escaped by React; the CSP is a second lock on the same door.
 */
export function renderCvHtml(content: CvContent): string {
  const { fontFaces, css } = loadAssets();
  const body = renderToStaticMarkup(
    createElement(CvTemplate, { content, mode: 'pdf' }),
  );
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:">
<title>CV</title>
<style>
${fontFaces}
@page{size:A4;margin:14mm 15mm 16mm}
html,body{margin:0;background:#fff}
${css}
</style>
</head>
<body>${body}</body>
</html>`;
}
