'use client';

import {
  type Anchor,
  type CvContent,
  type CvView,
  type Generation,
  type GenerationErrorCode,
  type GenerationStep,
  isPendingAnswer,
  type Question,
} from '@ai-cv-builder/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CvEditor } from '@/components/cv-editor';
import { PagedCvPreview } from '@/components/paged-cv-preview';
import { QuestionsInbox, type UpdateCv } from '@/components/questions-inbox';
import { anchorElementIds, reviewedItems } from '@/lib/anchors';
import {
  cvQuery,
  downloadPdfMutation,
  generationQuery,
  isFinished,
  questionsQuery,
  retryGenerationMutation,
  reviewDecisionMutation,
  updateCvMutation,
} from '@/lib/cvs-query';
import { queryKeys } from '@/lib/query-keys';
import { useSignedOutRedirect } from '@/lib/use-signed-out-redirect';
import { wordDiff } from '@/lib/word-diff';

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

/** What the Update CV loader says on each step of an answer Generation. */
const UPDATE_STEPS: Partial<Record<GenerationStep, string>> = {
  compose: 'Working our magic on your CV…',
  judge: 'Double-checking every line against your answers…',
};

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
    <main className="wide">
      <div className="bar">
        {back}
        <DownloadPdfButton cvId={cvId} pending={pending} />
      </div>
      {title && <p className="hint">CV for {title}</p>}
      <CvTabs
        cvId={cvId}
        version={cv.data.version}
        content={cv.data.content}
        questions={questions.data.items}
        generation={generation.data}
      />
    </main>
  );
}

type Tab = 'cv' | 'edit' | 'questions';

/**
 * The ready CV: the preview (with the AI changes to review), the editor, and
 * the Questions whose 📍 links lead back into it and whose Answers Update CV
 * applies.
 */
function CvTabs({
  cvId,
  version,
  content,
  questions,
  generation,
}: {
  cvId: string;
  version: number;
  content: CvContent;
  questions: Question[];
  generation: Generation;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('cv');
  const [located, setLocated] = useState<Anchor | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  // Still to do: open Questions and Answers Update CV has not applied yet.
  const open = questions.filter(
    (q) => q.status === 'open' || isPendingAnswer(q),
  ).length;

  const isUpdate = generation.kind === 'answer';
  const running = isUpdate && !isFinished(generation);
  // "Updated" is said once, after an Update CV this page watched succeed.
  const [watched, setWatched] = useState(running);
  if (running && !watched) setWatched(true);
  const updated = watched && isUpdate && generation.status === 'succeeded';
  const failure =
    isUpdate && generation.status === 'failed'
      ? FAILURE_MESSAGES[generation.errorCode ?? 'internal']
      : null;
  const start = useMutation({
    ...updateCvMutation(cvId),
    onSuccess: (next) => {
      queryClient.setQueryData(queryKeys.generation(cvId), next);
      // Its Answers are locked now.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.questions(cvId),
      });
      setTab('cv');
    },
  });
  const update: UpdateCv = {
    running,
    failure: start.isError
      ? 'Could not start the update. Check your connection.'
      : failure,
    start: () => start.mutate(),
    starting: start.isPending,
  };

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
          aria-selected={tab === 'edit'}
          onClick={() => setTab('edit')}
        >
          Edit
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
        <>
          {running ? (
            <p className="update-loader" role="status" aria-live="polite">
              {UPDATE_STEPS[generation.step ?? 'compose'] ??
                UPDATE_STEPS.compose}
            </p>
          ) : failure ? (
            <div role="alert" className="update-error">
              <p>
                We could not update your CV. {failure} Your answers are kept.
              </p>
              <button
                type="button"
                onClick={() => start.mutate()}
                disabled={start.isPending}
              >
                Try again
              </button>
            </div>
          ) : (
            updated && (
              <p className="update-done" role="status">
                ✅ CV updated with your answers
              </p>
            )
          )}
          <ReviewBar
            cvId={cvId}
            content={content}
            selected={reviewing}
            onSelect={setReviewing}
          />
          <div className={running ? 'cv-updating' : undefined}>
            <PagedCvPreview
              content={content}
              diff={wordDiff}
              selected={reviewing}
              onSelect={setReviewing}
            />
          </div>
        </>
      ) : tab === 'edit' ? (
        <CvEditor
          cvId={cvId}
          content={content}
          version={version}
          questions={questions}
          onReview={(itemId) => {
            setReviewing(itemId);
            setTab('cv');
          }}
        />
      ) : (
        <QuestionsInbox
          cvId={cvId}
          questions={questions}
          content={content}
          update={update}
          onLocate={(anchor) => {
            setLocated(anchor);
            setTab('cv');
          }}
        />
      )}
    </>
  );
}

/**
 * "✨ AI change n of N" over the preview: steps through the items Update CV
 * changed, each with Undo and Accept, plus Accept all.
 */
function ReviewBar({
  cvId,
  content,
  selected,
  onSelect,
}: {
  cvId: string;
  content: CvContent;
  selected: string | null;
  onSelect: (itemId: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const decide = useMutation({
    ...reviewDecisionMutation(cvId),
    onSuccess: (view) =>
      queryClient.setQueryData<CvView>(queryKeys.cv(cvId), view),
    // A stale rev (another device): show the CV as it is now.
    onError: () =>
      void queryClient.invalidateQueries({
        queryKey: queryKeys.cv(cvId),
        exact: true,
      }),
    onSettled: (_view, _error, { decision }) => {
      if (decision === 'undo') {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.questions(cvId),
        });
      }
    },
  });
  const [acceptingAll, setAcceptingAll] = useState(false);
  const items = reviewedItems(content);
  const index = Math.max(
    0,
    items.findIndex(({ id }) => id === selected),
  );
  const current = items[index];

  // The selected change is scrolled into view.
  useEffect(() => {
    if (!selected) return;
    document
      .querySelector(`[data-review-id="${CSS.escape(selected)}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [selected]);

  if (!current) return null;
  const step = (by: number) =>
    onSelect(items[(index + by + items.length) % items.length]!.id);

  async function acceptAll() {
    setAcceptingAll(true);
    try {
      // One by one: each is an item operation on its own rev.
      for (const { id, rev } of items) {
        await decide.mutateAsync({ itemId: id, rev, decision: 'accept' });
      }
    } catch {
      // The failed one's refetch shows what is left to review.
    } finally {
      setAcceptingAll(false);
    }
  }

  const busy = decide.isPending || acceptingAll;
  return (
    <div className="review-bar" role="region" aria-label="AI changes">
      <p>
        ✨ AI change {index + 1} of {items.length}:{' '}
        <strong>{current.name}</strong>
      </p>
      <div className="review-actions">
        <button
          type="button"
          aria-label="Previous change"
          onClick={() => step(-1)}
          disabled={items.length < 2}
        >
          ‹
        </button>
        <button
          type="button"
          aria-label="Next change"
          onClick={() => step(1)}
          disabled={items.length < 2}
        >
          ›
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            decide.mutate({
              itemId: current.id,
              rev: current.rev,
              decision: 'undo',
            })
          }
        >
          ↶ Undo
        </button>
        <button
          type="button"
          className="primary"
          disabled={busy}
          onClick={() =>
            decide.mutate({
              itemId: current.id,
              rev: current.rev,
              decision: 'accept',
            })
          }
        >
          ✓ Accept
        </button>
        {items.length > 1 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void acceptAll()}
          >
            Accept all
          </button>
        )}
      </div>
      {decide.isError && (
        <p role="alert" className="hint">
          That did not go through; the CV is refreshed. Try again.
        </p>
      )}
    </div>
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
