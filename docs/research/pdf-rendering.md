# A4 PDF rendering with selectable text in Docker

Research for [#4](https://github.com/Tawr0n/ai-cv-builder/issues/4). Checked 2026-10-28 against primary sources (official docs, doc sources in the projects' own repos, npm registry, container registries). This is a throwaway research note; the decision lives in the issue comment and the map (#1).

## TL;DR

Render the CV **server-side in the NestJS API** with **Playwright + Chromium headless shell** printing an HTML template (`page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true })`). One HTML/CSS template (rendered with React `renderToStaticMarkup`, which escapes user text) serves both the on-screen preview and the PDF. Bundle the CV font (e.g. a Cyrillic-capable TTF/WOFF2 via `@font-face`) so output does not depend on system fonts. Harden the page: JavaScript disabled, all network requests aborted, `setContent` instead of navigation.

`@react-pdf/renderer` is the runner-up: tiny image, in-process, but its own primitives (`View`/`Text`, Yoga flexbox) mean the preview cannot share the template unless the preview is the PDF itself.

## Current versions (npm registry, 2026-10-28)

| Package | Version | Notes |
|---|---|---|
| `playwright` / `playwright-core` | 1.64.1 | bundles Chromium 157.0.8103.15 (Chrome for Testing) and a separate headless shell, rev 1252 ([browsers.json](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/browsers.json)) |
| `puppeteer` / `puppeteer-core` | 25.16.0 | |
| `@react-pdf/renderer` | 4.9.0 | `"type": "module"` (ESM-only); depends on `pdfkit` 0.20.1 |
| `pdfmake` | 0.3.13 | depends on `pdfkit` ^0.20.2; `engines.node >= 20` |

## Comparison

| Criterion | Chromium (Playwright/Puppeteer) | `@react-pdf/renderer` | `pdfmake` | Client-side |
|---|---|---|---|---|
| Selectable text | Yes (real text, embedded fonts) | Yes (pdfkit embeds TTF/WOFF) | Yes (pdfkit) | `window.print()`: yes; html2canvas-style: **no** (raster) |
| Layout & page breaks | Full CSS: `@page { size: A4 }`, `break-inside: avoid`, `break-before`, grid/flex | Own engine: Yoga flexbox, `wrap`, `break`, `fixed`; no CSS grid | JSON doc definition; `pageBreak`, `pageBreakBefore(fn)` | `window.print()`: user's dialog controls margins/headers/paper |
| Unicode / Cyrillic | HarfBuzz shaping + per-glyph system font fallback; `--with-deps` installs Liberation, FreeFont, Unifont, Noto Color Emoji, `xfonts-cyrillic` | Only with a registered TTF/WOFF; built-in Helvetica/Times/Courier are the PDF standard 14 (no Cyrillic); no variable fonts; colour emoji only as images | Default Roboto must be supplied as files on server; standard 14 fonts "only ANSI code page (only english characters)" | Depends on the user's browser/fonts |
| Docker image | Official images ~984 MB (Playwright, 3 browsers) / ~803 MB (Puppeteer) compressed; DIY `node:22-bookworm-slim` + headless shell only: base 80 MB + 128 MB zip + apt deps | Plain Node image (~80 MB slim base) + a few MB of JS | Same as react-pdf | Nothing server-side |
| Startup | Browser launch per process (keep one browser, new context per job) | In-process, no external process | In-process | n/a |
| Memory | A separate browser process tree (order of 100+ MB; not measured, see below) | In-process, small | In-process, small | User's machine |
| Security (untrusted text) | Must escape HTML; disable JS; block network (SSRF via injected `<img>`/CSS); sandbox needs non-root + seccomp or `SYS_ADMIN` | No HTML/JS involved; text is just strings | Same as react-pdf | Not our server's problem, but no server-controlled output |
| Template shared with preview | **Yes**: same HTML/CSS in an iframe or as React component | Only if the preview *is* the PDF (`<PDFViewer>`/iframe of the PDF) | No | `window.print()` prints the preview itself |

## Findings per option

### Headless Chromium (Playwright / Puppeteer)

- **API.** `page.pdf()` "generates a pdf of the page with `print` css media"; options include `format` (A4 = 8.27in x 11.7in), `printBackground`, `margin`, `preferCSSPageSize`, `tagged` (accessible PDF, default `false`), `outline` (default `false`). Source: [Playwright `class-page.md`](https://github.com/microsoft/playwright/blob/main/docs/src/api/class-page.md) (Page.pdf). Puppeteer's [PDFOptions](https://pptr.dev/api/puppeteer.pdfoptions) has the same shape with `tagged: true` and `waitForFonts: true` by default, `format: 'letter'` default, 30 s timeout.
- **Defaults to override.** Paper defaults to Letter in both; colours are print-adjusted unless `-webkit-print-color-adjust: exact` / `printBackground`. Use CSS `@page { size: A4; margin: … }` plus `preferCSSPageSize: true` so the template owns page geometry.
- **Official images.** Playwright: `mcr.microsoft.com/playwright:v1.64.1-noble` (also `-jammy`; Ubuntu based). "This image includes the Playwright browsers and browser system dependencies", but not the npm package. Alpine/musl "not supported". Recommended flags: `--init`, `--ipc=host` for Chromium ("Without it, Chromium can run out of memory and crash"). The docs say the image "is not recommended to use … to visit untrusted websites" and recommend a non-root user + their seccomp profile for untrusted content. Source: [playwright.dev/docs/docker](https://playwright.dev/docs/docker). Puppeteer: `ghcr.io/puppeteer/puppeteer:<version>`, "includes Chrome for Testing along with the required dependencies", run with `--init --cap-add=SYS_ADMIN`. Source: [pptr.dev/guides/docker](https://pptr.dev/guides/docker).
- **Measured image sizes** (amd64, sum of compressed layers via `docker manifest inspect -v`): `mcr.microsoft.com/playwright:v1.64.1-noble` 984 MB; `ghcr.io/puppeteer/puppeteer:25.16.0` 803 MB; `node:22-bookworm-slim` 80 MB; `node:22-alpine` 61 MB (unusable for Chromium).
- **Slimmer DIY image.** Playwright ships a separate [chromium headless shell](https://developer.chrome.com/blog/chrome-headless-shell) for headless mode; "you can avoid downloading the full Chromium browser by passing `--only-shell`" (`npx playwright install --with-deps --only-shell chromium`). Source: [Playwright `browsers.md`](https://github.com/microsoft/playwright/blob/main/docs/src/browsers.md). The Chrome for Testing headless shell zip for 157.0.8103.15 linux64 is 127.8 MB vs 203.0 MB for full Chrome (HTTP `Content-Length` from `storage.googleapis.com/chrome-for-testing-public`). So: `FROM node:22-bookworm-slim` + `npm i playwright` + `npx playwright install --with-deps --only-shell chromium` in the API image; no Firefox/WebKit.
- **Fonts.** `--with-deps` on Debian 12 / Ubuntu 24.04 installs `fonts-liberation`, `fonts-freefont-ttf`, `fonts-unifont`, `fonts-noto-color-emoji`, `fonts-ipafont-gothic`, `fonts-wqy-zenhei`, `fonts-tlwg-loma-otf` (Ubuntu also `xfonts-cyrillic`). Source: [`nativeDeps.ts`](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/server/registry/nativeDeps.ts). Chromium falls back per glyph across installed fonts, so mixed Ukrainian/Latin/emoji text always renders something. For deterministic typography still ship the template's own font file via `@font-face` (local file or data URI, since network will be blocked).
- **Security.** Puppeteer troubleshooting: "Running without a sandbox is strongly discouraged … If you absolutely trust the content you open in Chrome, you can launch Chrome with the --no-sandbox argument"; their Docker example runs as non-root `pptruser`. Source: [pptr.dev/troubleshooting](https://pptr.dev/troubleshooting). Playwright: the default root user disables the sandbox; use a separate user + seccomp for untrusted content ([docker docs](https://playwright.dev/docs/docker)). Our content is not an arbitrary website but our own template with untrusted *text*, so the layered mitigation is: (1) escape all user text when building HTML (React `renderToStaticMarkup` escapes by default; never `dangerouslySetInnerHTML`); (2) `browser.newContext({ javaScriptEnabled: false })`; (3) `page.route('**/*', r => r.abort())` so nothing can be fetched (no SSRF to `postgres:5432` or metadata endpoints); (4) `page.setContent(html)` rather than navigating to the web app; (5) run the container as non-root, ideally with the sandbox on.
- **Read-only filesystems.** Chrome writes profile/cache at startup; set `XDG_CONFIG_HOME`/`XDG_CACHE_HOME` or a `userDataDir` ([pptr.dev/troubleshooting](https://pptr.dev/troubleshooting)).
- **Playwright vs Puppeteer.** Equivalent for `page.pdf`. Playwright wins on Docker ergonomics: `--with-deps --only-shell chromium` installs exactly the Chromium shell and its apt dependencies in one command; Puppeteer downloads Chrome on `npm install` but leaves system libraries to you (or to its ~800 MB image).

### `@react-pdf/renderer`

- **Node API.** `renderToBuffer`, `renderToStream`, `renderToFile`, `renderToString`. Source: [docs/node.md](https://github.com/diegomura/react-pdf-site/blob/master/docs/node.md).
- **Layout.** Own primitives (`Document`, `Page`, `View`, `Text`, `Image`, `Link`); layout by Yoga (flexbox); valid units include `pt`, `%`, `vw`/`vh`, `in`, `mm`, `cm`. Page wrapping is on by default; `wrap={false}` makes an element unbreakable, `break` forces a new page, `fixed` repeats on every page (headers/footers). Sources: [docs/page-wrapping.md](https://github.com/diegomura/react-pdf-site/blob/master/docs/page-wrapping.md), [docs/styling.md](https://github.com/diegomura/react-pdf-site/blob/master/docs/styling.md).
- **Fonts.** "Only TTF and WOFF fonts files are supported"; "OpenType Variable fonts … does not work properly", register static weights. Built-ins are Courier/Helvetica/Times-Roman (the PDF standard 14, which use a Latin single-byte encoding, so Cyrillic needs a registered font). Colour emoji are only possible as images from a CDN (`Font.registerEmojiSource`), which we would block. Hyphenation defaults to en-us. Source: [docs/fonts.md](https://github.com/diegomura/react-pdf-site/blob/master/docs/fonts.md).
- **Compatibility.** React 16.8 to 19 (19 since v4.1.0); docs say tested on Node 18/20/21 (stale page). Next.js App Router crashed before 14.1.1. ESM-only package; NestJS compiles to CommonJS by default, so it relies on Node's `require(esm)` (Node 20.19+/22.12+) or a dynamic `import()`. Source: [docs/compatibility.md](https://github.com/diegomura/react-pdf-site/blob/master/docs/compatibility.md), npm metadata.
- **Preview sharing.** The template is not HTML, so the on-screen preview must either be a separate HTML component (two templates to keep in sync) or render the PDF itself in the browser (`<PDFViewer>` / iframe of the API's PDF).

### `pdfmake`

- **Node usage (0.3).** Fonts are registered as TTF file paths (`pdfmake.addFonts({ Roboto: { normal: 'fonts/Roboto-Regular.ttf', … } })`), then `createPdf(docDefinition)` and `write()`. Source: [pdfmake docs, server-side](https://pdfmake.github.io/docs/0.3/getting-started/server-side/).
- **Fonts.** Standard 14 fonts: "This fonts supports only ANSI code page (only english characters)!" Source: [Standard 14 fonts](https://pdfmake.github.io/docs/0.3/fonts/standard-14-fonts/). So Cyrillic needs an embedded TTF, same as react-pdf.
- **Layout.** `pageSize: 'A4'`, `pageMargins`, `pageBreak: 'before'|'after'`, `pageBreakBefore(currentNode, followingNodesOnPage, …)` callback to avoid orphaned headings. Source: [Page](https://pdfmake.github.io/docs/0.3/document-definition-object/page/). Layout is a declarative JSON tree (columns, stacks, tables), the least expressive of the three for a designed CV and with no template sharing with a React preview.

### Client-side generation

- `window.print()` with print CSS gives selectable text, but margins, headers/footers, scale and paper size are in the user's print dialog, and output differs per browser. Not a reliable "Download PDF".
- Canvas-based libraries (html2canvas + jsPDF) produce **images**, failing the selectable-text requirement.
- `@react-pdf/renderer` in the browser works but ships the layout engine and fonts to the client, and puts PDF generation in the UI app, which the map defines as "UI only, no business logic". A server endpoint is also easier to test (Supertest + text extraction) and gives identical output for every user.

## Not verified

- **No hands-on measurement.** I tried to build a `node:22-bookworm-slim` + Playwright headless-shell image to measure final image size, launch time, RSS and Cyrillic text extraction, but the Docker daemon was not running in this environment. Image sizes above are registry-reported compressed sizes; the headless-shell figure is the zip size. Memory/startup figures are qualitative. A 15-minute spike at implementation time (render a Ukrainian CV, `pdftotext` it, check `docker image ls`) would close this.
- Whether react-pdf v4 supports per-glyph font fallback via a `fontFamily` array was not confirmed in the docs; assume a single font must cover all expected glyphs.

## Recommendation

1. **Server-side, in the NestJS API**: `GET /cvs/:id/pdf` returns `application/pdf`; Next.js proxies it via the existing `/api/*` rewrite.
2. **Engine**: `playwright` (Chromium headless shell only). API Dockerfile `FROM node:22-bookworm-slim`, `npx playwright install --with-deps --only-shell chromium`, run as non-root; compose service gets `init: true` and `ipc: host` (or a larger `shm_size`).
3. **One template**: a React component rendered to static HTML on the API (`react-dom/server`), styled with print CSS (`@page { size: A4; margin: 16mm }`, `break-inside: avoid` on entries). The same HTML is served for the on-screen preview (iframe) so preview and PDF match.
4. **Fonts**: bundle a static Cyrillic-capable font (e.g. a Noto Sans/Inter TTF/WOFF2, regular + bold) and reference it with `@font-face`; system fonts from `--with-deps` stay as fallback.
5. **Hardening**: escape text, `javaScriptEnabled: false`, abort every request, `setContent`, one long-lived browser with a fresh context per render, a render timeout, and close contexts in `finally`.
6. **Fallback if image size or Chromium flakiness becomes a problem**: `@react-pdf/renderer` with a registered TTF, preview = the PDF in an iframe.
