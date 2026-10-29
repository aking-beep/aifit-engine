import { PATTERN_LABEL } from '@aifit/teams-core';
import { Chip, Panel, PanelHeader } from '@/design';
import { graphFor, type AssessmentView } from '@/server/assessment-view';
import { Bullets } from '../bits';
import { ArchitectureView } from './architecture-view';

export function ArchitectureSection({ view }: { view: AssessmentView }) {
  const { a } = view;
  const graph = graphFor(view);
  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <Chip>{a.architecture.label}</Chip>
          <span className="font-mono text-label-sm text-fg-muted">{a.architecture.pattern}</span>
        </div>
        <h1 className="mt-2 text-headline-lg text-fg">Architecture</h1>
        <p className="mt-1.5 max-w-3xl text-body-md text-fg-muted">{a.architecture.summary}</p>
      </header>
      <ArchitectureView graph={graph} />
      <p className="text-body-sm text-fg-muted">
        Drawn from your answers by fixed rules: sources from the systems you named, a guard when sensitive data reaches a model,
        retrieval when answers depend on outside material, a human step when the model only suggests or prepares. It is a starting
        shape, not a vendor choice.
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        <Panel>
          <PanelHeader title="Components" />
          <div className="p-4"><Bullets items={a.architecture.components} /></div>
        </Panel>
        <Panel>
          <PanelHeader title="Rejected, and why" />
          <ul className="space-y-3 p-4">
            {a.architecture.rejected.map((r) => (
              <li key={r.pattern}>
                <p className="text-label-md text-fg">{PATTERN_LABEL[r.pattern] ?? r.pattern}</p>
                <p className="mt-0.5 text-body-sm text-fg-2">{r.why}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
