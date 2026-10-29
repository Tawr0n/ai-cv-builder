'use client';

import type {
  Anchor,
  CvContent,
  Generation,
  GenerationErrorCode,
  GenerationStep,
  Question,
} from '@ai-cv-builder/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CvTemplate } from '@/components/cv-template';
import { QuestionsInbox } from '@/components/questions-inbox';
import { anchorElementIds } from '@/lib/anchors';
import {
  cvQuery,
  generationQuery,
  isFinished,
  questionsQuery,
  retryGenerationMutation,
} from '@/lib/cvs-query';
import { queryKeys } from '@/lib/query-keys';
import { useSignedOutRedirect } from '@/lib/use-signed-out-redirect';

const STEPS: { step: GenerationStep; label: string }[] = [
  { step: 'extract', label: 'Reading your background' },
  { step: 'compose', label: 'Writing the CV for the role' },
  { step: 'judge', label: 'Checking every line against your facts' },
];

const FAILURE_MESSAGES: Record<GenerationErrorCode, string> = {
  ai_unavailable: 'The AI service is not available right now.',
  invalid_ai_output:
    'The AI wrote a CV that did not pass our checks, twice in a row.',
  unreadable_source:
    'We could not find anything about you in that file or text.',
  timed_out: 'The AI took too long to answer.',
  worker_lost: 'Generating stopped unexpectedly.',
  internal: 'Something went wrong on our side.',
};

/**
 * One CV: the step-driven loader while it generates, the failure with Try
 * again, then the read-only preview. Everything comes from the server, so a
 * reload or another device picks up exactly where the Generation is.
 */
export function CvPage({ cvId }: { cvId: string }) {
  const queryClient = useQueryClient();
  const generation = useQuery(generationQuery(cvId));
  const succeeded = generation.data?.status === 'succeeded';
  const cv = useQuery({ ...cvQuery(cvId), enabled: succeeded });
  const questions = useQuery({
    ...questionsQuery(cvId),
    enabled: succeeded,
  });
  const signedOut = useSignedOutRedirect(
    generation.error ?? cv.error ?? questions.error,
  );

  // The CV view (and the list's badge) change once, when the Generation ends.
  const finished = generation.data ? isFinished(generation.data) : false;
  useEffect(() => {
    if (finished) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.cvs(),
        exact: true,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.cv(cvId),
        exact: true,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.questions(cvId),
      });
    }
  }, [finished, cvId, queryClient]);

  const title = cv.data?.targetRole;
  const back = (
    <p>
      <Link href="/">← My CVs</Link>
    </p>
  );

  if (generation.isError || cv.isError || questions.isError) {
    return (
      <main>
        {back}
        {signedOut ? (
          <p role="status">Redirecting to log in…</p>
        ) : (
          <p role="alert">Could not load this CV.</p>
        )}
      </main>
    );
  }
  if (!generation.data) return <p role="status">Loading…</p>;

  if (generation.data.status === 'failed') {
    return (
      <main>
        {back}
        <GenerationFailed cvId={cvId} generation={generation.data} />
      </main>
    );
  }
  if (!succeeded) {
    return (
      <main>
        {back}
        <GenerationProgress generation={generation.data} />
      </main>
    );
  }
  if (!cv.data?.content || !questions.data) {
    return <p role="status">Loading…</p>;
  }

  return (
    <main className="wide">
      {back}
      {title && <p className="hint">CV for {title}</p>}
      <CvTabs content={cv.data.content} questions={questions.data.items} />
    </main>
  );
}

type Tab = 'cv' | 'questions';

/** The ready CV: the preview, and the Questions whose 📍 links lead back into it. */
function CvTabs({
  content,
  questions,
}: {
  content: CvContent;
  questions: Question[];
}) {
  const [tab, setTab] = useState<Tab>('cv');
  const [located, setLocated] = useState<Anchor | null>(null);
  const open = questions.filter((q) => q.status === 'open').length;

  // Runs once the CV tab has rendered the preview the link points into.
  useEffect(() => {
    if (tab !== 'cv' || !located) return;
    const element = anchorElementIds(located)
      .map((id) => document.getElementById(id))
      .find(Boolean);
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.classList.add('cv-located');
    const timer = setTimeout(
      () => element.classList.remove('cv-located'),
      2000,
    );
    return () => {
      clearTimeout(timer);
      element.classList.remove('cv-located');
    };
  }, [tab, located]);

  return (
    <>
      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'cv'}
          onClick={() => setTab('cv')}
        >
          CV
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'questions'}
          onClick={() => setTab('questions')}
        >
          Questions ({open})
        </button>
      </div>
      {tab === 'cv' ? (
        <CvTemplate content={content} mode="preview" />
      ) : (
        <QuestionsInbox
          questions={questions}
          content={content}
          onLocate={(anchor) => {
            setLocated(anchor);
            setTab('cv');
          }}
        />
      )}
    </>
  );
}

function GenerationProgress({ generation }: { generation: Generation }) {
  const current = STEPS.findIndex(({ step }) => step === generation.step);
  return (
    <section aria-live="polite">
      <h1>Generating your CV…</h1>
      <ol className="steps">
        {STEPS.map(({ step, label }, index) => {
          const state =
            current === -1 || index > current
              ? 'todo'
              : index === current
                ? 'doing'
                : 'done';
          return (
            <li key={step} className={`step step-${state}`}>
              {label}
              {state === 'doing' && '…'}
            </li>
          );
        })}
      </ol>
      <p className="hint">
        You can close or reload this page: it keeps generating.
      </p>
    </section>
  );
}

function GenerationFailed({
  cvId,
  generation,
}: {
  cvId: string;
  generation: Generation;
}) {
  const queryClient = useQueryClient();
  const retry = useMutation({
    ...retryGenerationMutation(cvId),
    onSuccess: (next) => {
      queryClient.setQueryData(queryKeys.generation(cvId), next);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.cvs(),
        exact: true,
      });
    },
  });
  const code = generation.errorCode ?? 'internal';

  return (
    <section>
      <h1>We could not generate this CV</h1>
      <p role="alert">{FAILURE_MESSAGES[code]}</p>
      <p className="hint">Error code: {code}</p>
      {code === 'unreadable_source' ? (
        <p>
          <Link href="/cvs/new">Create a CV from another file or text</Link>
        </p>
      ) : (
        <>
          {retry.isError && (
            <p role="alert">Could not start again. Try once more.</p>
          )}
          <button
            type="button"
            onClick={() => retry.mutate()}
            disabled={retry.isPending}
          >
            Try again
          </button>
        </>
      )}
    </section>
  );
}
