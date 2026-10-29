'use client';

import type { CvStatus } from '@ai-cv-builder/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { logoutMutation, meQuery } from '@/lib/auth';
import { cvsQuery } from '@/lib/cvs-query';
import { useSignedOutRedirect } from '@/lib/use-signed-out-redirect';

const STATUS_LABELS: Record<CvStatus, string> = {
  generating: 'Generating…',
  ready: 'Ready',
  failed: 'Failed',
};

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

  const signedOut = useSignedOutRedirect(me.error);

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
      <div className="bar">
        <h1>Your CVs</h1>
        <Link href="/cvs/new" className="button">
          + New CV
        </Link>
      </div>
      {logout.isError && <p role="alert">Could not log out. Try again.</p>}
      {cvs.isError && <p role="alert">Could not load your CVs.</p>}
      {cvs.isSuccess &&
        (cvs.data.items.length === 0 ? (
          <p>You have no CVs yet.</p>
        ) : (
          <ul className="cv-list">
            {cvs.data.items.map((cv) => (
              <li key={cv.id}>
                <Link href={`/cvs/${cv.id}`}>{cv.targetRole}</Link>
                <span className={`badge badge-${cv.status}`}>
                  {STATUS_LABELS[cv.status]}
                </span>
              </li>
            ))}
          </ul>
        ))}
    </>
  );
}
