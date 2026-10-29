import { diffWords } from 'diff';
import type { ReactNode } from 'react';

/**
 * `after` marked up against `before` word by word (punctuation is its own
 * token): removed words struck through in red, added ones in green.
 */
export function wordDiff(before: string, after: string): ReactNode {
  return diffWords(before, after).map((part, index) =>
    part.added ? (
      <ins key={index} className="diff-added">
        {part.value}
      </ins>
    ) : part.removed ? (
      <del key={index} className="diff-removed">
        {part.value}
      </del>
    ) : (
      <span key={index}>{part.value}</span>
    ),
  );
}

/**
 * A change as two columns of lines. When the item kept its line count the
 * lines are paired and differ word by word; otherwise whole lines that only
 * one side has are marked.
 */
export function diffSides(
  before: string[],
  after: string[],
): { was: ReactNode[]; now: ReactNode[] } {
  if (before.length === after.length && before.length > 0) {
    const pairs = before.map((line, i) => diffWords(line, after[i] ?? ''));
    return {
      was: pairs.map((parts, i) => (
        <p key={i}>
          {parts
            .filter((part) => !part.added)
            .map((part, j) =>
              part.removed ? (
                <del key={j} className="diff-removed">
                  {part.value}
                </del>
              ) : (
                <span key={j}>{part.value}</span>
              ),
            )}
        </p>
      )),
      now: pairs.map((parts, i) => (
        <p key={i}>
          {parts
            .filter((part) => !part.removed)
            .map((part, j) =>
              part.added ? (
                <ins key={j} className="diff-added">
                  {part.value}
                </ins>
              ) : (
                <span key={j}>{part.value}</span>
              ),
            )}
        </p>
      )),
    };
  }
  return {
    was: before.map((line, i) => (
      <p key={i} className={after.includes(line) ? undefined : 'diff-removed'}>
        {line}
      </p>
    )),
    now: after.map((line, i) => (
      <p key={i} className={before.includes(line) ? undefined : 'diff-added'}>
        {line}
      </p>
    )),
  };
}
