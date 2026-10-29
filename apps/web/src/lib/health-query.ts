import { healthSchema } from '@ai-cv-builder/shared';
import { queryOptions } from '@tanstack/react-query';
import { apiGet } from './api';
import { queryKeys } from './query-keys';

export const healthQuery = () =>
  queryOptions({
    queryKey: queryKeys.health(),
    queryFn: () => apiGet('/api/health', healthSchema),
  });
