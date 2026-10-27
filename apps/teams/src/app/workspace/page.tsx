import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, Callout, Panel } from '@aifit/ui';
import { can, listAssessments, listMembers, readAudit, readEntitlements } from '@aifit/platform';
import { OUTCOME_LABEL } from '@aifit/decision-core';
import { MembersPanel } from '@/components/workspace/members';
import { CheckoutButton, SignOutButton, WorkspaceSwitcher } from '@/components/workspace/controls';
import { WorkspacesUnavailable } from '@/components/workspace/unavailable';
import { billing, currentViewer, storeResolution } from '@/server/platform';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Workspace — AI Fit Teams' };

export default async function WorkspacePage() {
  const { store, reason } = storeResolution();
  if (!store) return <WorkspacesUnavailable reason={reason} />;
  const v = await currentViewer();
  if (!v) redirect('/signin?next=/workspace');
  const cfg = billing();
  const [assessments, members, ent] = await Promise.all([listAssessments(store, v.ctx), listMembers(store, v.ctx), readEntitlements(store, v.ctx.orgId)]);
  const auditRows = can(v.ctx.role, 'audit:read') ? await readAudit(store, v.ctx, 15) : null;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-ink-400">Signed in as {v.user.email}</p>
          <h1 className="mt-1 text-3xl font-semibold text-ink-100">{v.org.name}</h1>
          <p className="mt-1 text-sm text-ink-300">Your role here: {v.ctx.role}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {v.orgs.length > 1 ? <WorkspaceSwitcher orgs={v.orgs} activeId={v.org.id} /> : null}
          <Link href="/account" className="inline-flex min-h-10 items-center px-2 text-sm text-ink-300 underline underline-offset-2 hover:text-ink-100">Account</Link>
          <SignOutButton />
        </div>
      </header>

      <Panel
        title="Saved assessments"
        subtitle="Each keeps its answers and every version. Reports are recalculated from the saved answers when opened."
        right={can(v.ctx.role, 'assessment:write') ? <Link href="/assess" className="text-signal underline underline-offset-2">New assessment</Link> : null}
      >
        {assessments.length === 0 ? (
          <p className="text-sm text-ink-300">
            Nothing saved yet. Run an assessment, then choose <span className="text-ink-100">Save to workspace</span> on the report.
          </p>
        ) : (
          <ul className="divide-y divide-ink-800" aria-label="Saved assessments">
            {assessments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Link href={`/workspace/assessments/${a.id}`} className="text-sm font-medium text-ink-100 underline-offset-2 hover:underline">
                    {a.title}
                  </Link>
                  <p className="text-xs text-ink-400">
                    Version {a.version}{a.versions > 1 ? ` of ${a.versions}` : ''} · saved <time dateTime={a.createdAt}>{a.createdAt.slice(0, 10)}</time>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="neutral">{a.snapshot.verdict}</Badge>
                  <Badge tone="neutral">{OUTCOME_LABEL[a.snapshot.outcome as keyof typeof OUTCOME_LABEL] ?? a.snapshot.outcome}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Team" subtitle="Only members of this workspace can see its assessments.">
        <MembersPanel members={members} canManage={can(v.ctx.role, 'members:manage')} selfId={v.user.id} />
      </Panel>

      <Panel title="Plan and billing">
        {!cfg.enabled ? (
          <p className="text-sm text-ink-300">{cfg.reason}</p>
        ) : (
          <div className="space-y-3 text-sm text-ink-300">
            {cfg.mode === 'test' ? <Callout tone="warn" title="Test mode">Stripe test mode: use Stripe test cards. No real money moves.</Callout> : null}
            <p>
              Plan: <span className="text-ink-100">{ent.plan === 'team' ? 'Team' : 'Free'}</span>
              {ent.subscription ? ` · subscription ${ent.subscription.status}` : ''}
              {ent.purchases.length ? ` · ${ent.purchases.length} blueprint purchase${ent.purchases.length === 1 ? '' : 's'}` : ''}
            </p>
            {ent.subscription?.status === 'past_due' ? (
              <Callout tone="danger" title="Payment failed">Team features are paused until the card is updated in Stripe.</Callout>
            ) : null}
            {ent.plan !== 'team' && can(v.ctx.role, 'billing:manage') && cfg.prices.teamMonthly ? (
              <CheckoutButton product="team" label="Start the team plan" />
            ) : null}
            <p className="text-xs text-ink-400">Payments are handled on Stripe&apos;s hosted page; this app never sees card details.</p>
          </div>
        )}
      </Panel>

      {auditRows ? (
        <Panel title="Recent activity" subtitle="Visible to admins and owners.">
          {auditRows.length === 0 ? <p className="text-sm text-ink-300">No activity yet.</p> : (
            <ul className="space-y-1 text-xs text-ink-300">
              {auditRows.map((r, i) => (
                <li key={i}><time dateTime={r.at} className="font-mono text-ink-400">{r.at.slice(0, 16).replace('T', ' ')}</time> {r.event}</li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}
    </div>
  );
}
