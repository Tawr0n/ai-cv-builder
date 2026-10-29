'use client';

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  type User,
} from '@ai-cv-builder/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type SubmitEvent, useId } from 'react';
import { ApiRequestError } from '@/lib/api';
import { loginMutation, signupMutation } from '@/lib/auth';
import { formField } from '@/lib/form-field';
import { queryKeys } from '@/lib/query-keys';

const COPY = {
  login: {
    title: 'Log in',
    submit: 'Log in',
    passwordAutocomplete: 'current-password',
    switchText: 'No account yet?',
    switchLink: { href: '/signup', label: 'Sign up' },
  },
  signup: {
    title: 'Sign up',
    submit: 'Create account',
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

/** One form for both pages: only the endpoint and the wording differ. */
export function AuthForm({ mode }: { mode: keyof typeof COPY }) {
  const copy = COPY[mode];
  const router = useRouter();
  const queryClient = useQueryClient();
  const emailId = useId();
  const passwordId = useId();

  const { mutate, isPending, error } = useMutation({
    ...(mode === 'login' ? loginMutation() : signupMutation()),
    onSuccess: (user: User) => {
      queryClient.setQueryData(queryKeys.me(), user);
      router.replace('/');
    },
  });

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    mutate({
      email: formField(data, 'email'),
      password: formField(data, 'password'),
    });
  }

  return (
    <main>
      <h1>{copy.title}</h1>
      <form onSubmit={onSubmit} className="stack">
        <label htmlFor={emailId}>Email</label>
        <input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        <label htmlFor={passwordId}>Password</label>
        <input
          id={passwordId}
          name="password"
          type="password"
          autoComplete={copy.passwordAutocomplete}
          minLength={mode === 'signup' ? PASSWORD_MIN_LENGTH : undefined}
          maxLength={PASSWORD_MAX_LENGTH}
          required
        />
        {error && (
          <p role="alert">
            {(error instanceof ApiRequestError &&
              ERROR_MESSAGES[error.error.code]) ||
              'Something went wrong. Try again.'}
          </p>
        )}
        <button type="submit" disabled={isPending}>
          {copy.submit}
        </button>
      </form>
      <p>
        {copy.switchText}{' '}
        <Link href={copy.switchLink.href}>{copy.switchLink.label}</Link>
      </p>
    </main>
  );
}
