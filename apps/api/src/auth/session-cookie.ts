import type { Response } from 'express';

export const SESSION_COOKIE = 'sid';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const COOKIE_BASE = { httpOnly: true, sameSite: 'lax', path: '/' } as const;

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, { ...COOKIE_BASE, maxAge: SESSION_TTL_MS });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, COOKIE_BASE);
}
