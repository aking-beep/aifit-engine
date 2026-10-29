import { EvidenceLabel, Panel, PanelHeader } from '@/design';
import type { AssessmentView } from '@/server/assessment-view';

const RESIDENCY = {
  any: 'No residency requirement given. Any region the providers offer.',
  us: 'Keep processing and storage in US regions, including the model provider’s.',
  eu: 'Keep processing and storage in EU regions, including the model provider’s; confirm the provider offers EU processing.',
  on_prem: 'Run on your own infrastructure. Hosted model APIs are out unless they offer a private deployment you control.',
} as const;

/**
 * Infrastructure requirements implied by the answers: where it may run, what
 * must exist around it, and the environments the roadmap moves through.
 * Requirements, not product picks; every row is a recommendation.
 */
export function InfrastructureSection({ view }: { view: AssessmentView }) {
  const { a, workload } = view;
  const modelFree = a.model === null;
  const sensitive = workload.dataClasses.filter((d) => !['public', 'internal'].includes(d));
  const rows: { area: string; requirement: string }[] = [
    { area: 'Hosting and residency', requirement: RESIDENCY[workload.dataResidency] },
    { area: 'Entry point', requirement: 'One authenticated service entry point that logs every request and enforces rate and spend limits.' },
    ...(modelFree ? [] : [{ area: 'Model access', requirement: `${a.model!.primary.displayName} through the provider’s API or an approved cloud gateway, with keys in a secrets manager and per-environment budgets.` }]),
    ...(workload.input.requiresExternalKnowledge && !modelFree ? [{ area: 'Retrieval store', requirement: 'An index of the source material, access-controlled like its source, refreshed on a schedule you can audit.' }] : []),
    ...(sensitive.length ? [{ area: 'Sensitive data', requirement: `Redaction or tokenisation of ${sensitive.join(', ')} before any third-party call; encryption at rest and in transit.` }] : []),
    { area: 'Observability', requirement: modelFree ? 'Request logs and error rates, with alerts.' : 'Per-request traces with cost, latency and outcome; prompts logged only after redaction. ARC Control can ingest these.' },
    { area: 'Variability', requirement: workload.volume.variability === 'steady' ? 'Steady load: fixed capacity is fine.' : `${workload.volume.variability === 'bursty' ? 'Bursty' : 'Seasonal'} load: autoscale or queue, and budget for the peak.` },
  ];
  const envs = [
    { name: 'Sandbox', what: 'Synthetic or redacted data only. Where the evaluation set is built.' },
    ...(modelFree ? [] : [{ name: 'Shadow', what: 'Real inputs, outputs not used. Measures quality and cost against the acceptance criteria.' }]),
    { name: 'Production', what: modelFree ? 'Release behind a flag; roll back by switching it off.' : 'Staged rollout behind a flag, widening only while the blocking metrics hold.' },
  ];
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-headline-lg text-fg">Infrastructure</h1>
        <p className="mt-1.5 max-w-3xl text-body-md text-fg-muted">What has to exist for this to run safely, from your answers. These are requirements; pick the products that meet them.</p>
      </header>
      <Panel>
        <PanelHeader title="Requirements" />
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.area} className="grid gap-1 p-4 sm:grid-cols-[200px_1fr_auto] sm:items-start sm:gap-4">
              <span className="text-label-md text-fg">{r.area}</span>
              <span className="text-body-sm text-fg-2">{r.requirement}</span>
              <EvidenceLabel kind="recommendation" />
            </li>
          ))}
        </ul>
      </Panel>
      <Panel>
        <PanelHeader title="Environments" />
        <ol className="grid gap-4 p-4 md:grid-cols-3">
          {envs.map((e, i) => (
            <li key={e.name} className="rounded-sm border border-line p-3">
              <p className="text-label-md text-fg">{i + 1}. {e.name}</p>
              <p className="mt-1 text-body-sm text-fg-2">{e.what}</p>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}
