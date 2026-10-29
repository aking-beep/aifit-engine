import React, { useState } from 'react'
import { BillingState, Button, KeyValue, Modal, PageHeader, Panel, PanelHeader, PricingCard, Tabs, formatMoney, formatPlanPrice, planById, plansFor, useToast } from '../ds'
import type { BillingStatus, PlanConfig } from '../ds'

const INVOICES = [
  { id: 'NW-2025-06', date: '2025-06-01', item: 'Workspace · monthly', amount: 299, status: 'Paid' },
  { id: 'NW-2025-05B', date: '2025-05-18', item: 'Blueprint · Invoice extraction', amount: 999, status: 'Paid' },
  { id: 'NW-2025-05', date: '2025-05-01', item: 'Workspace · monthly', amount: 299, status: 'Paid' },
]

export function Billing() {
  const toast = useToast()
  const [status, setStatus] = useState<BillingStatus>('active')
  const [buy, setBuy] = useState<PlanConfig | null>(null)
  const current = planById('teams-workspace')!
  const price = formatPlanPrice(current)
  return (
    <div>
      <PageHeader title="Billing and subscriptions" description="Workspace subscription plus one-time assessments and blueprints. Prices come from plan configuration." />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="text-label-sm text-fg-muted">Preview state</span>
        <Tabs
          variant="segmented"
          value={status}
          onChange={(v) => setStatus(v as BillingStatus)}
          tabs={[
            { value: 'active', label: 'Active' },
            { value: 'trialing', label: 'Trial' },
            { value: 'past-due', label: 'Past due' },
            { value: 'canceled', label: 'Canceled' },
          ]}
        />
      </div>
      <BillingState status={status} renewsOn="2025-07-01" onAction={() => toast({ title: 'Opening billing portal', body: 'Prototype — no provider connected.', tone: 'info' })} />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Current subscription" />
          <div className="p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-headline-md text-fg">{current.name}</p>
              <p className="font-mono text-fg">
                {price.amount} <span className="text-fg-muted">{price.suffix}</span>
              </p>
            </div>
            <dl className="mt-3">
              <KeyValue label="Seats">5 of 25</KeyValue>
              <KeyValue label="Workloads">6 · unlimited</KeyValue>
              <KeyValue label="Renews"><span className="font-mono">2025-07-01</span></KeyValue>
              <KeyValue label="Payment">Invoice · net 30</KeyValue>
            </dl>
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="One-time purchases this year" />
          <div className="p-4">
            <p className="font-mono text-data-lg text-fg">{formatMoney(999 + 299 * 2)}</p>
            <p className="mt-1 text-body-sm text-fg-muted">1 Blueprint · 2 Assessments</p>
          </div>
        </Panel>
      </div>

      <h2 className="mt-10 mb-3 text-headline-md text-fg">Add an assessment or blueprint</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {plansFor('teams').map((p) => (
          <PricingCard key={p.id} plan={p} current={p.id === current.id} onSelect={setBuy} />
        ))}
      </div>

      <h2 className="mt-10 mb-3 text-headline-md text-fg">Invoices</h2>
      <div className="overflow-x-auto rounded-md border border-line bg-surface">
        <table className="w-full min-w-[560px] text-body-sm">
          <tbody>
            {INVOICES.map((i) => (
              <tr key={i.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5 font-mono text-fg">{i.id}</td>
                <td className="px-4 py-2.5 text-fg-2">{i.item}</td>
                <td className="px-4 py-2.5 font-mono text-fg-muted">{i.date}</td>
                <td className="px-4 py-2.5 text-right font-mono text-fg">{formatMoney(i.amount)}</td>
                <td className="px-4 py-2.5 text-right text-fg-muted">{i.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!buy}
        onClose={() => setBuy(null)}
        title={`Purchase ${buy?.name ?? ''}`}
        description="Choose the workload it applies to. You’ll complete payment in hosted checkout; access is granted once payment is confirmed."
        footer={
          <>
            <Button variant="ghost" onClick={() => setBuy(null)}>Cancel</Button>
            <Button variant="primary" onClick={() => { setBuy(null); toast({ title: 'Checkout simulated', body: 'Prototype — no charge made.', tone: 'success' }) }}>
              Continue to checkout
            </Button>
          </>
        }
      >
        {buy && (
          <div className="flex items-baseline justify-between rounded-md bg-sunken px-4 py-3">
            <span className="text-label-md text-fg">{buy.name}</span>
            <span className="font-mono text-fg">
              {formatPlanPrice(buy).amount} <span className="text-fg-muted">{formatPlanPrice(buy).suffix}</span>
            </span>
          </div>
        )}
      </Modal>
    </div>
  )
}
