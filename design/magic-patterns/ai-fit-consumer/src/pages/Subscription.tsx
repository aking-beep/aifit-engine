import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BillingState, Button, KeyValue, Modal, PageHeader, Panel, PanelHeader, Tabs, formatMoney, formatPlanPrice, planById, useToast } from '../ds'
import type { BillingStatus } from '../ds'
import { useConsumer } from '../store'

const INVOICES = [
  { id: 'INV-0042', date: '2025-06-12', amount: 12, status: 'paid' },
  { id: 'INV-0031', date: '2025-05-12', amount: 12, status: 'paid' },
  { id: 'INV-0019', date: '2025-04-12', amount: 12, status: 'failed' },
]

export function Subscription() {
  const nav = useNavigate()
  const toast = useToast()
  const { planId, setPlanId } = useConsumer()
  const plan = planById(planId)!
  const isFree = planId === 'consumer-free'
  const [preview, setPreview] = useState<BillingStatus>(isFree ? 'free' : 'active')
  const [cancel, setCancel] = useState(false)
  const price = formatPlanPrice(plan)
  return (
    <div>
      <PageHeader title="Subscription" description="Manage your plan, payment method and invoices." />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="text-label-sm text-fg-muted">Preview billing state</span>
        <Tabs
          variant="segmented"
          value={preview}
          onChange={(v) => setPreview(v as BillingStatus)}
          tabs={[
            { value: 'free', label: 'Free' },
            { value: 'active', label: 'Active' },
            { value: 'past-due', label: 'Past due' },
            { value: 'canceled', label: 'Canceled' },
          ]}
        />
      </div>
      <BillingState status={preview} renewsOn="2025-07-12" onAction={() => (preview === 'free' ? nav('/app/upgrade') : toast({ title: 'Opening billing portal', body: 'Prototype — no provider connected.', tone: 'info' }))} />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Current plan" />
          <div className="p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-headline-md text-fg">{plan.name}</p>
              <p className="font-mono text-fg">
                {price.amount} <span className="text-fg-muted">{price.suffix}</span>
              </p>
            </div>
            <dl className="mt-4">
              <KeyValue label="Status">{isFree ? 'Free forever' : 'Active'}</KeyValue>
              <KeyValue label="Renews">{isFree ? '—' : <span className="font-mono">2025-07-12</span>}</KeyValue>
              <KeyValue label="Packages used">{isFree ? '1 of 1' : 'Unlimited'}</KeyValue>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              {isFree ? (
                <Button variant="primary" onClick={() => nav('/app/upgrade')}>
                  Upgrade to Pro
                </Button>
              ) : (
                <Button variant="danger" onClick={() => setCancel(true)}>
                  Cancel subscription
                </Button>
              )}
            </div>
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Payment method" actions={<Button size="sm">Update</Button>} />
          <div className="p-4">
            {isFree ? <p className="text-body-sm text-fg-muted">No payment method on file. You’ll add one at checkout.</p> : <p className="font-mono text-body-sm text-fg">Visa •••• 4242 · exp 08/27</p>}
          </div>
        </Panel>
      </div>

      <h2 className="mt-10 mb-3 text-headline-md text-fg">Invoices</h2>
      {isFree ? (
        <p className="text-body-sm text-fg-muted">Invoices appear here once you’re on a paid plan.</p>
      ) : (
        <ul className="overflow-hidden rounded-md border border-line bg-surface">
          {INVOICES.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 text-body-sm last:border-0">
              <span className="font-mono text-fg">{i.id}</span>
              <span className="font-mono text-fg-muted">{i.date}</span>
              <span className="font-mono text-fg">{formatMoney(i.amount)}</span>
              <span className={i.status === 'failed' ? 'text-danger' : 'text-fg-muted'}>{i.status === 'failed' ? 'Failed' : 'Paid'}</span>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={cancel}
        onClose={() => setCancel(false)}
        title="Cancel Pro?"
        description="You keep Pro until 2025-07-12. Your configurations stay downloadable; recommendations above 3 are hidden."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancel(false)}>
              Keep Pro
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setPlanId('consumer-free')
                setPreview('canceled')
                setCancel(false)
              }}
            >
              Cancel subscription
            </Button>
          </>
        }
      />
    </div>
  )
}
