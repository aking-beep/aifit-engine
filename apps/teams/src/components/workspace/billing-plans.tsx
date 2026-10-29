'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BillingState, PricingCard, plansFor, type BillingStatus } from '@/design';
import { api, ErrorText } from './ui';

/**
 * Plan cards and the current state. The workspace plan starts a Stripe-hosted
 * Checkout; one-time purchases belong to an assessment, so their cards lead to
 * the portfolio to pick one. Prices come from plan configuration.
 */
export function BillingPlans({ status, renewsOn, canManage, enabled, current }: { status: BillingStatus; renewsOn?: string; canManage: boolean; enabled: boolean; current: 'teams-workspace' | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function startWorkspace() {
    if (!enabled) return setError('Billing is off on this deployment.');
    if (!canManage) return setError('Only admins and owners can change the plan.');
    setBusy(true);
    setError(null);
    const res = await api<{ url: string }>('/api/billing/checkout', { body: { product: 'team' } });
    if (!res.ok || !res.data.url) {
      setBusy(false);
      return setError(res.data.error ?? 'Checkout could not start.');
    }
    window.location.assign(res.data.url);
  }
  return (
    <div className="space-y-6">
      <BillingState status={status} renewsOn={renewsOn} onAction={status === 'free' ? () => document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' }) : undefined} />
      <div id="plans" className="grid gap-4 md:grid-cols-3">
        {plansFor('teams').map((p) => (
          <PricingCard
            key={p.id}
            plan={p}
            current={p.id === current}
            onSelect={busy ? undefined : () => (p.id === 'teams-workspace' ? startWorkspace() : router.push('/workspace/portfolio'))}
          />
        ))}
      </div>
      <ErrorText message={error} />
      <p className="text-body-sm text-fg-muted">
        Assessment and Blueprint are bought for one workload, from that workload&apos;s locked sections or Deliverables. Payment happens on
        Stripe&apos;s hosted page; this app never sees card details, and access is granted only when Stripe confirms the payment.
      </p>
    </div>
  );
}
