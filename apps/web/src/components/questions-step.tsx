'use client';

import {
  type CvContent,
  type Generation,
  type Question,
  type QuestionList,
  QUESTION_LIMITS,
} from '@ai-cv-builder/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { anchorLabel } from '@/lib/anchors';
import { ApiRequestError } from '@/lib/api';
import {
  answerQuestionMutation,
  questionStatusMutation,
  updateCvMutation,
} from '@/lib/cvs-query';
import { queryKeys } from '@/lib/query-keys';

/**
 * The Questions, asked once between Generation and the editor: answer the ones
 * you can, skip the rest (a skipped Question is gone for good). One Update CV
 * then applies every Answer, and what it changed is reviewed on the paper.
 */
export function QuestionsStep({
  cvId,
  questions,
  content,
}: {
  cvId: string;
  /** Open Questions and Answers not applied yet, in the order to ask them. */
  questions: Question[];
  content: CvContent;
}) {
  const queryClient = useQueryClient();
  // Skipped ones leave the list, so the progress counts from how many there were.
  const [total] = useState(questions.length);
  const [openId, setOpenId] = useState<string | null>(questions[0]?.id ?? null);
  const dismiss = useMutation({
    ...questionStatusMutation(cvId),
    onSuccess: (saved) => replaceQuestion(queryClient, cvId, saved),
  });
  const start = useMutation(updateCvMutation(cvId));
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(0);

  const answered = questions.filter(
    (question) => question.status === 'answered',
  );
  const open = questions.filter((question) => question.status === 'open');
  const handled = total - open.length;
  const busy = dismiss.isPending || start.isPending || saving > 0;

  async function finish() {
    setFailed(false);
    try {
      await Promise.all(
        open.map(({ id }) =>
          dismiss.mutateAsync({ questionId: id, action: 'dismiss' }),
        ),
      );
      if (answered.length > 0) {
        const generation: Generation = await start.mutateAsync();
        queryClient.setQueryData(queryKeys.generation(cvId), generation);
      }
    } catch {
      setFailed(true);
    }
  }

  return (
    <section className="qs">
      <header>
        <h1>A few questions</h1>
        <p className="muted">
          Things your background did not say. Answer what you can: skipped
          questions are not asked again.
        </p>
        <div
          className="qs-progress"
          role="progressbar"
          aria-valuenow={handled}
          aria-valuemin={0}
          aria-valuemax={total}
        >
          <i style={{ width: `${total ? (handled / total) * 100 : 0}%` }} />
        </div>
        <p className="qs-count">
          {handled} of {total} handled
        </p>
      </header>

      <ul className="qs-list">
        {questions.map((question) => (
          <QuestionRow
            key={question.id}
            cvId={cvId}
            question={question}
            where={anchorLabel(question.anchor, content)}
            expanded={openId === question.id}
            onToggle={() =>
              setOpenId((current) =>
                current === question.id ? null : question.id,
              )
            }
            onSkip={() =>
              dismiss.mutate({ questionId: question.id, action: 'dismiss' })
            }
            onSaving={(delta) => setSaving((count) => count + delta)}
            disabled={busy}
          />
        ))}
      </ul>

      <p role="alert" className="form-error">
        {failed
          ? 'Could not continue. Check your connection and try again.'
          : ''}
      </p>
      <button
        type="button"
        className="primary qs-apply"
        disabled={busy}
        onClick={() => void finish()}
      >
        {start.isPending
          ? 'Applying…'
          : answered.length > 0
            ? `Apply ${answered.length} ${answered.length === 1 ? 'answer' : 'answers'}`
            : 'Continue without answering'}
      </button>
      {answered.length > 0 && open.length > 0 && (
        <p className="hint qs-note">
          {open.length} unanswered{' '}
          {open.length === 1 ? 'question is' : 'questions are'} skipped.
        </p>
      )}
    </section>
  );
}

function QuestionRow({
  cvId,
  question,
  where,
  expanded,
  onToggle,
  onSkip,
  onSaving,
  disabled,
}: {
  cvId: string;
  question: Question;
  where: string;
  expanded: boolean;
  onToggle: () => void;
  onSkip: () => void;
  onSaving: (delta: 1 | -1) => void;
  disabled: boolean;
}) {
  const fieldId = useId();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(question.answer ?? '');
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    ...answerQuestionMutation(cvId),
    onMutate: () => onSaving(1),
    onSettled: () => onSaving(-1),
    onSuccess: (saved) => {
      replaceQuestion(queryClient, cvId, saved);
      setError(null);
    },
    onError: (failure) =>
      setError(
        failure instanceof ApiRequestError && failure.status < 500
          ? (failure.error.issues?.[0]?.message ?? failure.error.message)
          : 'Could not save. Try again.',
      ),
  });
  const done = question.status === 'answered';
  const trimmed = draft.trim();

  return (
    <li className="qs-row" data-done={done} data-open={expanded}>
      <button
        type="button"
        className="qs-head"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className="qs-check" aria-hidden="true">
          {done && '✓'}
        </span>
        <span className="qs-text">
          {question.text}
          <small>{done ? `Answered · ${where}` : where}</small>
        </span>
      </button>
      {expanded && (
        <div className="qs-body">
          <label htmlFor={fieldId} className="visually-hidden">
            Your answer
          </label>
          <textarea
            id={fieldId}
            rows={3}
            maxLength={QUESTION_LIMITS.answer}
            value={draft}
            placeholder="Your answer"
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="qs-actions">
            <span className="field-count">
              {draft.length} / {QUESTION_LIMITS.answer}
            </span>
            <button
              type="button"
              className="link-button"
              disabled={disabled}
              onClick={onSkip}
            >
              Skip
            </button>
            <button
              type="button"
              disabled={
                disabled ||
                save.isPending ||
                trimmed === '' ||
                trimmed === question.answer
              }
              onClick={() =>
                save.mutate({ questionId: question.id, answer: trimmed })
              }
            >
              {save.isPending
                ? 'Saving…'
                : done
                  ? 'Update answer'
                  : 'Save answer'}
            </button>
          </div>
          {error && (
            <p role="alert" className="field-message field-message-error">
              {error}
            </p>
          )}
        </div>
      )}
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
