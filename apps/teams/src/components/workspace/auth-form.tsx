'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ErrorText, Field, INPUT, PRIMARY, api } from './ui';

/** Sign-in and sign-up. On success the session cookie is set by the server (HttpOnly). */
export function AuthForm({ mode, next }: { mode: 'signin' | 'signup'; next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const body = mode === 'signup'
      ? { name: form.get('name'), email: form.get('email'), password: form.get('password'), orgName: form.get('orgName') || undefined }
      : { email: form.get('email'), password: form.get('password') };
    const res = await api(mode === 'signup' ? '/api/auth/signup' : '/api/auth/login', { body });
    setBusy(false);
    if (!res.ok) return setError(res.data.error ?? 'That did not work. Try again.');
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-5" aria-describedby={error ? 'auth-error' : undefined}>
      {mode === 'signup' && (
        <>
          <Field id="name" label="Your name">
            <input id="name" name="name" required maxLength={100} autoComplete="name" className={INPUT} />
          </Field>
          <Field id="orgName" label="Workspace name" hint="Usually your team or company. You can invite people later.">
            <input id="orgName" name="orgName" maxLength={100} autoComplete="organization" className={INPUT} />
          </Field>
        </>
      )}
      <Field id="email" label="Email">
        <input id="email" name="email" type="email" required maxLength={254} autoComplete="email" className={INPUT} />
      </Field>
      <Field id="password" label="Password" hint={mode === 'signup' ? 'At least 12 characters.' : undefined}>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={mode === 'signup' ? 12 : 1}
          maxLength={200}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          className={INPUT}
        />
      </Field>
      <ErrorText id="auth-error" message={error} />
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className={PRIMARY} disabled={busy}>
          {busy ? 'One moment…' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>
        {mode === 'signup' ? (
          <Link href={`/signin?next=${encodeURIComponent(next)}`} className="text-sm text-ink-300 underline underline-offset-2 hover:text-ink-100">
            I already have an account
          </Link>
        ) : (
          <Link href={`/signup?next=${encodeURIComponent(next)}`} className="text-sm text-ink-300 underline underline-offset-2 hover:text-ink-100">
            Create an account
          </Link>
        )}
      </div>
    </form>
  );
}
