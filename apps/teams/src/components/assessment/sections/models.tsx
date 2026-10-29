import { staleEntries, type ModelEntry } from '@aifit/teams-core';
import { Banner, EvidenceLabel, Panel, PanelHeader } from '@/design';
import type { AssessmentView } from '@/server/assessment-view';
import { Bullets, usd } from '../bits';

/**
 * The routing recommendation and the shortlist, at dated list prices. Quality
 * and latency on your workload are not known until measured, and say so.
 */
export function ModelsSection({ view }: { view: AssessmentView }) {
  const m = view.a.model;
  if (!m) {
    return (
      <div className="space-y-4">
        <h1 className="text-headline-lg text-fg">Models</h1>
        <Banner tone="info" title="No model is recommended">
          The verdict is not to use a model for this work, so the engine does not name one to buy. A deterministic implementation
          has nothing to select here.
        </Banner>
      </div>
    );
  }
  const stale = new Set(staleEntries().map((x) => x.id));
  const rows: { role: string; e: ModelEntry }[] = [
    { role: 'Primary', e: m.primary },
    ...(m.fallbackFast ? [{ role: 'Easy majority', e: m.fallbackFast }] : []),
    ...(m.escalateTo ? [{ role: 'Escalation', e: m.escalateTo }] : []),
    ...m.alternatives.map((e) => ({ role: 'Alternative', e })),
  ];
  const anyStale = rows.some((r) => stale.has(r.e.id));
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-headline-lg text-fg">Models</h1>
        <p className="mt-1.5 max-w-3xl text-body-md text-fg-muted">A shortlist across providers, so the default is not lock-in. Prices are published list prices from a dated catalog.</p>
      </header>
      {anyStale ? (
        <Banner tone="warn" title="Some list prices are past their re-check date">
          Re-verify before budgeting. The weekly catalog check reports changes; it never edits prices by itself.
        </Banner>
      ) : null}
      <Panel>
        <PanelHeader title="Routing and shortlist" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-body-sm">
            <caption className="sr-only">Recommended models with list prices</caption>
            <thead>
              <tr className="border-b border-line text-left text-label-sm text-fg-muted">
                <th scope="col" className="px-4 py-2 font-medium">Role</th>
                <th scope="col" className="px-3 py-2 font-medium">Model</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Input / 1M</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Output / 1M</th>
                <th scope="col" className="px-3 py-2 font-medium">Price evidence</th>
                <th scope="col" className="px-3 py-2 font-medium">Latency class</th>
                <th scope="col" className="px-4 py-2 font-medium">Quality on your work</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ role, e }) => (
                <tr key={`${role}-${e.id}`} className="border-b border-line last:border-0">
                  <td className="px-4 py-2 text-fg-muted">{role}</td>
                  <th scope="row" className="px-3 py-2 text-left font-medium text-fg">{e.displayName}<span className="block font-mono text-label-sm font-normal text-fg-muted">{e.provider} · {e.id}</span></th>
                  <td className="px-3 py-2 text-right font-mono tabular text-fg">{usd(e.inputPer1M, 2)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular text-fg">{usd(e.outputPer1M, 2)}</td>
                  <td className="px-3 py-2"><EvidenceLabel kind={stale.has(e.id) ? 'estimated' : 'verified'} asOf={e.asOf} />{stale.has(e.id) ? <span className="block text-label-sm text-warn">re-verify</span> : null}</td>
                  <td className="px-3 py-2 text-fg-2">{e.latencyClass}</td>
                  <td className="px-4 py-2"><EvidenceLabel kind="untested" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel>
        <PanelHeader title={`Why ${m.primary.displayName}`} />
        <div className="p-4"><Bullets items={m.rationale} /></div>
      </Panel>
      <p className="text-body-sm text-fg-muted">
        To change the choice, change what drives it (residency, latency budget, data classes, volume) in the intake and reassess;
        the engine re-routes and the cost model follows.
      </p>
    </div>
  );
}
