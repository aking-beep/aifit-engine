'use client'

import React from 'react'
import { Check } from 'lucide-react'
import type { BillingStatus, PlanConfig } from './types'
import { Button } from './Button'
import { Banner } from './Feedback'
import { cn, formatPlanPrice } from './lib'

/**
 * Pricing card. Renders whatever plan config it is given — no prices or
 * entitlement logic live here. Footer is mt-auto so a row shares baselines.
 */
export function PricingCard({ plan, current, onSelect }: { plan: PlanConfig; current?: boolean; onSelect?: (plan: PlanConfig) => void }) {
  const { amount, suffix } = formatPlanPrice(plan)
  return (
    <article className={cn('flex h-full flex-col rounded-lg border bg-surface p-6', plan.highlighted ? 'border-fg' : 'border-line')}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-title-md text-fg">{plan.name}</h3>
        {current ? <span className="text-label-sm text-fg-muted">Current plan</span> : plan.highlighted ? <span className="text-label-sm text-fg-2">Most chosen</span> : null}
      </div>
      <p className="mt-1 text-body-sm text-fg-muted">{plan.tagline}</p>
      <p className="mt-5 flex items-baseline gap-1.5">
        <span className="font-mono text-data-lg text-fg tabular">{amount}</span>
        <span className="text-body-sm text-fg-muted">{suffix}</span>
      </p>
      <ul className="mt-5 flex flex-col gap-2.5 border-t border-line pt-5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-body-sm text-fg-2">
            <Check size={14} className="mt-0.5 shrink-0 text-fg-muted" />
            {f}
          </li>
        ))}
      </ul>
      {plan.limits && <p className="mt-4 text-label-sm text-fg-muted">{plan.limits}</p>}
      <div className="mt-auto pt-6">
        <Button variant={plan.highlighted && !current ? 'primary' : 'secondary'} className="w-full" disabled={current} onClick={() => onSelect?.(plan)}>
          {current ? 'Your plan' : plan.cta}
        </Button>
      </div>
    </article>
  )
}

const BILLING_COPY: Record<BillingStatus, { tone: 'info' | 'warn' | 'danger' | 'success'; title: string; body: string; action?: string }> = {
  active: { tone: 'success', title: 'Subscription active', body: 'Your plan renews automatically.' },
  trialing: { tone: 'info', title: 'Trial in progress', body: 'Add a payment method before your trial ends to keep access.', action: 'Add payment method' },
  'past-due': { tone: 'warn', title: 'Payment failed', body: 'We couldn’t charge your card. Update it within 7 days to avoid losing Pro features.', action: 'Update card' },
  canceled: { tone: 'danger', title: 'Subscription canceled', body: 'You keep access until the end of the current period.', action: 'Resume' },
  free: { tone: 'info', title: 'You’re on the Free plan', body: 'Upgrade to unlock unlimited recommendations and configs.', action: 'See plans' },
}

/** Billing state banner — one per subscription status. */
export function BillingState({ status, renewsOn, onAction }: { status: BillingStatus; renewsOn?: string; onAction?: () => void }) {
  const c = BILLING_COPY[status]
  return (
    <Banner
      tone={c.tone}
      title={c.title}
      action={
        c.action && (
          <Button size="sm" onClick={onAction}>
            {c.action}
          </Button>
        )
      }
    >
      {c.body}
      {renewsOn && status === 'active' && <> Next renewal <span className="font-mono">{renewsOn}</span>.</>}
    </Banner>
  )
}
