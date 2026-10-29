'use client';

import {
  type CvContent,
  type CvItem,
  type ItemSection,
  cvItemSchema,
  type CvView,
  cvViewSchema,
} from '@ai-cv-builder/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { ApiRequestError, apiDelete, apiPatch, apiPost } from './api';
import { queryKeys } from './query-keys';

/** The item's current `rev` in the cached document, or `undefined` once it is gone. */
export function itemRev(content: CvContent, itemId: string) {
  return findItem(content, itemId)?.rev;
}

function findItem(content: CvContent, itemId: string): CvItem | undefined {
  if (itemId === 'contact') return content.contact;
  if (itemId === 'summary') return content.summary;
  for (const experience of content.experience) {
    if (experience.id === itemId) return experience;
    const bullet = experience.bullets.find(({ id }) => id === itemId);
    if (bullet) return bullet;
  }
  return (
    content.education.find(({ id }) => id === itemId) ??
    content.skills.find(({ id }) => id === itemId)
  );
}

/** The document with one saved item put in its place; the rest is shared, not copied. */
export function replaceItem(content: CvContent, item: CvItem): CvContent {
  const swap = <Entry extends { id: string }>(list: Entry[], next: Entry) =>
    list.map((entry) => (entry.id === next.id ? next : entry));

  if ('fullName' in item) return { ...content, contact: item };
  if ('bullets' in item) {
    return { ...content, experience: swap(content.experience, item) };
  }
  if ('institution' in item) {
    return { ...content, education: swap(content.education, item) };
  }
  if ('name' in item) {
    return { ...content, skills: swap(content.skills, item) };
  }
  if ('id' in item) {
    return {
      ...content,
      experience: content.experience.map((experience) => ({
        ...experience,
        bullets: swap(experience.bullets, item),
      })),
    };
  }
  return { ...content, summary: item };
}

/**
 * An answer to an add / remove / move is built after the operation committed,
 * so a slower one can arrive after a newer item save. Where the cache already
 * holds a higher `rev` for an item, that one stays.
 */
export function keepNewer(cached: CvContent, next: CvContent): CvContent {
  const newest = <Entry extends { id: string; rev: number }>(
    before: Entry[],
    after: Entry[],
  ) =>
    after.map((entry) => {
      const old = before.find(({ id }) => id === entry.id);
      return old && old.rev > entry.rev ? old : entry;
    });
  const newer = <Entry extends { rev: number }>(old: Entry, entry: Entry) =>
    old.rev > entry.rev ? old : entry;

  return {
    contact: newer(cached.contact, next.contact),
    summary: newer(cached.summary, next.summary),
    experience: newest(cached.experience, next.experience).map((entry) => {
      const old = cached.experience.find(({ id }) => id === entry.id);
      return { ...entry, bullets: newest(old?.bullets ?? [], entry.bullets) };
    }),
    education: newest(cached.education, next.education),
    skills: newest(cached.skills, next.skills),
  };
}

export type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved' }
  /** Not saved; `retry` is set when trying again can help (not for a value the server rejected). */
  | { status: 'error'; message: string; retry?: () => void }
  /** Another device saved this item first; `current` is what it holds now. */
  | { status: 'conflict'; current: CvItem; mine: Record<string, unknown> };

/**
 * Autosave for one item: `save(fields)` sends one `PATCH` with the item's
 * current `rev`. Saves of one item run one after another, so two quick blurs
 * never race on the `rev`. Resolves `true` once saved; on failure the caller
 * keeps the user's text on screen.
 */
export function useItemSaver(cvId: string, itemId: string) {
  const queryClient = useQueryClient();
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const [state, setState] = useState<SaveState>({ status: 'idle' });
  // Bumped by "load latest": fields keyed by it drop what the user typed.
  const [epoch, setEpoch] = useState(0);
  const cvKey = queryKeys.cv(cvId);

  const save = useCallback(
    function save(fields: Record<string, unknown>): Promise<boolean> {
      setState({ status: 'saving' });
      const run = queue.current.then(async () => {
        const rev = itemRevInCache(queryClient.getQueryData(cvKey), itemId);
        if (rev === undefined) {
          setState({ status: 'error', message: 'This item no longer exists.' });
          return false;
        }
        try {
          const item = await apiPatch(
            `/api/cvs/${cvId}/items/${itemId}`,
            { rev, ...fields },
            cvItemSchema,
          );
          queryClient.setQueryData<CvView>(cvKey, (view) =>
            view?.content
              ? { ...view, content: replaceItem(view.content, item) }
              : view,
          );
          void queryClient.invalidateQueries({
            queryKey: queryKeys.cvs(),
            exact: true,
          });
          setState({ status: 'saved' });
          return true;
        } catch (error) {
          setState(failure(error, fields, () => void save(fields)));
          return false;
        }
      });
      queue.current = run;
      return run;
    },
    [cvId, cvKey, itemId, queryClient],
  );

  /** After a conflict: take the other device's version and drop the local drafts. */
  const loadLatest = useCallback(() => {
    if (state.status !== 'conflict') return;
    const { current } = state;
    queryClient.setQueryData<CvView>(cvKey, (view) =>
      view?.content
        ? { ...view, content: replaceItem(view.content, current) }
        : view,
    );
    setEpoch((value) => value + 1);
    setState({ status: 'idle' });
  }, [cvKey, queryClient, state]);

  return { state, save, loadLatest, epoch };
}

