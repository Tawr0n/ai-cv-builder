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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  type MouseEvent,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import { cardId, CvEditor } from '@/components/cv-editor';
import { PagedCvPreview } from '@/components/paged-cv-preview';
import { QuestionsInbox, type UpdateCv } from '@/components/questions-inbox';
import { anchorElementIds, reviewedItems } from '@/lib/anchors';
import {
  isFinished,
  reviewDecisionMutation,
  updateCvMutation,
} from '@/lib/cvs-query';
import { queryKeys } from '@/lib/query-keys';
import { wordDiff } from '@/lib/word-diff';

export const FAILURE_MESSAGES: Record<GenerationErrorCode, string> = {
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

/** Phones get bottom tabs; from this width the editor and the CV sit side by side. */
const DESKTOP_QUERY = '(min-width: 900px)';

function useDesktop(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(DESKTOP_QUERY);
      query.addEventListener('change', notify);
      return () => query.removeEventListener('change', notify);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}

type Tab = 'cv' | 'edit' | 'questions';
type Pane = 'edit' | 'questions';

/** The part of the CV a click on the preview means: `contact`, a section, or an entry's id. */
function editTarget(element: HTMLElement, content: CvContent): string | null {
  const item = element.closest<HTMLElement>('[id^="cv-item-"]');
  if (item) {
    const id = item.id.slice('cv-item-'.length);
    const experience = content.experience.find(
      (entry) =>
        entry.id === id || entry.bullets.some((bullet) => bullet.id === id),
    );
    if (experience) return experience.id;
    if (content.education.some((entry) => entry.id === id)) return id;
    if (content.skills.some((skill) => skill.id === id)) return 'skills';
  }
  const section = element.closest<HTMLElement>('[id^="cv-section-"]');
  return section ? section.id.slice('cv-section-'.length) : null;
}

/** Open Questions and Answers Update CV has not applied yet. */
const isActive = (question: Question) =>
  question.status === 'open' || isPendingAnswer(question);

/**
 * The ready CV. On a phone: the CV, Edit and Questions as bottom tabs. On a
 * desktop the editor and Questions sit beside the live paper.
 * The 📍 links of Questions lead back into the preview and the Answers are
 * applied by Update CV.
 */
export function CvWorkspace({
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
  const desktop = useDesktop();
  const [tab, setTab] = useState<Tab>('cv');
  const [pane, setPane] = useState<Pane>('edit');
  const [located, setLocated] = useState<Anchor | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [scrollToCard, setScrollToCard] = useState<{ id: string } | null>(null);
  const open = questions.filter(isActive).length;

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

  const previewShown = desktop || tab === 'cv';
  // Runs once the preview the link points into is on screen.
  useEffect(() => {
    if (!previewShown || !located) return;
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
  }, [previewShown, located]);

  // A click on the preview scrolls the editor to that card.
  useEffect(() => {
    if (!scrollToCard || pane !== 'edit') return;
    document
      .getElementById(cardId(scrollToCard.id))
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [scrollToCard, pane]);

  const locate = (anchor: Anchor) => {
    setLocated(anchor);
    setTab('cv');
  };
  const review = (itemId: string) => {
    setReviewing(itemId);
    setTab('cv');
  };

  const notice = running ? (
    <p className="update-loader" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {UPDATE_STEPS[generation.step ?? 'compose'] ?? UPDATE_STEPS.compose}
    </p>
  ) : failure ? (
    <div role="alert" className="update-error">
      <p>We could not update your CV. {failure} Your answers are kept.</p>
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
  );

  const reviewBar = (
    <ReviewBar
      cvId={cvId}
      content={content}
      selected={reviewing}
      onSelect={setReviewing}
    />
  );
  const preview = (onClick?: (event: MouseEvent<HTMLDivElement>) => void) => (
    <div
      className={`cv-sheet${running ? ' cv-updating' : ''}`}
      onClick={onClick}
    >
      <PagedCvPreview
        content={content}
        diff={wordDiff}
        selected={reviewing}
        onSelect={setReviewing}
      />
    </div>
  );
  const editor = () => (
    <CvEditor
      cvId={cvId}
      content={content}
      version={version}
      questions={questions}
      onReview={review}
    />
  );
  const inbox = (
    <QuestionsInbox
      cvId={cvId}
      questions={questions}
      content={content}
      update={update}
      onLocate={locate}
    />
  );
  const paneTabs = (
    <div className="pane-tabs" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={pane === 'edit'}
        onClick={() => setPane('edit')}
      >
        ✎ Edit
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={pane === 'questions'}
        onClick={() => setPane('questions')}
      >
        Questions {open > 0 && <span className="count">{open}</span>}
      </button>
    </div>
  );

  if (!desktop) {
    return (
      <>
        {tab === 'cv' ? (
          <>
            {notice}
            {reviewBar}
            {preview()}
          </>
        ) : tab === 'edit' ? (
          editor()
        ) : (
          inbox
        )}
        <div className="tabs" role="tablist">
          {(
            [
              ['cv', '📄 CV'],
              ['edit', '✎ Edit'],
              ['questions', `❓ Questions${open ? ` (${open})` : ''}`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </>
    );
  }

  // Split editor: the form on the left, the live paper on the right.
  return (
    <div className="dw">
      <section className="dw-pane dw-form">
        {paneTabs}
        {pane === 'edit' ? editor() : inbox}
      </section>
      <section className="dw-pane dw-paper">
        {notice}
        {reviewBar}
        {preview((event) => {
          const target = editTarget(event.target as HTMLElement, content);
          if (!target || (event.target as HTMLElement).closest('a')) return;
          setPane('edit');
          const id =
            target === 'experience' || target === 'education'
              ? content[target][0]?.id
              : target;
          if (id) setScrollToCard({ id });
        })}
      </section>
    </div>
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
