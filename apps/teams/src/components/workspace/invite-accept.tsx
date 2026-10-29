'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ErrorText, PRIMARY, api } from './ui';

/** The invite token travels in the URL fragment, so it never reaches server logs or Referer headers. */
export function InviteAccept({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  if (!signedIn) {
    return (
      <p className="text-sm text-fg-2">
        Sign in or create an account with the email address the invite was sent to, then open the invite link again.{' '}
        <Link href="/signin?next=/workspace" className="text-accent underline underline-offset-2">Sign in</Link> ·{' '}
        <Link href="/signup?next=/workspace" className="text-accent underline underline-offset-2">Create an account</Link>
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <button
        type="button"
        className={PRIMARY}
        onClick={async () => {
          const token = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
          const res = await api('/api/invites/accept', { body: { token } });
          if (!res.ok) return setError(res.data.error ?? 'That invite did not work.');
          router.push('/workspace');
          router.refresh();
        }}
      >
        Join the workspace
      </button>
      <ErrorText message={error} />
    </div>
  );
}
