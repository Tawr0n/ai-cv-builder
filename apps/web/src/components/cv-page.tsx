'use client';

import {
  type Generation,
  type GenerationStep,
  isPendingAnswer,
} from '@ai-cv-builder/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect } from 'react';
import { CvWorkspace, FAILURE_MESSAGES } from '@/components/cv-workspace';
import {
  cvQuery,
  downloadPdfMutation,
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

/**
 * One CV: the step-driven loader while it generates, the failure with Try
 * again, then the preview, the editor and the Questions. Everything comes from the server, so a
 * reload or another device picks up exactly where the Generation is.
 */
export function CvPage({ cvId }: { cvId: string }) {
  const queryClient = useQueryClient();
  const generation = useQuery(generationQuery(cvId));
  // An Update CV (answer Generation) runs over a CV that already has content.
  const hasContent =
    generation.data?.status === 'succeeded' ||
    generation.data?.kind === 'answer';
  const cv = useQuery({ ...cvQuery(cvId), enabled: hasContent });
  const questions = useQuery({
    ...questionsQuery(cvId),
    enabled: hasContent,
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

  if (generation.data.status === 'failed' && !hasContent) {
    return (
      <main>
        {back}
        <GenerationFailed cvId={cvId} generation={generation.data} />
      </main>
    );
  }
  if (!hasContent) {
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

  const pending = questions.data.items.filter(isPendingAnswer).length;
  return (
    <main className="workspace">
      <header className="ws-head">
        <Link href="/" className="ws-back">
          ‹ <span>My CVs</span>
        </Link>
        <h1>
          {title ?? 'Your CV'}
          <small>{cv.data.content.contact.fullName}</small>
        </h1>
        <DownloadPdfButton cvId={cvId} pending={pending} />
      </header>
      <CvWorkspace
        cvId={cvId}
        version={cv.data.version}
        content={cv.data.content}
        questions={questions.data.items}
        generation={generation.data}
      />
    </main>
  );
}

function DownloadPdfButton({
  cvId,
  pending,
}: {
  cvId: string;
  /** Answers not applied yet: the PDF does not have them. */
  pending: number;
}) {
  const download = useMutation(downloadPdfMutation(cvId));
  return (
    <div className="stack">
      <button
        type="button"
        onClick={() => download.mutate()}
        disabled={download.isPending}
        aria-label="Download PDF"
      >
        {download.isPending ? 'Preparing…' : '⬇ PDF'}
      </button>
      {pending > 0 && (
        <p className="hint">
          You have {pending} {pending === 1 ? 'answer' : 'answers'} not applied
          yet.
        </p>
      )}
      {download.isError && (
        <p role="alert" className="hint">
          Could not make the PDF. Try again.
        </p>
      )}
    </div>
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
