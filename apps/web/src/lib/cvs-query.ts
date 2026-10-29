import { cvListSchema } from '@ai-cv-builder/shared';
import { queryOptions } from '@tanstack/react-query';
import { apiGet } from './api';
import { queryKeys } from './query-keys';

export const cvsQuery = () =>
  queryOptions({
    queryKey: queryKeys.cvs(),
    queryFn: () => apiGet('/api/cvs', cvListSchema),
  });
