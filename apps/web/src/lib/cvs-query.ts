import {
  createCvResponseSchema,
  cvListSchema,
  cvViewSchema,
  type Generation,
  generationSchema,
  questionListSchema,
} from '@ai-cv-builder/shared';
import { mutationOptions, queryOptions } from '@tanstack/react-query';
import { apiGet, apiPost, apiPostForm } from './api';
import { queryKeys } from './query-keys';

/** How often a page polls while something generates (the API suggests 1–2 s). */
const POLL_MS = 1500;

export const isFinished = (generation: Generation) =>
  generation.status === 'succeeded' || generation.status === 'failed';

/** The signed-in User's CVs; refreshes itself while any of them is generating. */
export const cvsQuery = () =>
  queryOptions({
    queryKey: queryKeys.cvs(),
    queryFn: () => apiGet('/api/cvs', cvListSchema),
    refetchInterval: (query) =>
      query.state.data?.items.some((cv) => cv.status === 'generating')
        ? POLL_MS
        : false,
  });

export const cvQuery = (cvId: string) =>
  queryOptions({
    queryKey: queryKeys.cv(cvId),
    queryFn: () => apiGet(`/api/cvs/${cvId}`, cvViewSchema),
  });

/** The CV's latest Generation, polled until it succeeds or fails. */
export const generationQuery = (cvId: string) =>
  queryOptions({
    queryKey: queryKeys.generation(cvId),
    queryFn: () => apiGet(`/api/cvs/${cvId}/generation`, generationSchema),
    staleTime: 0,
    refetchInterval: (query) => {
      const generation = query.state.data;
      return generation && isFinished(generation) ? false : POLL_MS;
    },
  });

/** The CV's Questions, most important first; they exist once a Generation succeeds. */
export const questionsQuery = (cvId: string) =>
  queryOptions({
    queryKey: queryKeys.questions(cvId),
    queryFn: () => apiGet(`/api/cvs/${cvId}/questions`, questionListSchema),
  });

export interface CreateCvInput {
  targetRole: string;
  source: { kind: 'pdf'; file: File } | { kind: 'text'; text: string };
  /** Minted once per opened form, so a repeated submit cannot create a second CV. */
  idempotencyKey: string;
}

export const createCvMutation = () =>
  mutationOptions({
    mutationFn: ({ targetRole, source, idempotencyKey }: CreateCvInput) => {
      const form = new FormData();
      form.set('targetRole', targetRole);
      if (source.kind === 'pdf') form.set('file', source.file);
      else form.set('text', source.text);
      return apiPostForm(
        '/api/cvs',
        form,
        { 'idempotency-key': idempotencyKey },
        createCvResponseSchema,
      );
    },
  });

/** Try again after a failed Generation. */
export const retryGenerationMutation = (cvId: string) =>
  mutationOptions({
    mutationFn: () =>
      apiPost(
        `/api/cvs/${cvId}/generations`,
        { kind: 'initial' },
        generationSchema,
      ),
  });
