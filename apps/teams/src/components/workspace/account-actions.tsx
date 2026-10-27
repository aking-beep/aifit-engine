'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { DANGER, ErrorText, Field, INPUT, SECONDARY, api } from './ui';

export function AccountActions({ email }: { email: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function del(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const confirmEmail = new FormData(e.currentTarget).get('confirmEmail');
    const res = await api('/api/account', { method: 'DELETE', body: { confirmEmail } });
    if (!res.ok) return setError(res.data.error ?? 'Could not delete the account.');
    router.push('/');
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <a href="/api/account" className={SECONDARY} download>Download everything stored about me (JSON)</a>
      </div>
      <form onSubmit={del} className="max-w-md space-y-3 border-t border-ink-800 pt-6">
        <p className="text-sm font-medium text-ink-100">Delete my account</p>
        <p className="text-xs leading-relaxed text-ink-400">
          Workspaces where you are the only member are deleted with everything in them. In shared workspaces you are
          removed and the team keeps its assessments. If you are the only owner of a shared workspace, make someone else
          an owner first. Cancel any paid plan in Stripe before deleting.
        </p>
        <Field id="confirmEmail" label={`Type ${email} to confirm`}>
          <input id="confirmEmail" name="confirmEmail" type="email" required autoComplete="off" className={INPUT} />
        </Field>
        <ErrorText message={error} />
        <button type="submit" className={DANGER}>Delete my account</button>
      </form>
    </div>
  );
}
