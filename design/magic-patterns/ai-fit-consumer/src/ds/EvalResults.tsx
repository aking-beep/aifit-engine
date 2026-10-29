import React from 'react'
import { Check, Circle, Minus, X } from 'lucide-react'
import type { EvalCheck } from './types'
import { EvidenceLabel } from './Evidence'
import { cn } from './lib'

const STATUS: Record<EvalCheck['status'], { label: string; icon: React.ReactNode; cls: string }> = {
  pass: { label: 'Pass', icon: <Check size={13} strokeWidth={2.5} />, cls: 'text-good border-good/40' },
  fail: { label: 'Fail', icon: <X size={13} strokeWidth={2.5} />, cls: 'text-danger border-danger/40' },
  pending: { label: 'Pending', icon: <Circle size={11} strokeWidth={2} />, cls: 'text-fg-2 border-line-strong' },
  untested: { label: 'Not tested', icon: <Minus size={13} strokeWidth={2} />, cls: 'text-fg-muted border-dashed border-line-strong' },
}

/**
 * Evaluation results. Pass/fail colour only appears on measured results
 * (evidence = verified); planned checks stay neutral.
 */
export function EvalResults({ checks }: { checks: EvalCheck[] }) {
  const passed = checks.filter((c) => c.status === 'pass').length
  const tested = checks.filter((c) => c.status === 'pass' || c.status === 'fail').length
  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-line px-4 py-3">
        <p className="text-body-sm text-fg-muted">
          <span className="font-mono text-label-md text-fg">{passed}</span> of <span className="font-mono">{tested}</span> executed checks passed
        </p>
        <p className="text-body-sm text-fg-muted">
          <span className="font-mono text-fg">{checks.length - tested}</span> not yet run
        </p>
      </div>
      <ul>
        {checks.map((c) => {
          const s = STATUS[c.status]
          const colour = c.evidence === 'verified' ? s.cls : STATUS[c.status === 'pass' || c.status === 'fail' ? 'pending' : c.status].cls
          return (
            <li key={c.id} className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 border-b border-line px-4 py-3 last:border-0 md:grid-cols-[auto_1.4fr_1fr_1fr_auto] md:items-center">
              <span className={cn('flex h-6 w-6 items-center justify-center rounded-full border', colour)} aria-label={s.label}>
                {s.icon}
              </span>
              <div className="min-w-0">
                <p className="text-label-md text-fg">{c.name}</p>
                <p className="text-label-sm text-fg-muted">{c.metric}</p>
              </div>
              <p className="col-start-2 text-body-sm text-fg-muted md:col-start-auto">
                Target <span className="font-mono text-fg-2">{c.threshold}</span>
              </p>
              <p className="col-start-2 text-body-sm text-fg-muted md:col-start-auto">
                Result <span className="font-mono text-fg">{c.result ?? '—'}</span>
              </p>
              <div className="col-start-2 md:col-start-auto">
                <EvidenceLabel kind={c.evidence} />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
