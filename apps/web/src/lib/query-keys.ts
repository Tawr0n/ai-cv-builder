/** Every TanStack Query key in the app, built here so invalidation can target a whole family. */
export const queryKeys = {
  health: () => ['health'] as const,
};
