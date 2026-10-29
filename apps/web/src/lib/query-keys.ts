/** Every TanStack Query key in the app, built here so invalidation can target a whole family. */
export const queryKeys = {
  health: () => ['health'] as const,
  me: () => ['me'] as const,
  /** The CV list; also the prefix of every per-CV key, so invalidating it refreshes them all. */
  cvs: () => ['cvs'] as const,
  cv: (cvId: string) => [...queryKeys.cvs(), cvId] as const,
  generation: (cvId: string) => [...queryKeys.cv(cvId), 'generation'] as const,
  questions: (cvId: string) => [...queryKeys.cv(cvId), 'questions'] as const,
};
