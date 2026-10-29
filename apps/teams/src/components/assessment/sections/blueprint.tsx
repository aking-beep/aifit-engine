import { renderBlueprint, renderControlExport } from '@aifit/deliverables';
import { Banner, EvidenceLabel, Panel, PanelHeader } from '@/design';
import { blueprintFor, deliverableAccess, governanceFor, type AssessmentView } from '@/server/assessment-view';
import { BlueprintPreview } from './blueprint-preview';

/**
 * The technical blueprint: previewed here from the same builder the download
 * uses, and downloaded only through an entitlement-checked route.
 */
export async function BlueprintSection({ view }: { view: AssessmentView }) {
  const { blueprint } = blueprintFor(view);
  const md = renderBlueprint(blueprint, 'md');
  const json = renderBlueprint(blueprint, 'json');
  const gov = renderControlExport(governanceFor(view));
  const d = await deliverableAccess(view);
  const saved = view.source.kind === 'saved' ? view.source.record : null;
  const href = saved ? `/api/assessments/${saved.id}/blueprint?format=md` : d.anonymousBlueprint ? `/api/blueprint?format=md&w=${encodeURIComponent(view.source.encoded)}` : null;
  const canDownload = saved ? Boolean(d.mayDownload && d.blueprint?.allowed) : d.anonymousBlueprint;
  const files = [
    { path: md.filename, language: 'markdown' as const, content: md.body },
    { path: json.filename, language: 'json' as const, content: json.body },
    { path: gov.filename, language: 'json' as const, content: gov.body },
  ];
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-headline-lg text-fg">Technical blueprint</h1>
        <p className="mt-1.5 max-w-3xl text-body-md text-fg-muted">
          Verdict, decision, architecture, model, costs, controls, evaluation plan and milestones in one schema-validated document,
          checked for secrets before it is served. A starting point your engineers can plan from, marked not validated.
        </p>
      </header>
      {!canDownload ? (
        <Banner tone="info" title="Preview only">
          {saved ? (d.mayDownload ? d.blueprint?.reason : 'Viewers can read the blueprint but not download it.') : 'Save this assessment to a workspace to download its blueprint.'}
        </Banner>
      ) : null}
      <BlueprintPreview files={files} downloadHref={href} canDownload={canDownload} meta={`${files.length} files · blueprint v${blueprint.version} · validation: ${blueprint.validation.status}`} />
      {saved && canDownload ? (
        <p className="text-body-sm text-fg-muted">
          JSON: <a className="underline underline-offset-2" href={`/api/assessments/${saved.id}/blueprint?format=json`}>download blueprint.json</a> · The governance export is on Governance.
        </p>
      ) : null}
      <Panel>
        <PanelHeader title="What it rests on" />
        <ul className="space-y-2 p-4 text-body-sm text-fg-2">
          <li className="flex flex-wrap items-center gap-2"><EvidenceLabel kind={blueprint.meta.calibrated ? 'verified' : 'estimated'} /> Costs: weakest basis {blueprint.meta.weakestBasis}.</li>
          <li className="flex flex-wrap items-center gap-2"><EvidenceLabel kind="untested" /> Evaluation: {blueprint.evaluation.acceptanceCriteria.length} acceptance criteria, none measured.</li>
          <li className="flex flex-wrap items-center gap-2"><EvidenceLabel kind="recommendation" /> Architecture and controls: rule-derived from your answers.</li>
        </ul>
      </Panel>
    </div>
  );
}
