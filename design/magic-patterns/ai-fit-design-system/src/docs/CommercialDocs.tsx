import React, { useState } from 'react'
import { BillingState, DownloadPreview, PageHeader, PricingCard, Tabs, plansFor } from '../ds'
import type { BillingStatus } from '../ds'
import { SAMPLE_PACKAGE_FILES } from '../ds/sample/consumer'
import { Doc } from './Doc'

export function CommercialDocs() {
  const [status, setStatus] = useState<BillingStatus>('past-due')
  return (
    <div>
      <PageHeader title="Pricing & downloads" description="Prices come from plan configuration, never from component code. Change the config and every surface updates." />
      <Doc name="PricingCard" usage="Renders a PlanConfig. Highlighted plans get a stronger border and the one primary button in the row." props={[['plan', 'PlanConfig — from config, not hardcoded'], ['current', 'disables the CTA'], ['onSelect', 'hand off to your checkout']]}>
        <div className="grid gap-4 md:grid-cols-2">
          {plansFor('consumer').map((p) => (
            <PricingCard key={p.id} plan={p} current={p.id === 'consumer-free'} />
          ))}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {plansFor('teams').map((p) => (
            <PricingCard key={p.id} plan={p} />
          ))}
        </div>
      </Doc>
      <Doc name="BillingState" usage="One banner per subscription status, with the single action that resolves it.">
        <Tabs
          variant="segmented"
          className="mb-4"
          value={status}
          onChange={(v) => setStatus(v as BillingStatus)}
          tabs={[
            { value: 'free', label: 'Free' },
            { value: 'trialing', label: 'Trial' },
            { value: 'active', label: 'Active' },
            { value: 'past-due', label: 'Past due' },
            { value: 'canceled', label: 'Canceled' },
          ]}
        />
        <BillingState status={status} renewsOn="2025-07-12" />
      </Doc>
      <Doc name="DownloadPreview" usage="File tree + code viewer for generated setup packages and blueprints. Download is built in the browser; no server endpoint is assumed.">
        <DownloadPreview name="maya-ai-setup" files={SAMPLE_PACKAGE_FILES} meta="5 files · generated just now" />
      </Doc>
    </div>
  )
}
