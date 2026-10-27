import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Badge, Callout, Panel } from '@aifit/ui';
import { Workload } from '@aifit/teams-core';
import { OUTCOME_LABEL } from '@aifit/decision-core';
import { PlatformError, can, checkEntitlement, getAssessment, versions } from '@aifit/platform';
import { encodeWorkload } from '@/lib/encode';
import { CheckoutButton, DeleteAssessmentButton, DownloadLink, SendToControlButton } from '@/components/workspace/controls';
import { WorkspacesUnavailable } from '@/components/workspace/unavailable';
import { billing, currentViewer, storeResolution } from '@/server/platform';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Saved assessment — AI Fit Teams' };

const LINK = 'inline-flex min-h-10 items-center rounded-lg border border-ink-600 px-4 py-2 text-sm text-ink-100 transition hover:border-ink-500 hover:bg-ink-800';

export default async function SavedAssessment({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { store, reason } = storeResolution();
  if (!store) return <WorkspacesUnavailable reason={reason} />;
  const v = await currentViewer();
  if (!v) redirect(`/signin?next=/workspace/assessments/${encodeURIComponent(id)}`);
  const rec = await getAssessment(store, v.ctx, id).catch((e) => {
    if (e instanceof PlatformError && e.code === 'not_found') notFound();
    throw e;
  });
  const history = await versions(store, v.ctx, rec.rootId);
  const latest = history[history.length - 1]!;
  const encoded = encodeWorkload(Workload.parse(rec.workload));
  const cfg = billing();
  const mayDownload = can(v.ctx.role, 'export:download');
  const entitlement = mayDownload ? await checkEntitlement(store, v.ctx, cfg, 'blueprint', rec.rootId) : null;
  const controlEntitlement = mayDownload ? await checkEntitlement(store, v.ctx, cfg, 'control-export', rec.rootId) : null;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs text-ink-400"><Link href="/workspace" className="underline underline-offset-2">{v.org.name}</Link> / saved assessment</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink-100">{rec.title}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="neutral">Version {rec.version}</Badge>
          <Badge tone="neutral">{rec.snapshot.verdict}</Badge>
          <Badge tone="neutral">{OUTCOME_LABEL[rec.snapshot.outcome as keyof typeof OUTCOME_LABEL] ?? rec.snapshot.outcome}</Badge>
          <Badge tone="neutral">{rec.snapshot.pattern}</Badge>
        </div>
        {latest.id !== rec.id ? (
          <div className="mt-4"><Callout tone="info" title="A newer version exists"><Link href={`/workspace/assessments/${latest.id}`} className="underline underline-offset-2">Open version {latest.version}</Link></Callout></div>
        ) : null}
      </header>

      <Panel title="Report">
        <div className="flex flex-wrap gap-2">
          <Link href={`/report?w=${encodeURIComponent(encoded)}`} className={LINK}>Open the full report</Link>
          {can(v.ctx.role, 'assessment:write') ? (
            <Link href={`/assess?w=${encodeURIComponent(encoded)}&reassess=${encodeURIComponent(latest.id)}`} className={LINK}>Reassess (save as version {history.length + 1})</Link>
          ) : null}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-ink-400">
          Saved with decision engine {rec.snapshot.engines.decision ?? '?'} ({rec.snapshot.engines.decisionRules ?? '?'}), input {rec.snapshot.decisionInputHash.slice(0, 12)}. The
          report is recalculated with today&apos;s engines; if the rules changed since this was saved, the snapshot above is what it said then.
        </p>
      </Panel>

      <Panel title="Deliverables" subtitle="Technical blueprint (JSON and Markdown) and the governance export for ARC Control.">
        {!mayDownload ? (
          <p className="text-sm text-ink-300">Viewers can read reports but not download deliverables. Ask an admin for the member role.</p>
        ) : (
          <div className="space-y-4">
            {entitlement?.allowed ? (
              <div className="flex flex-wrap gap-2">
                <DownloadLink href={`/api/assessments/${rec.id}/blueprint?format=md`} label="Blueprint (Markdown)" />
                <DownloadLink href={`/api/assessments/${rec.id}/blueprint?format=json`} label="Blueprint (JSON)" />
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-ink-300">{entitlement?.reason}</p>
                {cfg.enabled && cfg.prices.blueprint ? <CheckoutButton product="blueprint" assessmentId={rec.id} label="Buy this blueprint" /> : null}
              </div>
            )}
            {controlEntitlement?.allowed ? (
              <div className="space-y-2 border-t border-ink-800 pt-4">
                <div className="flex flex-wrap gap-2">
                  <DownloadLink href={`/api/assessments/${rec.id}/control-export`} label="Governance export (JSON)" />
                  {can(v.ctx.role, 'members:manage') ? <SendToControlButton id={rec.id} /> : null}
                </div>
                <p className="text-xs leading-relaxed text-ink-400">
                  Recommendations only: requirements, suggested policies, agent inventory and the evaluation plan. Nothing in it is an
                  enforced control or a compliance attestation.
                </p>
              </div>
            ) : (
              <p className="border-t border-ink-800 pt-4 text-sm text-ink-300">{controlEntitlement?.reason}</p>
            )}
            <p className="text-xs text-ink-400">To save as PDF, open the full report and use Print.</p>
          </div>
        )}
      </Panel>

      <Panel title="Versions">
        <ol className="space-y-2 text-sm">
          {history.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-3">
              <Link href={`/workspace/assessments/${h.id}`} aria-current={h.id === rec.id ? 'page' : undefined} className={h.id === rec.id ? 'font-medium text-ink-100' : 'text-ink-300 underline underline-offset-2'}>
                Version {h.version}
              </Link>
              <span className="text-xs text-ink-400">{h.createdAt.slice(0, 10)} · {h.snapshot.verdict} · {OUTCOME_LABEL[h.snapshot.outcome as keyof typeof OUTCOME_LABEL] ?? h.snapshot.outcome}</span>
            </li>
          ))}
        </ol>
      </Panel>

      {can(v.ctx.role, 'assessment:delete') ? <DeleteAssessmentButton id={rec.id} /> : null}
    </div>
  );
}
