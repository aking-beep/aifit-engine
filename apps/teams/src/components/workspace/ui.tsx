'use client';

/** Small shared pieces for the workspace screens. Styling matches the report's chrome. */

export const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal';
export const PRIMARY = `inline-flex min-h-10 items-center justify-center rounded-lg bg-signal px-4 py-2 text-sm font-medium text-ink-950 transition hover:bg-signal-glow disabled:opacity-60 ${FOCUS}`;
export const SECONDARY = `inline-flex min-h-10 items-center justify-center rounded-lg border border-ink-600 px-4 py-2 text-sm text-ink-100 transition hover:border-ink-500 hover:bg-ink-800 disabled:opacity-60 ${FOCUS}`;
export const DANGER = `inline-flex min-h-10 items-center justify-center rounded-lg border border-danger/60 px-4 py-2 text-sm text-danger transition hover:bg-danger/10 disabled:opacity-60 ${FOCUS}`;
export const INPUT = `min-h-10 w-full rounded-md border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-400 ${FOCUS}`;

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T & { error?: string; code?: string };
}

export async function api<T = Record<string, unknown>>(path: string, init: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: init.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: 'same-origin',
    });
    const data = (await res.json().catch(() => ({}))) as ApiResult<T>['data'];
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'Could not reach the server. Check your connection and try again.' } as ApiResult<T>['data'] };
  }
}

export function ErrorText({ message, id }: { message: string | null; id?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm text-danger">
      {message}
    </p>
  );
}

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink-100">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-ink-400">{hint}</p> : null}
    </div>
  );
}
