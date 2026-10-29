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
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { cardId, CvEditor } from '@/components/cv-editor';
import { PagedCvPreview } from '@/components/paged-cv-preview';
import { QuestionsInbox, type UpdateCv } from '@/components/questions-inbox';
import { anchorElementIds, anchorItemId, reviewedItems } from '@/lib/anchors';
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

/** Phones get bottom tabs; from this width the CV and its editor sit side by side. */
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

/**
 * PROTOTYPE: three desktop layouts of the same workspace, picked with
 * `?variant=A|B|C` and switched from a bar that exists only in development.
 */
const VARIANTS = {
  A: 'Split editor',
  B: 'Canvas + inspector',
  C: 'Copilot',
} as const;
type Variant = keyof typeof VARIANTS;

const VARIANT_EVENT = 'cv-variant';

function readVariant(): Variant {
  const asked = new URLSearchParams(window.location.search)
    .get('variant')
    ?.toUpperCase();
  return asked && asked in VARIANTS ? (asked as Variant) : 'A';
}

function useVariant(): [Variant, (next: Variant) => void] {
  const variant = useSyncExternalStore(
    (notify) => {
      window.addEventListener(VARIANT_EVENT, notify);
      window.addEventListener('popstate', notify);
      return () => {
        window.removeEventListener(VARIANT_EVENT, notify);
        window.removeEventListener('popstate', notify);
      };
    },
    readVariant,
    () => 'A' as Variant,
  );
  const set = (next: Variant) => {
    const url = new URL(window.location.href);
    url.searchParams.set('variant', next);
    window.history.replaceState(null, '', url);
    window.dispatchEvent(new Event(VARIANT_EVENT));
  };
  return [variant, set];
}

