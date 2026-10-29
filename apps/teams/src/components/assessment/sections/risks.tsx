import { RISK_RULE } from '@aifit/deliverables';
import { risksFor, type AssessmentView } from '@/server/assessment-view';
import { RisksView } from './risks-view';

export async function RisksSection({ view }: { view: AssessmentView }) {
  const { risks, editable } = await risksFor(view);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-headline-lg text-fg">Risk register</h1>
        <p className="mt-1.5 max-w-3xl text-body-md text-fg-muted">
          One risk per security control (the risk that it is not in place) and one per unknown the engine reported. {RISK_RULE}
        </p>
      </header>
      <RisksView risks={risks} editable={editable} assessmentId={view.source.kind === 'saved' ? view.source.record.id : null} />
    </div>
  );
}
