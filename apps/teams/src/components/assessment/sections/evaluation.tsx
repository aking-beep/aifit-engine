import { GOLDEN_SET_RULE } from '@aifit/teams-core';
import { Banner, EvalResults, Panel, PanelHeader } from '@/design';
import type { AssessmentView } from '@/server/assessment-view';
import { int } from '../bits';

/**
 * The evaluation plan. AI Fit plans evaluations; it does not run them against
 * your system, so every check is "Not tested" until you measure it. There is
 * no run button here, because a run here would be a pretend result.
 */
export function EvaluationSection({ view }: { view: AssessmentView }) {
  const e = view.a.evaluation;
  const deterministic = e.kind === 'deterministic';
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-headline-lg text-fg">{deterministic ? 'Test plan' : 'Evaluation plan'}</h1>
        <p className="mt-1.5 max-w-3xl text-body-md text-fg-muted">
          {deterministic
            ? 'A rule has a right answer, so it is tested like code. There is no golden set to label.'
            : 'What has to be true before this is allowed to carry production traffic.'}
        </p>
      </header>
      <Banner tone="info" title="Nothing here has been measured yet">
        These are acceptance criteria, not results. Run them in your sandbox or shadow environment; once ARC Control receives the
        traces, results replace "Not tested".
      </Banner>
      <div className="grid gap-4 sm:grid-cols-3">
        {e.goldenSetSize !== null ? (
          <Panel className="p-4">
            <p className="text-label-sm text-fg-muted">Golden set</p>
            <p className="mt-1 font-mono text-data-lg text-fg">{int(e.goldenSetSize)}</p>
            <p className="mt-1 text-body-sm text-fg-muted">Labelled, held out, never prompted against. {GOLDEN_SET_RULE}</p>
          </Panel>
        ) : null}
        <Panel className="p-4">
          <p className="text-label-sm text-fg-muted">Cadence</p>
          <p className="mt-1 text-body-md text-fg">{e.cadence}</p>
        </Panel>
        <Panel className="p-4">
          <p className="text-label-sm text-fg-muted">Blocking checks</p>
          <p className="mt-1 font-mono text-data-lg text-fg">{e.metrics.filter((m) => m.blocksLaunch).length} <span className="text-body-sm text-fg-muted">of {e.metrics.length}</span></p>
        </Panel>
      </div>
      <Panel>
        <PanelHeader title="Checks" description="Thresholds restate your error tolerance and latency budget; turning a tolerance into a percentage is the rubric's step." />
        <div className="p-4">
          <EvalResults checks={e.metrics.map((m, i) => ({ id: `m${i}`, name: `${m.name}${m.blocksLaunch ? ' (blocks launch)' : ''}`, metric: m.measuredHow, threshold: m.threshold, status: 'untested' as const, evidence: 'untested' as const }))} />
        </div>
      </Panel>
      <div className="grid gap-6 md:grid-cols-2">
        <Panel>
          <PanelHeader title="The baseline nobody measures" />
          <p className="p-4 text-body-sm text-fg-2">{e.humanBaselineNote}</p>
        </Panel>
        <Panel>
          <PanelHeader title="Regression policy" />
          <p className="p-4 text-body-sm text-fg-2">{e.regressionPolicy}</p>
        </Panel>
      </div>
    </div>
  );
}
