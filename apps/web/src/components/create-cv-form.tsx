'use client';

import {
  PDF_LIMITS,
  SOURCE_TEXT_LIMITS,
  TARGET_ROLE_LIMITS,
} from '@ai-cv-builder/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type SubmitEvent, useId, useState } from 'react';
import { ApiRequestError } from '@/lib/api';
import { createCvMutation } from '@/lib/cvs-query';
import { formField } from '@/lib/form-field';
import { queryKeys } from '@/lib/query-keys';

const MAX_MB = PDF_LIMITS.maxBytes / (1024 * 1024);

const ERROR_MESSAGES: Record<string, string> = {
  file_too_large: `That PDF is larger than ${MAX_MB} MB.`,
  not_a_pdf: 'That file is not a PDF.',
  pdf_unreadable: 'That PDF could not be read. Try exporting it again.',
  pdf_encrypted:
    'That PDF is password-protected. Upload a copy without a password.',
  pdf_too_many_pages: `That PDF has more than ${PDF_LIMITS.maxPages} pages.`,
  too_many_active_generations:
    'Three CVs are already generating. Wait for one to finish, then try again.',
  validation_failed: `Enter a target role and either a PDF or ${SOURCE_TEXT_LIMITS.min}–${SOURCE_TEXT_LIMITS.max.toLocaleString('en')} characters about yourself.`,
};

type SourceKind = 'pdf' | 'text';

export function CreateCvForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const roleId = useId();
  const fileId = useId();
  const textId = useId();
  // One key per opened form: a double submit or a network retry returns the same CV.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [kind, setKind] = useState<SourceKind>('pdf');
  const [text, setText] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);

  const { mutate, isPending, error } = useMutation({
    ...createCvMutation(),
    onSuccess: ({ cvId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cvs() });
      router.push(`/cvs/${cvId}`);
    },
  });

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const targetRole = formField(data, 'targetRole');
    if (kind === 'text') {
      mutate({ targetRole, source: { kind, text }, idempotencyKey });
      return;
    }
    const file = data.get('file');
    if (!(file instanceof File) || file.size === 0) {
      setFileError('Choose a PDF to upload.');
      return;
    }
    if (file.size > PDF_LIMITS.maxBytes) {
      setFileError(ERROR_MESSAGES.file_too_large!);
      return;
    }
    setFileError(null);
    mutate({ targetRole, source: { kind, file }, idempotencyKey });
  }

  const message =
    fileError ??
    (error &&
      ((error instanceof ApiRequestError && ERROR_MESSAGES[error.error.code]) ||
        'Something went wrong. Try again.'));

  return (
    <main>
      <p>
        <Link href="/">← My CVs</Link>
      </p>
      <h1>New CV</h1>
      <form onSubmit={onSubmit} className="stack">
        <label htmlFor={roleId}>Target role</label>
        <input
          id={roleId}
          name="targetRole"
          placeholder="e.g. Senior Backend Engineer"
          minLength={TARGET_ROLE_LIMITS.min}
          maxLength={TARGET_ROLE_LIMITS.max}
          required
        />

        <fieldset className="segmented">
          <legend>Your background</legend>
          {(
            [
              ['pdf', 'Upload PDF'],
              ['text', 'Describe in text'],
            ] as const
          ).map(([value, label]) => (
            <label key={value}>
              <input
                type="radio"
                name="sourceKind"
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
              />
              {label}
            </label>
          ))}
        </fieldset>

        {kind === 'pdf' ? (
          <>
            <label htmlFor={fileId}>Your current CV</label>
            <input
              id={fileId}
              name="file"
              type="file"
              accept="application/pdf,.pdf"
              required
            />
            <p className="hint">
              PDF up to {MAX_MB} MB and {PDF_LIMITS.maxPages} pages. Scans are
              fine.
            </p>
          </>
        ) : (
          <>
            <label htmlFor={textId}>About you</label>
            <textarea
              id={textId}
              name="text"
              rows={10}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Your jobs, projects, education and skills, in your own words."
              minLength={SOURCE_TEXT_LIMITS.min}
              maxLength={SOURCE_TEXT_LIMITS.max}
              required
            />
            <p className="hint">
              {text.length.toLocaleString('en')} /{' '}
              {SOURCE_TEXT_LIMITS.max.toLocaleString('en')} characters
            </p>
          </>
        )}

        <p className="hint">
          Anything missing becomes a question for you, never a guess.
        </p>
        {message && <p role="alert">{message}</p>}
        <button type="submit" disabled={isPending}>
          {isPending ? 'Uploading…' : 'Generate CV'}
        </button>
      </form>
    </main>
  );
}
