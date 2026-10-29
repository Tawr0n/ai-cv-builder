import { SESSION_COOKIE } from '@ai-cv-builder/shared';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Optimistic redirect before the page renders, so a visitor without a session
 * never sees a flash of the CV list. It only checks that the cookie exists; a
 * stale cookie still gets a 401 from the API, and the page handles that itself.
 * Auth pages are deliberately not redirected back: with a stale cookie that
 * would loop between `/` and `/login`.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  return NextResponse.redirect(new URL('/login', request.url));
}

// Only the pages behind log-in; `/api/*` is guarded by the API itself.
export const config = {
  matcher: ['/', '/cvs/:path*'],
};
