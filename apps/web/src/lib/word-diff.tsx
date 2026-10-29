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
