import { type Login, type Signup, userSchema } from '@ai-cv-builder/shared';
import { mutationOptions, queryOptions } from '@tanstack/react-query';
import { apiGet, apiPost } from './api';
import { queryKeys } from './query-keys';

/** The signed-in User; a 401 means nobody is signed in. */
export const meQuery = () =>
  queryOptions({
    queryKey: queryKeys.me(),
    queryFn: () => apiGet('/api/auth/me', userSchema),
  });

export const signupMutation = () =>
  mutationOptions({
    mutationFn: (body: Signup) => apiPost('/api/auth/signup', body, userSchema),
  });

export const loginMutation = () =>
  mutationOptions({
    mutationFn: (body: Login) => apiPost('/api/auth/login', body, userSchema),
  });

export const logoutMutation = () =>
  mutationOptions({
    mutationFn: () => apiPost('/api/auth/logout'),
  });
