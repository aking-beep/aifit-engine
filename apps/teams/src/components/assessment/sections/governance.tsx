import { can } from '@aifit/platform';
import { Banner, Chip, EvidenceLabel, Panel, PanelHeader, ProgressBar } from '@/design';
import { DownloadLink, SendToControlButton } from '@/components/workspace/controls';
import { deliverableAccess, governanceFor, type AssessmentView } from '@/server/assessment-view';

const RULE_TEXT = (r: { kind: string } & Record<string, unknown>): string => {
  switch (r.kind) {
    case 'require_human_approval': return `Human approval before: ${(r.actions as string[]).join(', ')}`;
    case 'redact_data_classes': return `Redact before any model call: ${(r.dataClasses as string[]).join(', ')}`;
    case 'deny_data_classes': return `Never send: ${(r.dataClasses as string[]).join(', ')}`;
    case 'monthly_spend_cap': return `Monthly spend cap: $${Math.round(r.usd as number)} (${r.basis as string})`;
    case 'turn_cap': return `At most ${r.maxTurnsPerOutcome as number} turns per outcome`;
    case 'data_residency': return `Process and store only in: ${r.region as string}`;
    case 'tool_allow_list': return `Allowed tools: ${(r.tools as string[]).join(', ')}`;
    default: return r.kind;
  }
};

/**
 * What has to be true before go-live, as requirements. AI Fit identifies them;
 * it never verifies a customer control, so every one starts unverified.
 */
export async function GovernanceSection({ view }: { view: AssessmentView }) {
  const doc = governanceFor(view);
  const reqs = doc.governanceRequirements;
  const blocking = reqs.filter((r) => r.severity === 'blocking');
  const d = await deliverableAccess(view);
  const saved = view.source.kind === 'saved' ? view.source.record : null;
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-headline-lg text-fg">Governance</h1>
        <p className="mt-1.5 max-w-3xl text-body-md text-fg-muted">Requirements and suggested policies for this workload, in the same form ARC Control imports.</p>
      </header>
      <Banner tone="info" title="Recommended, not enforced">
        AI Fit identifies controls and gaps. It does not certify compliance or verify your controls: the owner of every requirement
        below is you. Confirm regulatory obligations with your legal team.
      </Banner>
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Panel>
          <PanelHeader title="Requirements" description={`${reqs.length} total, ${blocking.length} block go-live.`} />
          <ul className="divide-y divide-line">
            {reqs.map((r) => (
              <li key={r.id} className="space-y-1.5 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-label-sm text-fg-muted">{r.id}</span>
                  {r.severity === 'blocking' ? <Chip className="text-danger">blocks go-live</Chip> : <Chip>recommended</Chip>}
                  <Chip>{r.source}</Chip>
                  <EvidenceLabel kind="untested" />
                </div>
                <p className="text-body-md text-fg">{r.requirement}</p>
                <p className="text-body-sm text-fg-2">{r.rationale}</p>
                <p className="text-body-sm text-fg-muted">Verify by: {r.verification.method}</p>
              </li>
            ))}
          </ul>
        </Panel>
        <aside className="space-y-4">
          <Panel className="p-4">
            <p className="text-label-sm text-fg-muted">Verified</p>
            <p className="mt-1 font-mono text-data-lg text-fg">0 of {reqs.length}</p>
            <ProgressBar value={0} tone="neutral" label="Requirements verified" className="mt-2" />
            <p className="mt-2 text-body-sm text-fg-muted">Verification happens in your environment; ARC Control records it once deployed.</p>
          </Panel>
          <Panel className="space-y-3 p-4">
            <p className="text-title-md text-fg">Export to ARC Control</p>
            {saved && d.control?.allowed ? (
              <div className="flex flex-col gap-2">
                <DownloadLink href={`/api/assessments/${saved.id}/control-export`} label="Governance export (JSON)" />
                {view.viewer && can(view.viewer.ctx.role, 'members:manage') ? <SendToControlButton id={saved.id} /> : null}
              </div>
            ) : (
              <p className="text-body-sm text-fg-2">{saved ? d.control?.reason ?? 'Members and above can export.' : 'Save this assessment to a workspace to export it.'}</p>
            )}
            <p className="text-body-sm text-fg-muted">GovernanceExport v1, marked recommended-not-enforced.</p>
          </Panel>
        </aside>
      </div>
      {doc.policySuggestions.length ? (
        <Panel>
          <PanelHeader title="Suggested policies" description="Machine-readable rules ARC Control can enforce once you adopt them." />
          <ul className="divide-y divide-line">
            {doc.policySuggestions.map((p) => (
              <li key={p.id} className="p-4">
                <p className="text-label-md text-fg">{p.title}</p>
                <p className="mt-0.5 font-mono text-body-sm text-fg-2">{RULE_TEXT(p.rule as never)}</p>
                <p className="mt-1 text-body-sm text-fg-muted">{p.rationale}</p>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
      {doc.agentInventory.required ? (
        <Panel>
          <PanelHeader title="Agent inventory" description="What a governance tool would register for this workload." />
          <ul className="divide-y divide-line">
            {doc.agentInventory.entries.map((e, i) => (
              <li key={i} className="p-4 text-body-sm text-fg-2">
                <p className="text-label-md text-fg">{e.name}</p>
                <p>Autonomy: {e.autonomy} · model: {e.modelId ?? 'none'} · data: {e.dataClasses.join(', ') || 'none'}</p>
                {e.tools.length ? <p>Tools: {e.tools.map((t) => `${t.name}${t.write ? ' (writes)' : ''}${t.approvalRequired ? ', approval required' : ''}`).join('; ')}</p> : null}
                <p className="text-fg-muted">Owner: not assigned</p>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
