'use client';

import { useState } from 'react';
import Link from 'next/link';

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal';
const BTN = 'inline-flex min-h-10 items-center rounded-lg border border-ink-600 px-4 py-2 text-sm text-ink-100 transition hover:border-ink-500 hover:bg-ink-800 disabled:opacity-60 ' + FOCUS;

/**
 * Save this report to a workspace (or as a new version of a saved one), and
 * download the blueprint. Without an account the report is unaffected.
 */
export function ReportWorkspaceActions({
  encoded, workspaces, signedIn, reassessId, anonymousBlueprint,
}: {
  encoded: string;
  workspaces: boolean;
  signedIn: boolean;
  reassessId: string | null;
  /** True when billing is off, so the blueprint can be downloaded straight from the link. */
  anonymousBlueprint: boolean;
}) {
  const [state, setState] = useState<{ kind: 'idle' | 'saving' | 'saved' | 'error'; text?: string; href?: string }>({ kind: 'idle' });

  async function save() {
    setState({ kind: 'saving' });
    try {
      const res = await fetch(reassessId ? `/api/assessments/${encodeURIComponent(reassessId)}/reassess` : '/api/assessments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ w: encoded }),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; version?: number; error?: string };
      if (!res.ok || !body.id) return setState({ kind: 'error', text: body.error ?? 'Could not save.' });
      setState({ kind: 'saved', text: `Saved as version ${body.version}.`, href: `/workspace/assessments/${body.id}` });
    } catch {
      setState({ kind: 'error', text: 'Could not reach the server.' });
    }
  }

  return (
    <section aria-label="Save and download" className="space-y-3 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        {workspaces && signedIn ? (
          <button type="button" onClick={save} disabled={state.kind === 'saving' || state.kind === 'saved'} className={BTN}>
            {state.kind === 'saving' ? 'Saving…' : reassessId ? 'Save as a new version' : 'Save to workspace'}
          </button>
        ) : workspaces ? (
          <Link href="/signin?next=/workspace" className={BTN}>Sign in to save this to a workspace</Link>
        ) : null}
        {anonymousBlueprint ? (
          <>
            <a href={`/api/blueprint?format=md&w=${encodeURIComponent(encoded)}`} className={BTN} download>Download blueprint (Markdown)</a>
            <a href={`/api/blueprint?format=json&w=${encodeURIComponent(encoded)}`} className={BTN} download>Download blueprint (JSON)</a>
          </>
        ) : null}
      </div>
      <p className="text-xs text-ink-400" aria-live="polite">
        {state.kind === 'saved' && state.href ? (
          <>{state.text} <Link href={state.href} className="text-signal underline underline-offset-2">Open it in the workspace</Link></>
        ) : state.kind === 'error' ? (
          <span className="text-danger">{state.text}</span>
        ) : anonymousBlueprint ? (
          'The blueprint is built from this link on download; nothing is stored unless you save it.'
        ) : (
          'Blueprints are available for assessments saved to a workspace.'
        )}
      </p>
    </section>
  );
}
