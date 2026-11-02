'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { forgetLinkToken, useLinkToken } from '@/design';
import { ErrorText, Field, INPUT, PRIMARY, api } from './ui';

/** Step 1 asks for the email; step 2 (with #token= from the emailed link) sets the new password. */
export function ResetForm({ emailEnabled }: { emailEnabled: boolean }) {
  const linkToken = useLinkToken();
  const ready = linkToken !== undefined;
  const token = linkToken ?? null;
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const res = token
      ? await api('/api/auth/reset/complete', { body: { token, password: form.get('password') } })
      : await api('/api/auth/reset', { body: { email: form.get('email') } });
    setBusy(false);
    if (!res.ok) return setError(res.data.error ?? 'That did not work. Try again.');
    if (token) forgetLinkToken();
    setDone(token ? 'Password changed. Every other session was signed out.' : String(res.data.message ?? 'Check your email.'));
  }

  const heading = <h1 className="text-3xl font-semibold text-fg">{token ? 'Choose a new password' : 'Reset your password'}</h1>;
  if (!ready) return heading;
  if (!token && !emailEnabled) {
    return (
      <div className="space-y-6">
        {heading}
        <p className="max-w-2xl text-sm text-fg-2">Password reset by email is not set up on this deployment yet. Contact the workspace owner or support.</p>
      </div>
    );
  }
  if (done) {
    return (
      <div className="space-y-6">
      {heading}
      <div role="status" className="max-w-md space-y-3">
        <p className="text-body-md text-fg">{done}</p>
        {token ? <Link href="/signin" className={PRIMARY}>Sign in</Link> : null}
      </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
    {heading}
    {!token ? <p className="max-w-2xl text-sm text-fg-2">We email a link that works once, for 30 minutes.</p> : null}
    <form onSubmit={submit} className="max-w-md space-y-5" aria-describedby={error ? 'reset-error' : undefined}>
      {token ? (
        <Field id="password" label="New password" hint="At least 12 characters.">
          <input id="password" name="password" type="password" required minLength={12} maxLength={200} autoComplete="new-password" className={INPUT} />
        </Field>
      ) : (
        <Field id="email" label="Email">
          <input id="email" name="email" type="email" required maxLength={254} autoComplete="email" className={INPUT} />
        </Field>
      )}
      <ErrorText id="reset-error" message={error} />
      <button type="submit" className={PRIMARY} disabled={busy}>
        {busy ? 'One moment…' : token ? 'Set new password' : 'Send reset link'}
      </button>
    </form>
    </div>
  );
}
