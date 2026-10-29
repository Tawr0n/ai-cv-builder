'use client';

import { healthSchema } from '@ai-cv-builder/shared';
import { useEffect, useState } from 'react';
import { apiGet, ApiRequestError } from '@/lib/api';

type Status =
  { kind: 'checking' } | { kind: 'up' } | { kind: 'down'; reason: string };

/** Asks the API, through the `/api/*` rewrite, whether it and its database are up. */
export function ApiStatus() {
  const [status, setStatus] = useState<Status>({ kind: 'checking' });

  useEffect(() => {
    let active = true;
    apiGet('/api/health', healthSchema).then(
      () => active && setStatus({ kind: 'up' }),
      (error: unknown) =>
        active &&
        setStatus({
          kind: 'down',
          reason:
            error instanceof ApiRequestError
              ? error.error.code
              : 'api_unreachable',
        }),
    );
    return () => {
      active = false;
    };
  }, []);

  switch (status.kind) {
    case 'checking':
      return <p role="status">Checking the API…</p>;
    case 'up':
      return <p role="status">API and database are up.</p>;
    case 'down':
      return <p role="alert">The API is down ({status.reason}).</p>;
  }
}
