import { EvidenceLabel, Panel, PanelHeader } from '@/design';
import type { AssessmentView } from '@/server/assessment-view';

/** Phases with durations, exit criteria and a kill criterion each. Durations are rules of thumb. */
export function RoadmapSection({ view }: { view: AssessmentView }) {
  const phases = view.a.phases;
  const total = phases.reduce((n, p) => n + p.durationWeeks, 0);
  let start = 0;
  const spans = phases.map((p) => {
    const s = { ...p, start, end: start + p.durationWeeks };
    start += p.durationWeeks;
    return s;
  });
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-headline-lg text-fg">Roadmap</h1>
        <p className="mt-1.5 max-w-3xl text-body-md text-fg-muted">
          About {total} weeks end to end. Every phase has a kill criterion: a plan without one is a commitment device.
        </p>
        <p className="mt-2"><EvidenceLabel kind="estimated" /> <span className="text-body-sm text-fg-muted">Phase durations are rules of thumb, not a delivery plan.</span></p>
      </header>
      <Panel className="p-4">
        <div role="img" aria-label={`Timeline: ${spans.map((s) => `${s.name}, weeks ${s.start + 1} to ${s.end}`).join('; ')}`} className="space-y-2">
          {spans.map((s) => (
            <div key={s.name} className="grid grid-cols-[140px_1fr] items-center gap-3 sm:grid-cols-[200px_1fr]">
              <span className="truncate text-label-md text-fg">{s.name}</span>
              <div className="relative h-6 rounded-xs bg-sunken">
                <div className="absolute inset-y-0 rounded-xs bg-accent/30 ring-1 ring-accent/50" style={{ left: `${(s.start / total) * 100}%`, width: `${(s.durationWeeks / total) * 100}%` }} />
                <span className="absolute inset-y-0 flex items-center font-mono text-label-sm text-fg" style={{ left: `calc(${(s.start / total) * 100}% + 6px)` }}>W{s.start + 1}–{s.end}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <ol className="space-y-4">
        {phases.map((p, i) => (
          <li key={p.name}>
            <Panel>
              <PanelHeader title={`${i + 1}. ${p.name}`} description={`About ${p.durationWeeks} week${p.durationWeeks === 1 ? '' : 's'}`} />
              <div className="space-y-3 p-4">
                <p className="text-body-md text-fg-2">{p.goal}</p>
                <ul className="space-y-1">
                  {p.exitCriteria.map((e, n) => <li key={n} className="text-body-sm text-fg-2">✓ {e}</li>)}
                </ul>
                <p className="text-body-sm text-danger"><span className="font-medium">Kill if:</span> {p.killCriteria}</p>
              </div>
            </Panel>
          </li>
        ))}
      </ol>
    </div>
  );
}
