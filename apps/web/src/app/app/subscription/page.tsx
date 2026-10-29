"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Banner, Button, KeyValue, PageHeader, Panel, PanelHeader, formatMoney } from "@/design";
import { useAccount } from "@/components/app/account-context";
import { Loading, LoadError, date } from "@/components/app/bits";
import { useLoad } from "@/components/app/use-load";
import { account, AccountApiError, planLabel, type SubState } from "@/lib/account";

const STATE: Record<SubState, { tone: "info" | "success" | "warn" | "danger"; title: string; body: string }> = {
  none: { tone: "info", title: "You’re on the Free plan", body: "Upgrade for every recommendation, unlimited setup packages and full history." },
  active: { tone: "success", title: "Pro is active", body: "Every feature is unlocked." },
  canceling: { tone: "warn", title: "Pro ends at the end of this period", body: "You keep Pro until then. Resume from the billing portal to keep it." },
  past_due: { tone: "warn", title: "Payment failed", body: "Pro is paused until the card is updated. Stripe retries automatically." },
  canceled: { tone: "info", title: "Pro has ended", body: "You are back on the Free plan. Your history and saved items are kept." },
  expired: { tone: "info", title: "Pro has expired", body: "No renewal payment was recorded. You are on the Free plan." },
  refunded: { tone: "info", title: "Payment refunded", body: "The last Pro payment was refunded, so Pro access ended." },
};

function CheckoutReturn({ onPaid }: { onPaid: () => void }) {
  const params = useSearchParams();
  const status = params.get("status");
  const session = params.get("session_id");
  const [state, setState] = useState<string>(status === "success" ? "pending" : "");
  useEffect(() => {
    if (status !== "success" || !session) return;
    let tries = 0;
    const tick = async () => {
      const r = await account.checkoutStatus(session).catch(() => ({ status: "unknown" }));
      setState(r.status);
      if (r.status === "paid") onPaid();
      else if (++tries < 15 && r.status !== "failed" && r.status !== "expired") setTimeout(tick, 2000);
    };
    void tick();
  }, [status, session, onPaid]);
  if (status === "cancelled") return <Banner tone="info" title="Checkout canceled">Nothing was charged.</Banner>;
  if (status !== "success") return null;
  if (state === "paid") return <Banner tone="success" title="Payment confirmed">Stripe confirmed the payment. Pro is on.</Banner>;
  if (state === "failed" || state === "expired") return <Banner tone="danger" title="Payment did not complete">Nothing was granted. Try again from Upgrade.</Banner>;
  return <Banner tone="info" title="Waiting for Stripe to confirm the payment">Pro turns on when Stripe’s confirmation reaches us, usually within seconds. The redirect alone grants nothing.</Banner>;
}

export default function Subscription() {
  const { me, refresh } = useAccount();
  const { data, error, loading, reload } = useLoad(() => account.billing());
  const [portalError, setPortalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (loading) return <Loading label="Loading subscription" />;
  if (error || !data) return <LoadError message={error ?? "No data."} />;
  const billingOff = !data.billing.enabled;
  const s = STATE[data.state];
  const portal = async () => {
    setBusy(true);
    try {
      window.location.assign((await account.portal()).url);
    } catch (err) {
      setPortalError(err instanceof AccountApiError ? err.message : "Could not open the billing portal.");
      setBusy(false);
    }
  };
  const onPaid = () => {
    void reload();
    void refresh();
  };
  return (
    <div className="space-y-6">
      <PageHeader title="Subscription" description="Your plan, its status and every payment Stripe has reported." />
      <Suspense><CheckoutReturn onPaid={onPaid} /></Suspense>
      {billingOff ? (
        <Banner tone="info" title="Billing is off on this deployment">{data.billing.reason}</Banner>
      ) : (
        <Banner tone={s.tone} title={s.title} action={data.state === "none" || data.state === "canceled" || data.state === "expired" || data.state === "refunded" ? <Link href="/app/upgrade" className="text-label-md underline underline-offset-2">See Pro</Link> : undefined}>{s.body}</Banner>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Current plan" />
          <dl className="p-4">
            <KeyValue label="Plan">{planLabel(me.account)}</KeyValue>
            <KeyValue label="Status">{billingOff ? "Billing off" : data.state.replace("_", " ")}</KeyValue>
            <KeyValue label={data.cancel_at_period_end || data.state === "canceling" ? "Ends" : "Renews"}>{data.current_period_end ? <span className="font-mono">{date(data.current_period_end)}</span> : "—"}</KeyValue>
            <KeyValue label="Setup packages this month">{data.limits.config_packages_per_month === null ? `${data.usage.config_packages_this_month} (unlimited)` : `${data.usage.config_packages_this_month} of ${data.limits.config_packages_per_month}`}</KeyValue>
          </dl>
        </Panel>
        <Panel>
          <PanelHeader title="Manage" />
          <div className="space-y-3 p-4">
            <p className="text-body-sm text-fg-2">Cancel, resume or change your card in Stripe’s billing portal. Changes reach this page through Stripe’s webhooks.</p>
            <Button onClick={portal} loading={busy} disabled={billingOff || data.state === "none"}>Open billing portal</Button>
            {portalError ? <p role="alert" className="text-body-sm text-danger">{portalError}</p> : null}
          </div>
        </Panel>
      </div>
      <section aria-labelledby="payments-h">
        <h2 id="payments-h" className="mb-3 text-headline-md text-fg">Payment history</h2>
        {data.payments.length === 0 ? (
          <p className="text-body-sm text-fg-muted">No payments yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-line bg-surface">
            <table className="w-full min-w-[480px] text-left text-body-sm">
              <caption className="sr-only">Payments</caption>
              <thead><tr className="border-b border-line text-label-sm text-fg-muted"><th scope="col" className="p-3">Date</th><th scope="col" className="p-3">Type</th><th scope="col" className="p-3">Amount</th><th scope="col" className="p-3">Status</th></tr></thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr key={`${p.kind}-${p.id}`} className="border-b border-line last:border-0">
                    <td className="p-3 font-mono text-fg-2">{date(p.at)}</td>
                    <td className="p-3 text-fg-2">{p.kind}</td>
                    <td className="p-3 font-mono text-fg">{p.amount === null ? "—" : formatMoney(p.amount / 100, (p.currency ?? "usd").toUpperCase())}</td>
                    <td className={p.status === "failed" ? "p-3 text-danger" : "p-3 text-fg-2"}>{p.status.replace("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
