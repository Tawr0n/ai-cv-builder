'use client';

import { useQuery } from '@tanstack/react-query';
import { ApiRequestError } from '@/lib/api';
import { healthQuery } from '@/lib/health-query';

/** Asks the API, through the `/api/*` rewrite, whether it and its database are up. */
export function ApiStatus() {
  const { status, error } = useQuery(healthQuery());

  switch (status) {
    case 'pending':
      return <p role="status">Checking the API…</p>;
    case 'success':
      return <p role="status">API and database are up.</p>;
    case 'error':
      return (
        <p role="alert">
          The API is down (
          {error instanceof ApiRequestError
            ? error.error.code
            : 'api_unreachable'}
          ).
        </p>
      );
  }
}
