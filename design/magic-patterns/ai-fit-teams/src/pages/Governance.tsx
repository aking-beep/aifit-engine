import React from 'react'
import { Banner, Button, EvidenceLabel, ProgressBar, cn } from '../ds'
import { GOVERNANCE } from '../ds/sample/teams'
import { WorkloadHeader } from '../layout/WorkloadHeader'

const STATUS = { met: 'Met', partial: 'Partial', gap: 'Gap' } as const

/** Governance assessment — controls against your AI policy. Recommendations, never certification. */
export function Governance() {
  const met = GOVERNANCE.filter((g) => g.status === 'met').length
  return (
    <div>
      <WorkloadHeader stage="validate" title="Governance assessment" description="Controls checked against your AI use policy and the obligations that apply to customer-facing AI in the EU." actions={<Button>Export to ARC Control</Button>} />
      <div className="mb-6">
        <Banner title="Recommended, not enforced">AI Fit identifies controls and gaps. It does not certify compliance — confirm obligations with your legal team.</Banner>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="overflow-hidden rounded-md border border-line bg-surface">
          {GOVERNANCE.map((g) => (
            <div key={g.control} className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3 last:border-0 md:grid-cols-[auto_1fr_auto_auto] md:gap-x-6">
              <span aria-hidden className={cn('h-2 w-2 rounded-full', g.status === 'met' ? 'bg-fg' : g.status === 'partial' ? 'border border-fg bg-transparent' : 'border border-dashed border-fg-muted')} />
              <p className="text-body-sm text-fg">{g.control}</p>
              <span className="col-start-2 text-label-md text-fg-2 md:col-start-auto">{STATUS[g.status]}</span>
              <span className="col-start-2 md:col-start-auto">
                <EvidenceLabel kind={g.evidence} />
              </span>
            </div>
          ))}
        </div>
        <aside className="h-fit rounded-md border border-line bg-surface p-4">
          <p className="text-label-sm text-fg-muted">Controls met</p>
          <p className="font-mono text-data-lg text-fg">
            {met}/{GOVERNANCE.length}
          </p>
          <ProgressBar value={(met / GOVERNANCE.length) * 100} tone="neutral" label="Controls met" className="mt-2" />
          <h3 className="mt-6 mb-2 text-title-md text-fg">To close before go-live</h3>
          <ol className="flex list-decimal flex-col gap-1.5 pl-4 text-body-sm text-fg-2">
            <li>Add AI disclosure to reply footer</li>
            <li>Define model change process</li>
            <li>Set prompt retention to 90 days</li>
          </ol>
        </aside>
      </div>
    </div>
  )
}
