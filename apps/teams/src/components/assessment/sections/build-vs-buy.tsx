import Link from 'next/link';
import { OUTCOME_LABEL, type Outcome } from '@aifit/decision-core';
import { Panel, PanelHeader, VerdictChip, verdictFromOutcome, cn } from '@/design';
import type { AssessmentView } from '@/server/assessment-view';

/**
 * Every option, every factor, the points it earned. Weights are fixed and
 * published, so they are shown, not offered as sliders: a slider here would
 * produce an answer the engine never gave.
 */
export function BuildVsBuySection({ view }: { view: AssessmentView }) {
  const d = view.decision;
  const outcomes = d.outcomeScores.map((o) => o.outcome);
  const factors = Array.from(new Set(d.outcomeScores.flatMap((o) => o.contributions.map((c) => c.factor))));
  const points = (o: Outcome, f: string) => d.outcomeScores.find((x) => x.outcome === o)!.contributions.find((c) => c.factor === f)?.points;
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-headline-lg text-fg">Build vs buy vs automate</h1>
        <p className="mt-1.5 max-w-3xl text-body-md text-fg-muted">
          Points each option earned from your answers. The rules and their weights are fixed and published
          (<span className="font-mono">{d.engine.rulesVersion}</span>); <Link href="/methodology" className="underline underline-offset-2">methodology</Link>.
        </p>
      </header>
      <Panel>
        <PanelHeader title="Options compared" description="Higher is a better fit. Ruled-out options are excluded by a hard rule, whatever their points." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-body-sm">
            <caption className="sr-only">Points per factor for each of the five options</caption>
            <thead>
              <tr className="border-b border-line text-left text-label-sm text-fg-muted">
                <th scope="col" className="px-4 py-2 font-medium">Factor</th>
                {outcomes.map((o) => (
                  <th key={o} scope="col" className={cn('px-3 py-2 text-right font-medium', o === d.outcome && 'text-fg')}>
                    <span className="inline-flex flex-col items-end gap-1">
                      <VerdictChip verdict={verdictFromOutcome(o)} />
                      <span>{OUTCOME_LABEL[o]}</span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {factors.map((f) => (
                <tr key={f} className="border-b border-line">
                  <th scope="row" className="px-4 py-2 text-left font-normal text-fg-2">{f}</th>
                  {outcomes.map((o) => {
                    const p = points(o, f);
                    return <td key={o} className="px-3 py-2 text-right font-mono tabular text-fg-2">{p === undefined ? '—' : p > 0 ? `+${p}` : p}</td>;
                  })}
                </tr>
              ))}
              <tr className="border-b border-line">
                <th scope="row" className="px-4 py-2 text-left font-medium text-fg">Score</th>
                {d.outcomeScores.map((o) => (
                  <td key={o.outcome} className={cn('px-3 py-2 text-right font-mono tabular', o.outcome === d.outcome ? 'font-medium text-fg' : 'text-fg-2')}>
                    {o.eligible ? o.score : <span className="text-fg-muted">ruled out</span>}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="px-4 py-2 text-left font-normal text-fg-muted">Ruled out by</th>
                {d.outcomeScores.map((o) => <td key={o.outcome} className="px-3 py-2 text-right font-mono text-label-sm text-fg-muted">{o.excludedBy.join(', ') || '—'}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="grid gap-6 md:grid-cols-2">
        <Panel>
          <PanelHeader title={`Risk: ${d.risk.level}`} description="Of the chosen option, from the data and actions you described." />
          <ul className="list-disc space-y-1 p-4 pl-8 text-body-sm text-fg-2">{d.risk.factors.map((f) => <li key={f}>{f}</li>)}</ul>
        </Panel>
        <Panel>
          <PanelHeader title={`Feasibility: ${d.feasibility.level}`} description="Whether your team can build and run it." />
          <ul className="list-disc space-y-1 p-4 pl-8 text-body-sm text-fg-2">{d.feasibility.factors.map((f) => <li key={f}>{f}</li>)}</ul>
        </Panel>
      </div>
      {d.requiredControls.length ? (
        <Panel>
          <PanelHeader title="Controls the chosen option requires" description="From the hard rules. These carry into Governance." />
          <ul className="list-disc space-y-1 p-4 pl-8 text-body-sm text-fg-2">{d.requiredControls.map((c) => <li key={c}>{c}</li>)}</ul>
        </Panel>
      ) : null}
      {d.assumptions.length ? (
        <p className="text-body-sm text-fg-muted">Assumptions: {d.assumptions.join(' ')}</p>
      ) : null}
    </div>
  );
}
