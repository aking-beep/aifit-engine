'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorText, INPUT, PRIMARY, SECONDARY, api } from './ui';

type Member = { userId: string; email: string; name: string; role: string; addedAt: string };

export function MembersPanel({ members, canManage, selfId }: { members: Member[]; canManage: boolean; selfId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function invite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    setLink(null);
    const res = await api<{ path: string }>('/api/workspace/members', { body: { email: f.get('email'), role: f.get('role') } });
    setBusy(false);
    if (!res.ok) return setError(res.data.error ?? 'Could not create the invite.');
    setLink(`${window.location.origin}${res.data.path}`);
  }

  async function change(userId: string, role: string) {
    setError(null);
    const res = await api('/api/workspace/members', { method: 'PATCH', body: { userId, role } });
    if (!res.ok) return setError(res.data.error ?? 'Could not change the role.');
    router.refresh();
  }

  async function remove(userId: string) {
    setError(null);
    const res = await api('/api/workspace/members', { method: 'DELETE', body: { userId } });
    if (!res.ok) return setError(res.data.error ?? 'Could not remove that person.');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-line" aria-label="Members">
        {members.map((m) => (
          <li key={m.userId} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
            <div>
              <p className="text-sm text-fg">
                {m.name} {m.userId === selfId ? <span className="text-fg-muted">(you)</span> : null}
              </p>
              <p className="text-xs text-fg-muted">{m.email}</p>
            </div>
            {canManage && m.userId !== selfId ? (
              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`role-${m.userId}`}>Role for {m.email}</label>
                <select
                  id={`role-${m.userId}`}
                  defaultValue={m.role}
                  onChange={(e) => change(m.userId, e.target.value)}
                  className={INPUT + ' w-auto'}
                >
                  {['viewer', 'member', 'admin', 'owner'].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <button type="button" className={SECONDARY} onClick={() => remove(m.userId)} aria-label={`Remove ${m.email}`}>
                  Remove
                </button>
              </div>
            ) : (
              <span className="text-xs text-fg-2">{m.role}</span>
            )}
          </li>
        ))}
      </ul>
      <ErrorText message={error} />
      {canManage ? (
        <form onSubmit={invite} className="space-y-3 border-t border-line pt-4">
          <p className="text-sm font-medium text-fg">Invite someone</p>
          <div className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="invite-email">Email to invite</label>
            <input id="invite-email" name="email" type="email" required placeholder="name@company.com" className={INPUT + ' max-w-xs'} />
            <label className="sr-only" htmlFor="invite-role">Role</label>
            <select id="invite-role" name="role" defaultValue="member" className={INPUT + ' w-auto'}>
              <option value="viewer">viewer — can read</option>
              <option value="member">member — can assess and download</option>
              <option value="admin">admin — can manage people and billing</option>
            </select>
            <button type="submit" className={PRIMARY} disabled={busy}>Create invite link</button>
          </div>
          {link ? (
            <div className="space-y-1">
              <label htmlFor="invite-link" className="text-xs text-fg-2">
                Send this link to them yourself (this build sends no email). It works once, for that email, for 7 days.
              </label>
              <input id="invite-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} className={INPUT + ' font-mono text-2xs'} />
            </div>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
