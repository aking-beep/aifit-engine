import React from 'react'
import { EvidenceLabel } from '../ds'
import { INFRA } from '../ds/sample/teams'
import { WorkloadHeader } from '../layout/WorkloadHeader'

/** Infrastructure recommendations — each choice with its rationale and evidence. */
export function Infrastructure() {
  return (
    <div>
      <WorkloadHeader stage="configure" title="Infrastructure recommendations" description="Built on what your organization already runs and has approved, to avoid new vendor reviews." />
      <div className="overflow-hidden rounded-md border border-line bg-surface">
        {INFRA.map((r) => (
          <div key={r.area} className="grid gap-1 border-b border-line px-4 py-3 last:border-0 md:grid-cols-[160px_240px_1fr_auto] md:items-center md:gap-6">
            <p className="text-label-sm text-fg-muted">{r.area}</p>
            <p className="text-label-md text-fg">{r.choice}</p>
            <p className="text-body-sm text-fg-2">{r.why}</p>
            <EvidenceLabel kind={r.evidence} />
          </div>
        ))}
      </div>
      <section className="mt-8 grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-title-md text-fg">Not recommended</h2>
          <ul className="flex flex-col gap-2 text-body-sm text-fg-2">
            <li><span className="text-fg">Self-hosted GPU cluster</span> — volume doesn’t justify ~$9k/mo fixed cost.</li>
            <li><span className="text-fg">New vector database vendor</span> — OpenSearch is already approved.</li>
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-title-md text-fg">Environments</h2>
          <ul className="flex flex-col gap-2 text-body-sm text-fg-2">
            <li><span className="font-mono text-fg">sandbox</span> — synthetic tickets, no PII</li>
            <li><span className="font-mono text-fg">shadow</span> — real traffic, drafts hidden from customers</li>
            <li><span className="font-mono text-fg">production</span> — staged rollout 10 → 50 → 100%</li>
          </ul>
        </div>
      </section>
    </div>
  )
}
