import type { CvContent } from '@ai-cv-builder/shared';
import { renderCvHtml } from '@ai-cv-builder/cv-template/server';
import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
} from '@nestjs/common';
import { type Browser, chromium } from 'playwright';
import { ENV, type Env } from '../env/env.js';
import { ApiException } from '../http/api.exception.js';

/** Runs at most `limit` tasks at once; the rest wait their turn. */
class Semaphore {
  private free: number;
  private readonly waiting: (() => void)[] = [];

  constructor(limit: number) {
    this.free = limit;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.free > 0) this.free -= 1;
    else await new Promise<void>((resolve) => this.waiting.push(resolve));
    try {
      return await task();
    } finally {
      // Hand the slot straight to the next waiter, or give it back.
      const next = this.waiting.shift();
      if (next) next();
      else this.free += 1;
    }
  }
}

/**
 * Prints CV content to an A4 PDF with headless Chromium. One browser lives for
 * the whole process; each render gets its own context. Chromium only ever sees
 * a document we built: JavaScript is off and every request is aborted, so user
 * text cannot run code or reach the network (see the trade-off on the sandbox).
 */
@Injectable()
export class PdfRenderer implements OnModuleDestroy {
  private readonly logger = new Logger(PdfRenderer.name);
  private readonly slots: Semaphore;
  private browser: Promise<Browser> | undefined;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.slots = new Semaphore(env.PDF_RENDER_CONCURRENCY);
  }

  /** Any failure, the timeout included, is `503 pdf_render_failed`. */
  async render(content: CvContent): Promise<Buffer> {
    const html = renderCvHtml(content);
    try {
      return await this.slots.run(() => this.print(html));
    } catch (error) {
      this.logger.error('PDF render failed', error);
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'pdf_render_failed',
        'Could not render the PDF. Try again.',
      );
    }
  }

  async onModuleDestroy() {
    const browser = await this.browser?.catch(() => undefined);
    await browser?.close();
  }

  private async print(html: string): Promise<Buffer> {
    const timeout = this.env.PDF_RENDER_TIMEOUT_MS;
    let timer: NodeJS.Timeout | undefined;
    const timedOut = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`PDF render timed out after ${timeout} ms`)),
        timeout,
      );
    });

    const work = (async () => {
      const browser = await this.launched();
      const context = await browser.newContext({ javaScriptEnabled: false });
      try {
        await context.route('**/*', (route) => route.abort());
        const page = await context.newPage();
        // The document goes in as a string: Chromium never navigates anywhere.
        await page.setContent(html, { waitUntil: 'load', timeout });
        return await page.pdf({
          format: 'A4',
          preferCSSPageSize: true,
          printBackground: true,
        });
      } finally {
        await context.close().catch(() => undefined);
      }
    })();
    // If the timeout wins, `work` may still fail later: nobody is listening any more.
    work.catch(() => undefined);

    try {
      return await Promise.race([work, timedOut]);
    } finally {
      clearTimeout(timer);
    }
  }

  /** The shared browser, started on first use and again after it has died. */
  private launched(): Promise<Browser> {
    this.browser ??= chromium
      .launch({ executablePath: this.env.CHROMIUM_EXECUTABLE_PATH })
      .then((browser) => {
        browser.on('disconnected', () => {
          this.browser = undefined;
        });
        return browser;
      })
      .catch((error: unknown) => {
        this.browser = undefined;
        throw error;
      });
    return this.browser;
  }
}
