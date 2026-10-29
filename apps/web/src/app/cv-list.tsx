'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ApiRequestError } from '@/lib/api';
import { logoutMutation, meQuery } from '@/lib/auth';
import { cvsQuery } from '@/lib/cvs-query';

/** The signed-in User's CVs; sends visitors without a session to the log-in page. */
export function CvList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useQuery(meQuery());
  const cvs = useQuery({ ...cvsQuery(), enabled: me.isSuccess });
  const logout = useMutation({
    ...logoutMutation(),
    onSuccess: () => {
      queryClient.clear();
      router.replace('/login');
    },
  });

  const signedOut =
    me.error instanceof ApiRequestError && me.error.status === 401;
  useEffect(() => {
    if (signedOut) router.replace('/login');
  }, [signedOut, router]);

  if (me.isError) {
    return signedOut ? (
      <p role="status">Redirecting to log in…</p>
    ) : (
      <p role="alert">Could not load your account. Try again.</p>
    );
  }
  if (!me.isSuccess) return <p role="status">Loading…</p>;

  return (
    <>
      <header className="bar">
        <span>{me.data.email}</span>
        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
        >
          Log out
        </button>
      </header>
      <h1>Your CVs</h1>
      {logout.isError && <p role="alert">Could not log out. Try again.</p>}
      {cvs.isError && <p role="alert">Could not load your CVs.</p>}
      {cvs.isSuccess &&
        (cvs.data.items.length === 0 ? (
          <p>You have no CVs yet.</p>
        ) : (
          <ul>
            {cvs.data.items.map((cv) => (
              <li key={cv.id}>{cv.id}</li>
            ))}
          </ul>
        ))}
    </>
  );
}
