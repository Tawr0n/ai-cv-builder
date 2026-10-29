'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ApiRequestError } from './api';

/**
 * Sends the visitor to the log-in page once `error` says their session is
 * gone (a stale cookie still reaches the page; the API answers 401). Returns
 * whether that is the case, so the page can say it is redirecting.
 */
export function useSignedOutRedirect(error: unknown): boolean {
  const router = useRouter();
  const signedOut = error instanceof ApiRequestError && error.status === 401;
  useEffect(() => {
    if (signedOut) router.replace('/login');
  }, [signedOut, router]);
  return signedOut;
}
