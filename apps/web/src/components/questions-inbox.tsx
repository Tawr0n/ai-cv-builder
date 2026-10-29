'use client';

import {
  type Anchor,
  type CvContent,
  isPendingAnswer,
  type Question,
  type QuestionList,
  QUESTION_LIMITS,
} from '@ai-cv-builder/shared';
import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useId, useState } from 'react';
import { anchorLabel } from '@/lib/anchors';
import { ApiRequestError } from '@/lib/api';
import {
  answerQuestionMutation,
  questionStatusMutation,
} from '@/lib/cvs-query';
import { queryKeys } from '@/lib/query-keys';

/** What the inbox needs from the page about Update CV. */
export interface UpdateCv {
  /** An Update CV is running. */
  running: boolean;
  /** Why the last Update CV failed, in plain words; `null` when it did not. */
  failure: string | null;
  start: () => void;
  starting: boolean;
}

/**
 * The Questions, most important first: open ones and pending Answers on top,
 * each with a 📍 link to its Anchor, an answer field that saves when the User
 * leaves it, and "Not relevant". Applied, dismissed and obsolete ones fold
 * into "Resolved (n)". The sticky Update CV (n) applies every pending Answer.
 */
export function QuestionsInbox({
  cvId,
  questions,
  content,
  onLocate,
  update,
}: {
  cvId: string;
  questions: Question[];
  content: CvContent;
  onLocate: (anchor: Anchor) => void;
  update: UpdateCv;
}) {
  const active = questions.filter(
    (question) => question.status === 'open' || isPendingAnswer(question),
  );
  const resolved = questions.filter((question) => !active.includes(question));
  const pending = questions.filter(isPendingAnswer).length;
  // An Answer still saving must reach the server before Update CV takes them.
  const saving = useIsMutating({ mutationKey: ['answer', cvId] }) > 0;

  return (
    <section className="inbox">
      {active.length === 0 ? (
        <p className="hint">
          No open questions: everything in this CV rests on what you told us.
        </p>
      ) : (
        <>
          <p className="hint">
            Anything missing or vague in your background became a question here
            instead of a guess in your CV. Answer any of them, then tap Update
            CV.
          </p>
          <ol className="questions">
            {active.map((question) => (
              <QuestionCard
                key={question.id}
                cvId={cvId}
                question={question}
                content={content}
                onLocate={onLocate}
              />
            ))}
          </ol>
        </>
      )}

      {resolved.length > 0 && (
        <details className="resolved">
          <summary>Resolved ({resolved.length})</summary>
          <ol className="questions">
            {resolved.map((question) => (
              <ResolvedCard key={question.id} cvId={cvId} question={question} />
            ))}
          </ol>
        </details>
      )}

      <div className="update-bar">
        {update.failure && (
          <p role="alert" className="update-error">
            {update.failure} Your answers are kept.
          </p>
        )}
        <button
          type="button"
          className="primary"
          disabled={
            pending === 0 || update.running || update.starting || saving
          }
          onClick={update.start}
        >
          {update.running
            ? 'Updating your CV…'
            : update.failure
              ? `Try again (${pending})`
              : `Update CV (${pending})`}
        </button>
      </div>
    </section>
  );
}

type AnswerState = 'idle' | 'saving' | 'saved' | { error: string };

function QuestionCard({
  cvId,
  question,
  content,
  onLocate,
}: {
  cvId: string;
  question: Question;
  content: CvContent;
  onLocate: (anchor: Anchor) => void;
}) {
  const fieldId = useId();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(question.answer ?? '');
  const [state, setState] = useState<AnswerState>('idle');
  const save = useMutation({
    ...answerQuestionMutation(cvId),
    mutationKey: ['answer', cvId],
    onSuccess: (saved) => {
      replaceQuestion(queryClient, cvId, saved);
      setState('saved');
    },
    onError: (error) => setState({ error: answerError(error) }),
  });
  const status = useMutation({
    ...questionStatusMutation(cvId),
    onSuccess: (saved) => replaceQuestion(queryClient, cvId, saved),
  });

  function commit() {
    const answer = draft.trim();
    if (!answer || answer === question.answer) return;
    setState('saving');
    save.mutate({ questionId: question.id, answer });
  }

  return (
    <li className="question">
      <label className="question-text" htmlFor={fieldId}>
        {question.text}
      </label>
      <button
        type="button"
        className="link-button"
        onClick={() => onLocate(question.anchor)}
      >
        📍 {anchorLabel(question.anchor, content)}
      </button>
      <textarea
        id={fieldId}
        rows={2}
        maxLength={QUESTION_LIMITS.answer}
        value={draft}
        disabled={question.locked}
        placeholder="Your answer"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
      />
      <div className="question-foot">
        <span className="hint" role="status" aria-live="polite">
          {question.locked
            ? 'Being applied to your CV…'
            : state === 'saving'
              ? 'Saving…'
              : typeof state === 'object'
                ? state.error
                : isPendingAnswer(question)
                  ? 'Saved; tap Update CV to apply it'
                  : ''}
        </span>
        <button
          type="button"
          className="link-button"
          disabled={question.locked || status.isPending}
          onClick={() =>
            status.mutate({ questionId: question.id, action: 'dismiss' })
          }
        >
          Not relevant
        </button>
      </div>
    </li>
  );
}

const RESOLVED_LABELS: Record<Question['status'], string> = {
  open: 'Open',
  answered: 'Applied',
  dismissed: 'Not relevant',
  obsolete: 'No longer needed',
};

function ResolvedCard({
  cvId,
  question,
}: {
  cvId: string;
  question: Question;
}) {
  const queryClient = useQueryClient();
  const reopen = useMutation({
    ...questionStatusMutation(cvId),
    onSuccess: (saved) => replaceQuestion(queryClient, cvId, saved),
  });
  return (
    <li className="question">
      <p className="question-text">{question.text}</p>
      {question.answer && <p>“{question.answer}”</p>}
      <div className="question-foot">
        <span className="hint">{RESOLVED_LABELS[question.status]}</span>
        {question.status === 'dismissed' && (
          <button
            type="button"
            className="link-button"
            disabled={reopen.isPending}
            onClick={() =>
              reopen.mutate({ questionId: question.id, action: 'reopen' })
            }
          >
            Undo
          </button>
        )}
      </div>
    </li>
  );
}

function replaceQuestion(
  queryClient: ReturnType<typeof useQueryClient>,
  cvId: string,
  saved: Question,
) {
  queryClient.setQueryData<QuestionList>(queryKeys.questions(cvId), (list) =>
    list
      ? {
          items: list.items.map((question) =>
            question.id === saved.id ? saved : question,
          ),
        }
      : list,
  );
}

function answerError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.error.code === 'question_locked') {
      return 'Update CV is applying this answer; change it when it is done.';
    }
    if (error.status < 500) {
      return error.error.issues?.[0]?.message ?? error.error.message;
    }
  }
  return 'Couldn’t save. Leave the field again to retry.';
}
