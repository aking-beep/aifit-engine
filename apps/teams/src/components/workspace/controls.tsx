'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DANGER, ErrorText, INPUT, PRIMARY, SECONDARY, api } from './ui';

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className={SECONDARY}
      onClick={async () => {
        await api('/api/auth/logout', { body: {} });
        router.push('/');
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}

export function WorkspaceSwitcher({ orgs, activeId }: { orgs: { id: string; name: string; role: string }[]; activeId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <label htmlFor="workspace-switch" className="text-xs text-fg-2">Workspace</label>
      <select
        id="workspace-switch"
        defaultValue={activeId}
        className={INPUT + ' w-auto'}
        onChange={async (e) => {
          const res = await api('/api/workspace', { body: { orgId: e.target.value } });
          if (!res.ok) return setError(res.data.error ?? 'Could not switch workspace.');
          router.refresh();
        }}
      >
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>{o.name} ({o.role})</option>
        ))}
      </select>
      <ErrorText message={error} />
    </div>
  );
}

/** Starts Stripe-hosted Checkout and redirects there. */
export function CheckoutButton({ product, assessmentId, label }: { product: 'team' | 'blueprint' | 'assessment'; assessmentId?: string; label: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2">
      <button
        type="button"
        className={PRIMARY}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await api<{ url: string }>('/api/billing/checkout', { body: { product, assessmentId } });
          if (!res.ok || !res.data.url) {
            setBusy(false);
            return setError(res.data.error ?? 'Checkout could not start.');
          }
          window.location.assign(res.data.url);
        }}
      >
        {busy ? 'Opening checkout…' : label}
      </button>
      <ErrorText message={error} />
    </div>
  );
}

/** Downloads a deliverable; a 402 is shown as a reason, not an error page. */
export function DownloadLink({ href, label }: { href: string; label: string }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        className={SECONDARY}
        onClick={async () => {
          setError(null);
          const res = await fetch(href, { credentials: 'same-origin' });
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            return setError(body.error ?? 'Download failed.');
          }
          const blob = await res.blob();
          const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'download';
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = name;
          a.click();
          URL.revokeObjectURL(url);
        }}
      >
        {label}
      </button>
      <ErrorText message={error} />
    </span>
  );
}

export function DeleteAssessmentButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!confirming) return <button type="button" className={DANGER} onClick={() => setConfirming(true)}>Delete assessment</button>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-fg-2">Delete every version? This cannot be undone.</span>
      <button
        type="button"
        className={DANGER}
        onClick={async () => {
          const res = await api(`/api/assessments/${id}`, { method: 'DELETE' });
          if (!res.ok) return setError(res.data.error ?? 'Could not delete.');
          router.push('/workspace');
          router.refresh();
        }}
      >
        Yes, delete
      </button>
      <button type="button" className={SECONDARY} onClick={() => setConfirming(false)}>Cancel</button>
      <ErrorText message={error} />
    </div>
  );
}

export function SendToControlButton({ id }: { id: string }) {
  const [note, setNote] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        className={SECONDARY}
        onClick={async () => {
          const res = await api<{ detail: string }>(`/api/assessments/${id}/control-export`, { body: {} });
          setNote(res.data.detail ?? res.data.error ?? 'Not delivered.');
        }}
      >
        Send to ARC Control
      </button>
      {note ? <span className="text-xs text-fg-2" aria-live="polite">{note}</span> : null}
    </span>
  );
}
