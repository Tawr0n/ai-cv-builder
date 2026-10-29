'use client';

import type { Anchor, CvContent, Question } from '@ai-cv-builder/shared';
import { anchorLabel } from '@/lib/anchors';

/**
 * The open Questions, most important first, each with a 📍 link to its
 * Anchor. Read-only for now: answering comes with the next slice.
 */
export function QuestionsInbox({
  questions,
  content,
  onLocate,
}: {
  questions: Question[];
  content: CvContent;
  onLocate: (anchor: Anchor) => void;
}) {
  const open = questions.filter((question) => question.status === 'open');
  if (open.length === 0) {
    return (
      <p className="hint">
        No questions: everything in this CV rests on what you told us.
      </p>
    );
  }
  return (
    <section>
      <p className="hint">
        Anything missing or vague in your background became a question here
        instead of a guess in your CV.
      </p>
      <ol className="questions">
        {open.map((question) => (
          <li key={question.id} className="question">
            <p className="question-text">{question.text}</p>
            <button
              type="button"
              className="link-button"
              onClick={() => onLocate(question.anchor)}
            >
              📍 {anchorLabel(question.anchor, content)}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
