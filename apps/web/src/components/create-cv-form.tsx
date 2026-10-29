'use client';

import {
  PDF_LIMITS,
  SOURCE_TEXT_LIMITS,
  TARGET_ROLE_LIMITS,
} from '@ai-cv-builder/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  type DragEvent,
  type SubmitEvent,
  useId,
  useRef,
  useState,
} from 'react';
import { ApiRequestError } from '@/lib/api';
import { createCvMutation } from '@/lib/cvs-query';
import { queryKeys } from '@/lib/query-keys';

const MAX_MB = PDF_LIMITS.maxBytes / (1024 * 1024);

const FILE_TOO_LARGE = `That PDF is larger than ${MAX_MB} MB.`;

/** By the API's stable error `code`. */
const ERROR_MESSAGES: Record<string, string> = {
  file_too_large: FILE_TOO_LARGE,
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

const number = (value: number) => value.toLocaleString('en');

function fileSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** What is wrong with a picked file, before it is ever uploaded. */
function fileProblem(file: File): string | null {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isPdf) return 'That file is not a PDF.';
  if (file.size === 0) return 'That file is empty.';
  if (file.size > PDF_LIMITS.maxBytes) return FILE_TOO_LARGE;
  return null;
}

export function CreateCvForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const roleId = useId();
  const textId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  // One key per opened form: a double submit or a network retry returns the same CV.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [kind, setKind] = useState<SourceKind>('pdf');
  const [role, setRole] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { mutate, isPending, error } = useMutation({
    ...createCvMutation(),
    onSuccess: ({ cvId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cvs() });
      router.push(`/cvs/${cvId}`);
    },
  });

  const roleLength = role.trim().length;
  const textLength = text.trim().length;
  const roleError =
    roleLength < TARGET_ROLE_LIMITS.min
      ? 'Enter the job title this CV is aimed at.'
      : null;
  const sourceError =
    kind === 'text'
      ? textLength < SOURCE_TEXT_LIMITS.min
        ? `Write at least ${SOURCE_TEXT_LIMITS.min} characters (${textLength} so far).`
        : null
      : (fileError ?? (file ? null : 'Choose a PDF to upload.'));

  function pick(next: File | undefined) {
    if (!next) return;
    const problem = fileProblem(next);
    setFileError(problem);
    setFile(problem ? null : next);
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragging(false);
    pick(event.dataTransfer.files[0]);
  }

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (isPending || roleError || sourceError) return;
    const targetRole = role.trim();
    if (kind === 'text') {
      mutate({ targetRole, source: { kind, text }, idempotencyKey });
    } else if (file) {
      mutate({ targetRole, source: { kind, file }, idempotencyKey });
    }
  }

  const serverMessage =
    error &&
    ((error instanceof ApiRequestError && ERROR_MESSAGES[error.error.code]) ||
      'Something went wrong. Try again.');

  return (
    <main>
      <p>
        <Link href="/">← My CVs</Link>
      </p>
      <h1>New CV</h1>
      <form onSubmit={onSubmit} className="stack" noValidate>
        <div className="auth-field">
          <label htmlFor={roleId}>Target role</label>
          <input
            id={roleId}
            name="targetRole"
            placeholder="e.g. Senior Backend Engineer"
            maxLength={TARGET_ROLE_LIMITS.max}
            value={role}
            onChange={(event) => setRole(event.target.value)}
            aria-invalid={submitted && roleError ? true : undefined}
          />
          <p
            className={
              submitted && roleError
                ? 'field-message field-message-error'
                : 'field-message'
            }
          >
            {submitted && roleError ? roleError : null}
            <span className="field-count">
              {roleLength} / {TARGET_ROLE_LIMITS.max}
            </span>
          </p>
        </div>

        <div
          className="source-switch"
          role="tablist"
          aria-label="Your background"
        >
          {(
            [
              ['pdf', 'Upload PDF'],
              ['text', 'Describe in text'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={kind === value}
              onClick={() => setKind(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {kind === 'pdf' ? (
          <div className="auth-field">
            <input
              ref={fileInput}
              type="file"
              name="file"
              accept="application/pdf,.pdf"
              hidden
              onChange={(event) => {
                pick(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
            {file ? (
              <div className="file-chip">
                <span className="file-icon" aria-hidden="true">
                  PDF
                </span>
                <span className="file-meta">
                  <b>{file.name}</b>
                  <small>{fileSize(file.size)}</small>
                </span>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setFile(null);
                    setFileError(null);
                  }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="dropzone"
                data-dragging={dragging}
                data-invalid={submitted && sourceError ? true : undefined}
                onClick={() => fileInput.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
              >
                <span className="dropzone-icon" aria-hidden="true">
                  ↑
                </span>
                <b>Drop your CV here, or click to browse</b>
                <small>
                  PDF · up to {MAX_MB} MB · {PDF_LIMITS.maxPages} pages. Scans
                  are fine.
                </small>
              </button>
            )}
            <p
              className="field-message field-message-error"
              role={sourceError ? 'alert' : undefined}
            >
              {(submitted || fileError) && sourceError}
            </p>
          </div>
        ) : (
          <div className="auth-field">
            <label htmlFor={textId}>About you</label>
            <textarea
              id={textId}
              name="text"
              rows={9}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Your jobs, projects, education and skills, in your own words."
              maxLength={SOURCE_TEXT_LIMITS.max}
              aria-invalid={submitted && sourceError ? true : undefined}
            />
            <p
              className={
                submitted && sourceError
                  ? 'field-message field-message-error'
                  : 'field-message'
              }
            >
              {submitted && sourceError ? sourceError : null}
              <span className="field-count">
                {number(text.length)} / {number(SOURCE_TEXT_LIMITS.max)}
              </span>
            </p>
          </div>
        )}

        <p className="hint">
          Anything missing becomes a question for you, never a guess.
        </p>
        <p role="alert" className="form-error">
          {serverMessage}
        </p>
        <button type="submit" className="primary" disabled={isPending}>
          {isPending ? 'Uploading…' : 'Generate CV'}
        </button>
      </form>
    </main>
  );
}
