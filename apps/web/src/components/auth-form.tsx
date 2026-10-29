'use client';

import {
  loginSchema,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  type User,
} from '@ai-cv-builder/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type SubmitEvent, useId, useState } from 'react';
import { ApiRequestError } from '@/lib/api';
import { loginMutation, signupMutation } from '@/lib/auth';
import { formField } from '@/lib/form-field';
import { queryKeys } from '@/lib/query-keys';

const COPY = {
  login: {
    title: 'Log in',
    submit: 'Log in',
    pending: 'Logging in…',
    passwordAutocomplete: 'current-password',
    switchText: 'No account yet?',
    switchLink: { href: '/signup', label: 'Sign up' },
  },
  signup: {
    title: 'Sign up',
    submit: 'Create account',
    pending: 'Creating account…',
    passwordAutocomplete: 'new-password',
    switchText: 'Already have an account?',
    switchLink: { href: '/login', label: 'Log in' },
  },
} as const;

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Invalid email or password.',
  email_taken: 'That email is already registered. Try logging in.',
  validation_failed: `Enter a valid email and a password of ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters.`,
};

const FALLBACK_ERROR = 'Something went wrong. Try again.';

type Mode = keyof typeof COPY;
type Field = 'email' | 'password';
type Values = Record<Field, string>;
type FieldErrors = Partial<Record<Field, string>>;

/** What is wrong with each field right now, in words a person can act on. */
function validate(mode: Mode, { email, password }: Values): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) errors.email = 'Enter your email.';
  else if (!loginSchema.shape.email.safeParse(email).success) {
    errors.email = 'Enter a valid email, like name@example.com.';
  }
  if (!password) errors.password = 'Enter your password.';
  else if (mode === 'signup' && password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Use at least ${PASSWORD_MIN_LENGTH} characters (${password.length} so far).`;
  } else if (password.length > PASSWORD_MAX_LENGTH) {
    errors.password = `Use at most ${PASSWORD_MAX_LENGTH} characters (${password.length} now).`;
  }
  return errors;
}

/** One form for both pages: only the endpoint and the wording differ. */
export function AuthForm({ mode }: { mode: Mode }) {
  const copy = COPY[mode];
  const router = useRouter();
  const queryClient = useQueryClient();
  const emailId = useId();
  const passwordId = useId();
  const [values, setValues] = useState<Values>({ email: '', password: '' });
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  // Kept in state, not read from the mutation: the mutation clears its error
  // the moment a retry starts, which made the message (and the form below it)
  // blink on every failed attempt.
  const [serverError, setServerError] = useState<string | null>(null);

  const { mutate, isPending } = useMutation({
    ...(mode === 'login' ? loginMutation() : signupMutation()),
    onSuccess: (user: User) => {
      queryClient.setQueryData(queryKeys.me(), user);
      router.replace('/');
    },
    onError: (error) =>
      setServerError(
        (error instanceof ApiRequestError &&
          ERROR_MESSAGES[error.error.code]) ||
          FALLBACK_ERROR,
      ),
  });

  const errors = validate(mode, values);

  function onChange(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setServerError(null);
  }

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    if (errors.email || errors.password) {
      setTouched({ email: true, password: true });
      return;
    }
    const data = new FormData(event.currentTarget);
    mutate({
      email: formField(data, 'email'),
      password: formField(data, 'password'),
    });
  }

  const shown = (field: Field) => (touched[field] ? errors[field] : undefined);
  const emailError = shown('email');
  const passwordError = shown('password');
  const passwordHintId = `${passwordId}-hint`;

  return (
    <main>
      <h1>{copy.title}</h1>
      <form onSubmit={onSubmit} className="stack" noValidate>
        <div className="auth-field">
          <label htmlFor={emailId}>Email</label>
          <input
            id={emailId}
            name="email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(event) => onChange('email', event.target.value)}
            onBlur={() =>
              setTouched((current) => ({ ...current, email: true }))
            }
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? `${emailId}-error` : undefined}
          />
          <p
            id={`${emailId}-error`}
            className="field-message field-message-error"
          >
            {emailError}
          </p>
        </div>
        <div className="auth-field">
          <label htmlFor={passwordId}>Password</label>
          <input
            id={passwordId}
            name="password"
            type="password"
            autoComplete={copy.passwordAutocomplete}
            value={values.password}
            onChange={(event) => onChange('password', event.target.value)}
            onBlur={() =>
              setTouched((current) => ({ ...current, password: true }))
            }
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={passwordHintId}
          />
          <p
            id={passwordHintId}
            className={
              passwordError
                ? 'field-message field-message-error'
                : 'field-message'
            }
          >
            {passwordError ??
              (mode === 'signup'
                ? `${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters.`
                : undefined)}
          </p>
        </div>
        <p role="alert" className="form-error">
          {serverError}
        </p>
        <button type="submit" disabled={isPending}>
          {isPending ? copy.pending : copy.submit}
        </button>
      </form>
      <p>
        {copy.switchText}{' '}
        <Link href={copy.switchLink.href}>{copy.switchLink.label}</Link>
      </p>
    </main>
  );
}
