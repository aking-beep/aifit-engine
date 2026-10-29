'use client';

/** Small shared pieces for the workspace screens, in the AI Fit design system's styles. */

export const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
/** The design system's button and input classes, for links and native controls that cannot use <Button>. */
const BASE = `inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-sm px-3.5 py-1.5 text-label-md transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 ${FOCUS}`;
export const PRIMARY = `${BASE} bg-accent text-on-accent hover:bg-accent/90`;
export const SECONDARY = `${BASE} border border-line-strong bg-surface text-fg hover:bg-sunken`;
export const DANGER = `${BASE} border border-danger/40 text-danger hover:bg-danger/10`;
export const INPUT = `min-h-9 w-full rounded-sm border border-line-strong bg-surface px-3 py-1.5 text-body-md text-fg placeholder:text-fg-muted focus:border-accent ${FOCUS}`;

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
    <p id={id} role="alert" className="text-body-sm text-danger">
      {message}
    </p>
  );
}

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-label-md text-fg">
        {label}
      </label>
      {children}
      {hint ? <p className="text-body-sm text-fg-muted">{hint}</p> : null}
    </div>
  );
}
