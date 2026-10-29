import { isServer, QueryClient } from '@tanstack/react-query';
import { ApiRequestError } from './api';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // A 4xx will not change on its own; retry only network errors and 5xx.
        retry: (failureCount, error) =>
          !(error instanceof ApiRequestError && error.status < 500) &&
          failureCount < 2,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * A fresh client per server render, one shared client in the browser (so a
 * suspending render does not throw the cache away).
 */
export function getQueryClient() {
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
