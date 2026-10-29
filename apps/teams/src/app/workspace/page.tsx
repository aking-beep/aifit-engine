import Link from 'next/link';
import { redirect } from 'next/navigation';
import { OUTCOME_LABEL } from '@aifit/decision-core';
import { can, readAudit, readEntitlements, readOrgProfile, subscriptionState } from '@aifit/platform';
import { ArcCta, Banner, EmptyState, EvidenceLabel, PageHeader, Panel, PanelHeader, VerdictChip, verdictFromOutcome, VERDICT_META, type Verdict } from '@/design';
import { compactUsd } from '@/components/assessment/bits';
import { billing, currentViewer, storeResolution } from '@/server/platform';
import { portfolio } from '@/server/portfolio';
import { ARC_LINKS } from '@/lib/arc';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Workspace — AI Fit Teams' };

const ORDER: Verdict[] = ['no-ai', 'software', 'automation', 'buy', 'build'];
const BAR: Record<Verdict, string> = { 'no-ai': 'bg-v-noai', software: 'bg-v-software', automation: 'bg-v-automation', buy: 'bg-v-buy', build: 'bg-v-build' };

export default async function WorkspaceOverview() {
  const { store } = storeResolution();
  if (!store) return null;
  const v = await currentViewer();
  if (!v) redirect('/signin?next=/workspace');
  const [rows, ent, profile] = await Promise.all([portfolio(store, v.ctx), readEntitlements(store, v.ctx.orgId), readOrgProfile(store, v.ctx)]);
  const auditRows = can(v.ctx.role, 'audit:read') ? await readAudit(store, v.ctx, 8) : null;
  const counts = Object.fromEntries(ORDER.map((k) => [k, rows.filter((r) => verdictFromOutcome(r.outcome) === k).length])) as Record<Verdict, number>;
  const aiRows = rows.filter((r) => r.outcome === 'buy_ai' || r.outcome === 'build_ai');
  const runLow = aiRows.reduce((n, r) => n + (r.monthly?.low ?? 0), 0);
  const runHigh = aiRows.reduce((n, r) => n + (r.monthly?.high ?? 0), 0);
  const blocking = rows.reduce((n, r) => n + r.blockingControls, 0);
  const cfg = billing();
  const plan = !cfg.enabled ? 'Billing off · all features' : subscriptionState(ent) === 'active' || subscriptionState(ent) === 'canceling' ? 'Workspace plan' : 'Free';

  return (
    <div className="space-y-8">
      <PageHeader
        meta={<span className="text-body-sm text-fg-muted">Signed in as {v.user.email} · your role here: {v.ctx.role} · {plan}</span>}
        title={v.org.name}
        description="Every workload you have assessed, recalculated with today's engines from its saved answers."
      />

      {cfg.mode === 'test' ? (
        <Banner tone="warn" title="Stripe test mode" action={<Link href="/workspace/billing" className="text-label-md underline underline-offset-2">Billing</Link>}>
          Use Stripe test cards. No real money moves.
        </Banner>
      ) : null}

      {!profile && can(v.ctx.role, 'members:manage') ? (
        <Banner tone="info" title="Set up your workspace profile" action={<Link href="/workspace/onboarding" className="text-label-md text-accent underline underline-offset-2">Start setup</Link>}>
          Three questions about your data, regimes and team. New intakes start from these answers.
        </Banner>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing saved yet."
          description="Run an assessment, then choose Save to workspace on the report. It appears here with every version."
          action={can(v.ctx.role, 'assessment:write') ? <Link href="/assess" className="inline-flex h-9 items-center rounded-sm bg-accent px-3.5 text-label-md text-on-accent">Assess a workload</Link> : undefined}
        />
      ) : (
        <>
          <section aria-label="Portfolio summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Workloads assessed" value={String(rows.length)} />
            <Tile label="Recommended without AI" value={`${counts['no-ai'] + counts.software + counts.automation} of ${rows.length}`} note="No change, software or automation." />
            <Tile label="AI run cost / month" value={aiRows.length ? `${compactUsd(runLow)}–${compactUsd(runHigh)}` : '—'} note={<span className="inline-flex items-center gap-1.5"><EvidenceLabel kind="estimated" /> sum of {aiRows.length} AI workload{aiRows.length === 1 ? '' : 's'}</span>} />
            <Tile label="Launch-blocking controls" value={String(blocking)} note="To verify before go-live." />
          </section>

          <Panel>
            <PanelHeader title="Recommendations across the portfolio" description="Decision engine outcome for the latest version of each workload." />
            <div className="space-y-3 p-4">
              <div className="flex h-3 overflow-hidden rounded-full bg-sunken" role="img" aria-label={ORDER.map((k) => `${VERDICT_META[k].label}: ${counts[k]}`).join(', ')}>
                {ORDER.map((k) => counts[k] ? <div key={k} className={BAR[k]} style={{ width: `${(counts[k] / rows.length) * 100}%` }} /> : null)}
              </div>
              <ul className="flex flex-wrap gap-x-5 gap-y-1 text-body-sm text-fg-2">
                {ORDER.map((k) => <li key={k} className="inline-flex items-center gap-1.5"><span aria-hidden className={`h-2 w-2 rounded-full ${BAR[k]}`} />{VERDICT_META[k].label}: {counts[k]}</li>)}
              </ul>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Recently saved" actions={<Link href="/workspace/portfolio" className="text-label-md text-accent underline underline-offset-2">Open portfolio</Link>} />
            <ul className="divide-y divide-line" aria-label="Saved assessments">
              {rows.slice(0, 6).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <Link href={`/workspace/assessments/${r.id}`} className="text-label-md text-fg underline-offset-2 hover:underline">{r.title}</Link>
                    <p className="text-body-sm text-fg-muted">
                      Version {r.version}{r.versions > 1 ? ` of ${r.versions}` : ''} · saved <time dateTime={r.createdAt}>{r.createdAt.slice(0, 10)}</time> by {r.createdBy}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <VerdictChip verdict={verdictFromOutcome(r.outcome)} />
                    <span className="text-body-sm text-fg-2">{OUTCOME_LABEL[r.outcome]}</span>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}

      <ArcCta links={ARC_LINKS} app="ai-fit-teams" placement="workspace-dashboard" title="Bring ARC in on a workload" body="ARC Transformation Group can review a saved assessment with your team, validate the figures against your systems, and deliver the build." />

      {auditRows ? (
        <Panel>
          <PanelHeader title="Recent activity" description="Visible to admins and owners." actions={<Link href="/workspace/admin" className="text-label-md text-accent underline underline-offset-2">Full log</Link>} />
          {auditRows.length === 0 ? <p className="p-4 text-body-sm text-fg-2">No activity yet.</p> : (
            <ul className="space-y-1.5 p-4 text-body-sm text-fg-2">
              {auditRows.map((r, i) => (
                <li key={i}><time dateTime={r.at} className="mr-2 font-mono text-label-sm text-fg-muted">{r.at.slice(0, 16).replace('T', ' ')}</time>{r.event}</li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}
    </div>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: React.ReactNode }) {
  return (
    <Panel className="p-4">
      <p className="text-label-sm text-fg-muted">{label}</p>
      <p className="mt-1 font-mono text-data-lg text-fg tabular">{value}</p>
      {note ? <div className="mt-1 text-body-sm text-fg-muted">{note}</div> : null}
    </Panel>
  );
}
