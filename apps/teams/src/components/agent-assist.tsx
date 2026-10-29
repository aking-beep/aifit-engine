'use client';

import { useEffect, useState } from 'react';
import type { IntakeState } from '@/lib/intake-state';
import { describePatch, patchFromSuggestion, SUGGESTION_LABEL, type AgentSuggestion } from '@/lib/intake-suggestions';

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
const BTN = 'inline-flex min-h-10 items-center rounded-lg border border-line-strong px-4 py-2 text-sm text-fg transition hover:border-line-strong hover:bg-sunken disabled:opacity-60 ' + FOCUS;

/**
 * Optional AI assistance. Rendered only when the server reports agents on.
 * Suggestions show the words they came from and change the form only when
 * the person clicks Apply; the explanation is labelled AI-written and cannot
 * change the report, which the rules produced.
 */

let status: Promise<boolean> | null = null;
export function useAgentsEnabled(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    status ??= fetch('/api/agents').then((r) => (r.ok ? r.json() : { enabled: false })).then((s) => s.enabled === true, () => false);
    void status.then((v) => live && setOn(v));
    return () => {
      live = false;
    };
  }, []);
  return on;
}

type Patch = Partial<IntakeState>;

export function SuggestAnswers({ s, apply }: { s: IntakeState; apply: (p: Patch) => void }) {
  const [state, setState] = useState<
    { kind: 'idle' } | { kind: 'loading' } | { kind: 'message'; text: string } | { kind: 'done'; items: AgentSuggestion[]; questions: string[] }
  >({ kind: 'idle' });
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const text = [s.name, s.description].filter((x) => x.trim()).join('. ').trim();

  async function run() {
    if (text.length < 10) {
      setState({ kind: 'message', text: 'Describe how the job works today first.' });
      return;
    }
    setState({ kind: 'loading' });
    setApplied(new Set());
    try {
      const res = await fetch('/api/agents/intake', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: text.slice(0, 4000) }) });
      const r = (await res.json()) as { status?: string; suggestions?: AgentSuggestion[]; questions?: string[]; error?: string };
      if (!res.ok) setState({ kind: 'message', text: r.error ?? 'Suggestions are not available right now.' });
      else if (r.status !== 'ok') setState({ kind: 'message', text: 'No suggestions this time. The form works the same without them.' });
      else setState({ kind: 'done', items: r.suggestions ?? [], questions: r.questions ?? [] });
    } catch {
      setState({ kind: 'message', text: 'Suggestions are not available right now.' });
    }
  }

  const offers = state.kind === 'done'
    ? state.items.map((item) => ({ item, patch: patchFromSuggestion(item, s) })).filter((o): o is { item: AgentSuggestion; patch: Patch } => o.patch !== null)
    : [];

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-line-strong p-4 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={run} disabled={state.kind === 'loading'} className={BTN}>
          {state.kind === 'loading' ? 'Reading…' : 'Suggest answers from this description'}
        </button>
        <span className="text-xs text-fg-2">AI-written. The name and description are sent to Anthropic&apos;s API and not stored.</span>
      </div>
      <div aria-live="polite" className="space-y-3">
        {state.kind === 'message' ? <p className="text-fg-2">{state.text}</p> : null}
        {state.kind === 'done' && offers.length === 0 && state.questions.length === 0 ? (
          <p className="text-fg-2">The description did not clearly answer any of this form&apos;s questions.</p>
        ) : null}
        {offers.length ? (
          <ul className="space-y-2" aria-label="Suggested answers">
            {offers.map(({ item, patch }) => (
              <li key={item.field} className="flex flex-col gap-2 rounded-md bg-sunken/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-fg"><span className="font-medium">{SUGGESTION_LABEL[item.field]}:</span> {describePatch(patch)}</p>
                  <p className="text-xs text-fg-2">Because the description says “{item.evidence}”</p>
                </div>
                <button
                  type="button"
                  className={BTN}
                  disabled={applied.has(item.field)}
                  aria-label={`${applied.has(item.field) ? "Applied" : "Apply"} ${SUGGESTION_LABEL[item.field]}: ${describePatch(patch)}`}
                  onClick={() => {
                    apply(patch);
                    setApplied((a) => new Set(a).add(item.field));
                  }}
                >
                  {applied.has(item.field) ? 'Applied' : 'Apply'}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {state.kind === 'done' && state.questions.length ? (
          <div>
            <p className="font-medium text-fg">Worth pinning down</p>
            <ul className="list-disc pl-5 text-fg-2">{state.questions.map((q) => <li key={q}>{q}</li>)}</ul>
          </div>
        ) : null}
        {offers.length ? <p className="text-xs text-fg-2">Check each answer in the steps that follow. The rules score the form, not the AI.</p> : null}
      </div>
    </div>
  );
}

export function ExplainDecision({ encoded }: { encoded: string }) {
  const [state, setState] = useState<
    { kind: 'idle' } | { kind: 'loading' } | { kind: 'failed'; text: string } | { kind: 'done'; source: 'model' | 'rules'; summary: string; keyPoints: string[] }
  >({ kind: 'idle' });
  return (
    <div className="space-y-3 rounded-lg border border-line p-4 text-sm" data-testid="explain-decision">
      {state.kind !== 'done' ? (
        <button
          type="button"
          className={BTN}
          disabled={state.kind === 'loading'}
          onClick={async () => {
            setState({ kind: 'loading' });
            try {
              const res = await fetch('/api/agents/explain', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ w: encoded }) });
              const r = await res.json();
              if (!res.ok) setState({ kind: 'failed', text: r.error ?? 'The explanation is not available right now.' });
              else setState({ kind: 'done', ...r.explanation });
            } catch {
              setState({ kind: 'failed', text: 'The explanation is not available right now.' });
            }
          }}
        >
          {state.kind === 'loading' ? 'Writing…' : 'Explain this in plain language'}
        </button>
      ) : null}
      <div aria-live="polite">
        {state.kind === 'failed' ? <p className="text-fg-2">{state.text}</p> : null}
        {state.kind === 'done' ? (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-fg-2">
              {state.source === 'model' ? 'AI-written from the decision above. It cannot change it.' : 'Written by the rules (the AI explanation was not used).'}
            </p>
            <p className="text-fg">{state.summary}</p>
            {state.keyPoints.length ? <ul className="list-disc pl-5 text-fg-2">{state.keyPoints.map((k) => <li key={k}>{k}</li>)}</ul> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