function itemRevInCache(view: CvView | undefined, itemId: string) {
  return view?.content ? itemRev(view.content, itemId) : undefined;
}

function failure(
  error: unknown,
  mine: Record<string, unknown>,
  retry: () => void,
): SaveState {
  if (error instanceof ApiRequestError) {
    if (error.error.code === 'item_conflict') {
      const current = cvItemSchema.safeParse(error.error.current);
      if (current.success) {
        return { status: 'conflict', current: current.data, mine };
      }
    }
    // A 4xx will answer the same again: show why instead of offering Retry.
    if (error.status < 500) {
      return {
        status: 'error',
        message: error.error.issues?.[0]?.message ?? error.message,
      };
    }
  }
  return { status: 'error', message: 'Couldn’t save', retry };
}

export type StructuralError = 'item_conflict' | 'version_conflict' | 'other';

/** What the editor tells the User when an add / remove / move did not go through. */
export const STRUCTURAL_MESSAGES: Record<StructuralError, string> = {
  item_conflict:
    'That item was changed on another device. The CV is refreshed; try again.',
  version_conflict:
    'The order was changed on another device. The CV is refreshed; try again.',
  other: 'That did not work. Check your connection and try again.',
};

function structuralError(error: unknown): StructuralError {
  const code = error instanceof ApiRequestError ? error.error.code : undefined;
  return code === 'item_conflict' || code === 'version_conflict'
    ? code
    : 'other';
}

/**
 * Add, remove and move: each answers with the whole CV, which replaces the
 * cached one (fields not yet saved live in the editor's own state, so they
 * survive). A conflict refetches, so the User sees what the other device did.
 */
export function useStructuralEdits(cvId: string) {
  const queryClient = useQueryClient();
  const cvKey = queryKeys.cv(cvId);
  // The latest outcome only: a later success clears an earlier failure.
  const [error, setError] = useState<StructuralError | null>(null);
  const options = {
    onMutate: () => setError(null),
    onSuccess: (view: CvView) => {
      queryClient.setQueryData<CvView>(cvKey, (cached) =>
        cached?.content && view.content
          ? { ...view, content: keepNewer(cached.content, view.content) }
          : view,
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.cvs(),
        exact: true,
      });
    },
    onError: (failed: unknown) => {
      setError(structuralError(failed));
      void queryClient.invalidateQueries({ queryKey: cvKey, exact: true });
    },
  };

  const addItem = useMutation({
    ...options,
    mutationFn: ({
      section,
      body = {},
    }: {
      section: ItemSection;
      /** `{ name }` for a skill; experience and education are added empty. */
      body?: { name: string } | Record<string, never>;
    }) =>
      apiPost(`/api/cvs/${cvId}/sections/${section}/items`, body, cvViewSchema),
  });
  const addBullet = useMutation({
    ...options,
    mutationFn: ({
      experienceId,
      text,
    }: {
      experienceId: string;
      text: string;
    }) =>
      apiPost(
        `/api/cvs/${cvId}/items/${experienceId}/bullets`,
        { text },
        cvViewSchema,
      ),
  });
  const removeItem = useMutation({
    ...options,
    // The `rev` is read when the request goes out: a blur that tapping Remove
    // just triggered may have saved the item a moment ago.
    mutationFn: ({ itemId }: { itemId: string }) => {
      const rev = itemRevInCache(queryClient.getQueryData(cvKey), itemId);
      if (rev === undefined) return Promise.reject(new Error('Item is gone'));
      return apiDelete(
        `/api/cvs/${cvId}/items/${itemId}?rev=${rev}`,
        cvViewSchema,
      );
    },
  });
  const moveItem = useMutation({
    ...options,
    mutationFn: ({
      itemId,
      direction,
      version,
    }: {
      itemId: string;
      direction: 'up' | 'down';
      version: number;
    }) =>
      apiPost(
        `/api/cvs/${cvId}/items/${itemId}/move`,
        { direction, version },
        cvViewSchema,
      ),
  });

  return {
    addItem,
    addBullet,
    removeItem,
    moveItem,
    error,
    busy:
      addItem.isPending ||
      addBullet.isPending ||
      removeItem.isPending ||
      moveItem.isPending,
  };
}
