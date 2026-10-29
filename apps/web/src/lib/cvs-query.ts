import {
  createCvResponseSchema,
  cvListSchema,
  cvViewSchema,
  type Generation,
  generationSchema,
} from '@ai-cv-builder/shared';
import { mutationOptions, queryOptions } from '@tanstack/react-query';
import { apiDownload, apiGet, apiPost, apiPostForm } from './api';
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

/** Renders the CV on the server and hands the browser the PDF to save. */
export const downloadPdfMutation = (cvId: string) =>
  mutationOptions({
    mutationFn: async () => {
      const { blob, fileName } = await apiDownload(
        `/api/cvs/${cvId}/pdf`,
        'cv.pdf',
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      // Revoked at once, the browser may not have started reading the blob yet.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
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
