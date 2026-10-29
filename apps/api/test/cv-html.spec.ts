import { cvContentSchema } from '@ai-cv-builder/shared';
import { renderCvHtml } from '@ai-cv-builder/cv-template/server';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

const meta = { rev: 1, edited: false, sourceFactIds: [] as string[] };

function cv(fields: { summary?: string; link?: string }) {
  return cvContentSchema.parse({
    contact: {
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: null,
      location: null,
      links: fields.link ? [fields.link] : [],
      ...meta,
    },
    summary: { text: fields.summary ?? 'Engineer.', ...meta },
    experience: [
      {
        id: randomUUID(),
        organization: null,
        title: 'Engineer',
        startDate: null,
        endDate: null,
        location: null,
        bullets: [],
        ...meta,
      },
    ],
    education: [],
    skills: [],
  });
}

describe('the CV as printable HTML', () => {
  it('renders markup in a field as text', () => {
    const html = renderCvHtml(
      cv({ summary: '<script>alert(1)</script><b onclick="x()">hi</b>' }),
    );

    expect(html).not.toContain('<script');
    expect(html).not.toContain('<b ');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('makes only http(s) links clickable', () => {
    const risky = renderCvHtml(cv({ link: 'javascript:alert(1)' }));
    const safe = renderCvHtml(cv({ link: 'https://example.com/ada/' }));

    expect(risky).not.toContain('href=');
    expect(risky).toContain('javascript:alert(1)');
    expect(safe).toContain('href="https://example.com/ada/"');
  });

  it('leaves unknown fields out instead of printing placeholders', () => {
    const html = renderCvHtml(cv({}));
    const body = html.slice(html.indexOf('<body>'));

    expect(body).toContain('Engineer');
    expect(body).not.toContain('class="cv-meta"');
    expect(body).not.toContain('?');
  });

  it('carries its own fonts and asks for nothing from the network', () => {
    const html = renderCvHtml(cv({}));

    expect(html).toContain('font-family:Inter');
    expect(html).toMatch(/src:url\(data:font\/woff2;base64,/);
    expect(html).not.toMatch(/(?:src|href)=["']https?:/);
    expect(html).not.toMatch(/url\((?!data:)/);
  });
});
