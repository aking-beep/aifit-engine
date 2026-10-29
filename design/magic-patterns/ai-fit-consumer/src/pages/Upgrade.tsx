import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Modal, PageHeader, PricingCard, formatPlanPrice, planById, plansFor, useToast } from '../ds'
import type { PlanConfig } from '../ds'
import { useConsumer } from '../store'

const COMPARE: [string, string, string][] = [
  ['Tool recommendations', '3', 'Unlimited'],
  ['Side-by-side comparison', '2 tools', 'Unlimited'],
  ['Configuration packages', '1', 'Unlimited'],
  ['Workflow builder', '—', 'Included'],
  ['Change alerts (price, privacy)', 'Saved only', 'All tools'],
  ['History', '30 days', 'Forever'],
]

export function Upgrade() {
  const nav = useNavigate()
  const toast = useToast()
  const { planId, setPlanId } = useConsumer()
  const [pending, setPending] = useState<PlanConfig | null>(null)
  const pro = planById('consumer-pro')!
  return (
    <div>
      <PageHeader title="Upgrade to Pro" description="For when AI is part of your daily work. Cancel any time." />
      <div className="grid max-w-3xl gap-4 md:grid-cols-2">
        {plansFor('consumer').map((p) => (
          <PricingCard key={p.id} plan={p} current={p.id === planId} onSelect={setPending} />
        ))}
      </div>
      <h2 className="mt-12 mb-3 text-headline-md text-fg">What changes</h2>
      <div className="max-w-3xl overflow-hidden rounded-md border border-line bg-surface">
        <table className="w-full text-body-sm">
          <thead className="bg-sunken text-left text-label-sm text-fg-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Feature</th>
              <th className="px-4 py-2 font-medium">Free</th>
              <th className="px-4 py-2 font-medium">Pro</th>
            </tr>
          </thead>
          <tbody>
            {COMPARE.map(([f, a, b]) => (
              <tr key={f} className="border-t border-line">
                <td className="px-4 py-2.5 text-fg">{f}</td>
                <td className="px-4 py-2.5 text-fg-muted">{a}</td>
                <td className="px-4 py-2.5 text-fg">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        title={`Confirm ${pending?.name ?? ''}`}
        description="You’ll be redirected to the billing provider’s hosted checkout. Access unlocks once payment is confirmed."
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (pending) setPlanId(pending.id)
                setPending(null)
                toast({ title: 'Welcome to Pro', body: 'Prototype: checkout simulated, no charge made.', tone: 'success' })
                nav('/app/subscription')
              }}
            >
              Continue to checkout
            </Button>
          </>
        }
      >
        {pending && (
          <div className="flex items-baseline justify-between rounded-md bg-sunken px-4 py-3">
            <span className="text-label-md text-fg">{pending.name}</span>
            <span className="font-mono text-fg">
              {formatPlanPrice(pending).amount} <span className="text-fg-muted">{formatPlanPrice(pending).suffix}</span>
            </span>
          </div>
        )}
        <p className="mt-3 text-body-sm text-fg-muted">Prototype: no billing provider is connected. Price comes from plan configuration ({pro.id}).</p>
      </Modal>
    </div>
  )
}
