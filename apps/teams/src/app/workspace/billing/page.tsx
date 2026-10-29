import { redirect } from 'next/navigation';
import Link from 'next/link';
import { can, listAssessments, paymentHistory, readEntitlements, subscriptionState } from '@aifit/platform';
import { Banner, EmptyState, PageHeader, Panel, PanelHeader, type BillingStatus } from '@/design';
import { BillingPlans } from '@/components/workspace/billing-plans';
import { billing, currentViewer, storeResolution } from '@/server/platform';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Billing — AI Fit Teams' };

const STATE: Record<ReturnType<typeof subscriptionState>, BillingStatus> = {
  none: 'free', active: 'active', canceling: 'canceled', past_due: 'past-due', canceled: 'free', expired: 'free',
};

const money = (amount: number | null, currency: string | null) =>
  amount === null || !currency ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(amount / 100);

export default async function BillingPage() {
  const { store } = storeResolution();
  if (!store) return null;
  const v = await currentViewer();
  if (!v) redirect('/signin?next=/workspace/billing');
  const cfg = billing();
  const ent = await readEntitlements(store, v.ctx.orgId);
  const state = subscriptionState(ent);
  const manage = can(v.ctx.role, 'billing:manage');
  const payments = manage ? await paymentHistory(store, v.ctx) : null;
  const titles = new Map((await listAssessments(store, v.ctx)).map((a) => [a.rootId, a.title]));
  const renews = ent.subscription?.currentPeriodEnd?.slice(0, 10);
  return (
    <div className="space-y-8">
      <PageHeader title="Billing" description="Plan, purchases and payment history for this workspace." />
      {!cfg.enabled ? (
        <Banner tone="info" title="Billing is off on this deployment">{cfg.reason}</Banner>
      ) : cfg.mode === 'test' ? (
        <Banner tone="warn" title="Stripe test mode">Use Stripe test cards (4242 4242 4242 4242). No real money moves.</Banner>
      ) : null}
      {state === 'expired' ? <Banner tone="danger" title="The workspace plan has expired">No renewal was confirmed after the paid period ended. Renew to restore workspace-wide access.</Banner> : null}
      {state === 'canceling' ? <Banner tone="info" title="Plan ends at the close of the paid period">Access continues until {renews ?? 'the period end'}.</Banner> : null}

      <BillingPlans status={STATE[state]} renewsOn={renews} canManage={manage} enabled={cfg.enabled} current={state === 'active' || state === 'canceling' ? 'teams-workspace' : null} />

      <Panel>
        <PanelHeader title="One-time purchases" description="Each unlocks one workload. A full refund removes the access it granted." />
        {ent.purchases.length === 0 ? <p className="p-4 text-body-sm text-fg-2">None yet.</p> : (
          <ul className="divide-y divide-line">
            {ent.purchases.map((p) => (
              <li key={p.checkoutSessionId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-body-sm">
                <span className="text-fg">{p.product === 'blueprint' ? 'Blueprint' : 'Assessment'} · {titles.get(p.assessmentRootId) ?? 'deleted assessment'}</span>
                <span className="text-fg-muted">{p.at.slice(0, 10)}{p.refundedAt ? ` · refunded ${p.refundedAt.slice(0, 10)}` : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Payment history" description="Recorded from verified Stripe events only." />
        {payments === null ? <p className="p-4 text-body-sm text-fg-2">Visible to admins and owners.</p> : payments.length === 0 ? (
          <div className="p-4"><EmptyState title="No payments yet" description="Payments, failed attempts and refunds appear here once Stripe reports them." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-body-sm">
              <caption className="sr-only">Payment history</caption>
              <thead>
                <tr className="border-b border-line text-left text-label-sm text-fg-muted">
                  <th scope="col" className="px-4 py-2 font-medium">Date</th>
                  <th scope="col" className="px-3 py-2 font-medium">What</th>
                  <th scope="col" className="px-3 py-2 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={`${p.kind}-${p.id}-${p.status}`} className="border-b border-line last:border-0">
                    <td className="px-4 py-2 text-fg-muted">{p.at.slice(0, 10)}</td>
                    <td className="px-3 py-2 text-fg">{p.product === 'team' ? 'Workspace plan' : p.product === 'blueprint' ? 'Blueprint' : 'Assessment'}{p.kind === 'refund' ? ' (refund)' : ''}</td>
                    <td className="px-3 py-2 text-fg-2">{p.status.replace('_', ' ')}</td>
                    <td className="px-4 py-2 text-right font-mono tabular text-fg">{money(p.amount, p.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <p className="text-body-sm text-fg-muted">
        To change the card or cancel, use the Stripe receipt links or contact support; a self-serve billing portal is not set up yet.
        Return page after checkout: <Link href="/billing" className="underline underline-offset-2">/billing</Link>.
      </p>
    </div>
  );
}
