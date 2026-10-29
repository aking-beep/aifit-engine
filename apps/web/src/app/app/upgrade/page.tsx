"use client";

import { useState } from "react";
import { Banner, PageHeader, PricingCard, plansFor } from "@/design";
import { useAccount } from "@/components/app/account-context";
import { account, AccountApiError } from "@/lib/account";

const CHANGES: [string, string, string][] = [
  ["Tool recommendations", "Top 3", "All matches"],
  ["Setup packages", "1 a month", "Unlimited"],
  ["Compare", "2 tools at a time", "Up to 12"],
  ["Assessment history", "Last 30 days", "Everything"],
  ["Saved items", "10", "200"],
];

export default function Upgrade() {
  const { me } = useAccount();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const plans = plansFor("consumer");
  const current = me.account.plan === "pro" ? "consumer-pro" : "consumer-free";
  const checkout = async () => {
    setBusy(true);
    setError(null);
    try {
      window.location.assign((await account.checkout()).url);
    } catch (err) {
      setError(err instanceof AccountApiError ? err.message : "Could not start checkout.");
      setBusy(false);
    }
  };
  return (
    <div className="space-y-8">
      <PageHeader title="Upgrade to Pro" description="For when AI is part of your daily work. Cancel any time from the billing portal." />
      {!me.account.billing.enabled ? (
        <Banner tone="info" title="Billing is off on this deployment">{me.account.billing.reason}</Banner>
      ) : me.account.billing.mode === "test" ? (
        <Banner tone="warn" title="Stripe test mode">Pay with a test card such as 4242 4242 4242 4242. No real money moves.</Banner>
      ) : null}
      {error ? <Banner tone="danger" title="Checkout did not start">{error}</Banner> : null}
      <div className="grid gap-4 md:grid-cols-2" aria-busy={busy}>
        {plans.map((p) => (
          <PricingCard key={p.id} plan={p} current={p.id === current} onSelect={p.id === "consumer-pro" && me.account.billing.pro_available && current !== "consumer-pro" ? () => void checkout() : undefined} />
        ))}
      </div>
      <p className="text-body-sm text-fg-muted">The amount charged is the one on Stripe’s checkout page. Pro turns on when Stripe confirms the payment.</p>
      <section aria-labelledby="changes-h">
        <h2 id="changes-h" className="mb-3 text-headline-md text-fg">What changes</h2>
        <div className="overflow-x-auto rounded-md border border-line bg-surface">
          <table className="w-full min-w-[420px] text-left text-body-sm">
            <caption className="sr-only">Free and Pro limits</caption>
            <thead><tr className="border-b border-line text-label-sm text-fg-muted"><th scope="col" className="p-3">Feature</th><th scope="col" className="p-3">Free</th><th scope="col" className="p-3">Pro</th></tr></thead>
            <tbody>{CHANGES.map(([f, a, b]) => <tr key={f} className="border-b border-line last:border-0"><th scope="row" className="p-3 font-normal text-fg">{f}</th><td className="p-3 text-fg-2">{a}</td><td className="p-3 text-fg">{b}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
