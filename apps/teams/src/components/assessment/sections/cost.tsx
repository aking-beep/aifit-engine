import { Banner, EvidenceLabel, Panel, PanelHeader } from '@/design';
import type { AssessmentView } from '@/server/assessment-view';
import { Basis, Stat, compactUsd, int, usd } from '../bits';

const BASIS_EVIDENCE = { heuristic: 'estimated', benchmark: 'estimated', user_input: 'assumption', catalog: 'estimated', calibrated: 'verified', measured: 'verified' } as const;

/** Run cost, build cost, the call shape behind them, and every cost line with its basis. */
export function CostSection({ view }: { view: AssessmentView }) {
  const { a, workload, decision } = view;
  const notAi = a.suitability.verdict === 'not-ai';
  const shape = a.callShape;
  const unit = workload.volume.unitLabel;
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-headline-lg text-fg">Cost model</h1>
        <p className="mt-1.5 max-w-3xl text-body-md text-fg-muted">
          Each figure carries what it rests on. Model prices come from the dated catalog; turns, failures and retries are
          rubric priors until ARC Control has measured this pattern.
        </p>
      </header>
      <Panel className="p-4">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {notAi ? (
            <Stat label="Run cost / month" value="≈ $0" hint="No model calls; only compute you already pay for." footer={<Basis e={a.cost.perMonth} />} />
          ) : (
            <>
              <Stat label={`Run cost / ${unit}`} value={usd(a.cost.perUnit.value, 4)} hint="Per successful outcome, retries and failed attempts included." footer={<Basis e={a.cost.perUnit} />} />
              <Stat label="Run cost / month" value={usd(a.cost.perMonth.value, 2)} hint={`At ${int(workload.volume.unitsPerMonth)}/mo (your input).`} footer={<Basis e={a.cost.perMonth} />} />
            </>
          )}
          <Stat label="Build cost" value={compactUsd(a.buildCost.value)} hint="Engineering to first production traffic, at a loaded rate." footer={<Basis e={a.buildCost} />} />
          {a.cost.perMonth.low !== undefined && a.cost.perMonth.high !== undefined && !notAi ? (
            <Stat label="Monthly range" value={`${compactUsd(a.cost.perMonth.low)}–${compactUsd(a.cost.perMonth.high)}`} hint="The spread the priors allow." footer={<Basis e={a.cost.perMonth} />} />
          ) : null}
        </div>
      </Panel>

      {a.cost.wastedOnFailures.value > 0 ? (
        <Banner tone="warn" title="What the failure rate costs">
          About {usd(a.cost.wastedOnFailures.value, 2)} a month is spent on attempts that fail and get retried: real spend that produces
          nothing, and the line every per-token calculator omits.
        </Banner>
      ) : null}

      {!notAi ? (
        <Panel>
          <PanelHeader title="Call shape behind the cost" description="These five numbers drive the whole figure. Turns per outcome and failure rate are where estimates go wrong by an order of magnitude." actions={<Basis e={shape} />} />
          <dl className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-5">
            {[
              ['Turns / outcome', shape.turnsPerOutcome.toFixed(1)],
              ['Context growth / turn', `${int(shape.contextGrowthPerTurn)} tok`],
              ['Failure rate', `${(shape.failureRate * 100).toFixed(1)}%`],
              ['Retries / failure', shape.retriesPerFailure.toFixed(1)],
              ['Cache hit rate', `${Math.round(shape.cacheHitRate * 100)}%`],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-label-sm text-fg-muted">{k}</dt>
                <dd className="mt-1 font-mono text-data-md text-fg">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader title="Cost lines for the chosen option" description={`From the decision engine. Uncertainty: ${decision.costs.uncertainty}.`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-body-sm">
            <caption className="sr-only">Cost lines with their basis</caption>
            <thead>
              <tr className="border-b border-line text-left text-label-sm text-fg-muted">
                <th scope="col" className="px-4 py-2 font-medium">Line</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Low</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">High</th>
                <th scope="col" className="px-3 py-2 font-medium">Per</th>
                <th scope="col" className="px-4 py-2 font-medium">Basis</th>
              </tr>
            </thead>
            <tbody>
              {decision.costs.lines.map((l) => {
                const fmt = (n: number | null) => (n === null ? 'not known' : l.unit === 'usd' ? usd(n) : `${int(n)} h`);
                return (
                  <tr key={l.id} className="border-b border-line last:border-0">
                    <th scope="row" className="px-4 py-2 text-left font-normal text-fg-2">{l.label}</th>
                    <td className="px-3 py-2 text-right font-mono tabular text-fg">{fmt(l.low)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular text-fg">{fmt(l.high)}</td>
                    <td className="px-3 py-2 text-fg-muted">{l.period === 'month' ? 'month' : 'one-time'}</td>
                    <td className="px-4 py-2"><span className="inline-flex items-center gap-2"><EvidenceLabel kind={BASIS_EVIDENCE[l.basis]} /><span className="text-label-sm text-fg-muted">{l.source}</span></span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      {decision.costs.hoursSavedPerMonth !== null ? (
        <p className="text-body-sm text-fg-muted">Hours a month the decision engine counts as recoverable, from your volume and minutes per unit: {int(decision.costs.hoursSavedPerMonth)}.</p>
      ) : null}
    </div>
  );
}