function VariantSwitcher({
  variant,
  onChange,
}: {
  variant: Variant;
  onChange: (next: Variant) => void;
}) {
  const keys = Object.keys(VARIANTS) as Variant[];
  const cycle = (by: number) =>
    onChange(keys[(keys.indexOf(variant) + by + keys.length) % keys.length]!);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if ((event.target as HTMLElement).closest('input, textarea, select')) {
        return;
      }
      cycle(event.key === 'ArrowRight' ? 1 : -1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div className="variant-switcher" role="group" aria-label="Layout variant">
      <button
        type="button"
        aria-label="Previous variant"
        onClick={() => cycle(-1)}
      >
        ‹
      </button>
      <span>
        <strong>{variant}</strong> · {VARIANTS[variant]}
      </span>
      <button type="button" aria-label="Next variant" onClick={() => cycle(1)}>
        ›
      </button>
    </div>
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
 * desktop the same pieces sit side by side in the layout `?variant=` names.
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
  const [variant, setVariant] = useVariant();
  const [tab, setTab] = useState<Tab>('cv');
  const [pane, setPane] = useState<Pane>('edit');
  const [located, setLocated] = useState<Anchor | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  // The part being edited next to (B) or over (C) the preview.
  const [picked, setPicked] = useState<string | null>(null);
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

  // Variant A: a click on the preview scrolls the editor to that card.
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
  const editor = (only?: string) => (
    <CvEditor
      cvId={cvId}
      content={content}
      version={version}
      questions={questions}
      onReview={review}
      only={only}
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

  let layout;
  if (variant === 'A') {
    // Split editor: the form on the left, the live paper on the right.
    layout = (
      <div className="dw dw-a">
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
  } else if (variant === 'B') {
    // Canvas + inspector: an outline, the paper, and the part you picked.
    const count = (id: string, section?: Anchor['section']) =>
      questions.filter(
        (question) =>
          isActive(question) &&
          (anchorItemId(question.anchor, content) ??
            question.anchor.section) === (id ?? section),
      ).length;
    const entry = (
      id: string,
      title: string,
      sub: string | null,
      under: boolean,
      edited: boolean,
    ) => (
      <button
        key={id}
        type="button"
        className="outline-item"
        aria-pressed={picked === id}
        onClick={() => {
          setPicked(id);
          setPane('edit');
          if (under) setReviewing(id);
        }}
      >
        <span className="outline-text">
          <strong>{title}</strong>
          {sub && <small>{sub}</small>}
        </span>
        {count(id) > 0 && <span className="dot dot-q">❓{count(id)}</span>}
        {under && <span className="dot dot-ai">✨</span>}
        {edited && <span className="dot dot-edit">✎</span>}
      </button>
    );
    layout = (
      <div className="dw dw-b">
        <nav className="dw-pane dw-rail" aria-label="CV outline">
          <h2>Basics</h2>
          {entry(
            'contact',
            'Contact',
            content.contact.fullName,
            Boolean(content.contact.review),
            content.contact.edited,
          )}
          {entry(
            'summary',
            'Summary',
            null,
            Boolean(content.summary.review),
            content.summary.edited,
          )}
          <h2>Experience</h2>
          {content.experience.map((item) =>
            entry(
              item.id,
              item.title ?? 'New experience',
              item.organization,
              Boolean(item.review),
              item.edited,
            ),
          )}
          <button
            type="button"
            className="outline-add"
            onClick={() => setPicked('experience')}
          >
            + Add or reorder
          </button>
          <h2>Education</h2>
          {content.education.map((item) =>
            entry(
              item.id,
              item.degree ?? item.institution ?? 'New education',
              item.institution,
              Boolean(item.review),
              item.edited,
            ),
          )}
          <button
            type="button"
            className="outline-add"
            onClick={() => setPicked('education')}
          >
            + Add or reorder
          </button>
          <h2>Skills</h2>
          {entry(
            'skills',
            'Skills',
            `${content.skills.length} skills`,
            false,
            false,
          )}
        </nav>
        <section className="dw-pane dw-paper dw-canvas">
          {notice}
          {reviewBar}
          {preview((event) => {
            const target = editTarget(event.target as HTMLElement, content);
            if (!target || (event.target as HTMLElement).closest('a')) return;
            setPicked(target);
            setPane('edit');
          })}
        </section>
        <aside className="dw-pane dw-inspector">
          {paneTabs}
          {pane === 'questions' || !picked ? (
            <>
              {!picked && pane === 'edit' && (
                <p className="hint inspector-hint">
                  Click any part of the CV, or an entry on the left, to edit it
                  here.
                </p>
              )}
              {inbox}
            </>
          ) : (
            editor(picked)
          )}
        </aside>
      </div>
    );
  } else {
    // Copilot: the paper, and an assistant that asks and shows what it changed.
    const items = reviewedItems(content);
    layout = (
      <div className="dw dw-c">
        <section className="dw-pane dw-paper dw-canvas">
          {preview((event) => {
            const element = event.target as HTMLElement;
            if (element.closest('a, [data-review-id]')) return;
            setPicked(editTarget(element, content));
          })}
        </section>
        <aside className="dw-pane dw-copilot">
          <div className="copilot-head">
            <span className="copilot-avatar" aria-hidden="true">
              ✨
            </span>
            <div>
              <strong>CV assistant</strong>
              <p className="hint">
                I only use facts from you. Gaps become questions.
              </p>
            </div>
          </div>
          {notice}
          {items.length > 0 && (
            <div className="copilot-changes">
              <h2>Review my changes ({items.length})</h2>
              {reviewBar}
            </div>
          )}
          {inbox}
        </aside>
        <EditDialog
          title={
            picked === 'experience' || picked === 'education'
              ? `Edit ${picked}`
              : 'Edit'
          }
          open={picked !== null}
          onClose={() => setPicked(null)}
        >
          {picked && editor(picked)}
        </EditDialog>
      </div>
    );
  }

  return (
    <>
      {layout}
      {process.env.NODE_ENV !== 'production' && (
        <VariantSwitcher variant={variant} onChange={setVariant} />
      )}
    </>
  );
}

function EditDialog({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="edit-dialog"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="edit-dialog-head">
        <h2>{title}</h2>
        <button type="button" className="primary" onClick={onClose}>
          Done
        </button>
      </div>
      {children}
    </dialog>
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
