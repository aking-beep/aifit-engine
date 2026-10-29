import { Panel, PanelHeader } from '@/design';
import type { AssessmentView } from '@/server/assessment-view';
import { Basis, Stat, usd } from '../bits';
import { RoiExplorer } from './roi-explorer';

/** The engine's value model, and a what-if explorer that runs the same model. */
export function RoiSection({ view }: { view: AssessmentView }) {
  const { a, workload } = view;
  const p = a.value.paybackMonths;
  const unit = workload.volume.unitLabel;
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-headline-lg text-fg">ROI</h1>
        <p className="mt-1.5 max-w-3xl text-body-md text-fg-muted">
          Where the inputs to compute value are missing, the engine says so rather than inventing a denominator. A fabricated ROI is
          worse than no ROI.
        </p>
      </header>
      <Panel className="p-4">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Payback" value={p ? `${p.value.toFixed(1)} mo` : 'Unknowable'} hint={p ? 'Months to repay the build from run savings.' : 'You did not supply what this costs today.'} footer={p ? <Basis e={p} /> : undefined} />
          <Stat label="Net / month" value={a.value.netPerMonth ? usd(a.value.netPerMonth.value) : 'Unknowable'} footer={a.value.netPerMonth ? <Basis e={a.value.netPerMonth} /> : undefined} />
          <Stat label={`Human cost / ${unit}`} value={a.value.humanCostPerUnit ? usd(a.value.humanCostPerUnit.value, 3) : 'Not supplied'} footer={a.value.humanCostPerUnit ? <Basis e={a.value.humanCostPerUnit} /> : undefined} />
          <Stat label={`AI cost / ${unit}`} value={usd(a.value.aiCostPerUnit.value, 4)} footer={<Basis e={a.value.aiCostPerUnit} />} />
        </div>
        {a.value.spendPerDollarOfValue ? (
          <p className="mt-5 border-t border-line pt-4 text-body-sm text-fg-muted">
            Inference spend per dollar of value: <span className="font-mono text-fg">{usd(a.value.spendPerDollarOfValue.value, 3)}</span>. The ratio
            to watch after launch; it degrades quietly when prompts grow or someone swaps in a bigger model.
          </p>
        ) : null}
      </Panel>
      <Panel>
        <PanelHeader title="What if" description="Change an input to see how the engine's value model responds. Nothing here is saved." />
        <div className="p-4">
          <RoiExplorer workload={workload} aiCostPerUnit={a.value.aiCostPerUnit} buildCost={a.buildCost.value} />
        </div>
      </Panel>
    </div>
  );
}
