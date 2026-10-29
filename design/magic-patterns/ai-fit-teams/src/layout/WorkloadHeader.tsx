import React from 'react'
import { useNavigate } from 'react-router-dom'
import { StageRail, VerdictChip } from '../ds'
import type { StageId } from '../ds'
import { SAMPLE_WORKLOADS } from '../ds/sample/teams'

const STAGE_HOME: Record<StageId, string> = {
  understand: 'intake',
  decide: 'verdict',
  configure: 'architecture',
  validate: 'governance',
  improve: 'roadmap',
}
const ORDER: StageId[] = ['understand', 'decide', 'configure', 'validate', 'improve']

/**
 * Header shared by every workload screen: workload identity, verdict, the
 * five-stage rail (navigable), and the page title.
 */
export function WorkloadHeader({ stage, title, description, actions }: { stage: StageId; title: string; description?: string; actions?: React.ReactNode }) {
  const nav = useNavigate()
  const w = SAMPLE_WORKLOADS[0]
  const completed = ORDER.slice(0, ORDER.indexOf(stage))
  return (
    <div className="mb-6">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-body-sm text-fg-muted">
        <button onClick={() => nav('/app/workspace')} className="hover:text-fg">
          Portfolio
        </button>
        <span>/</span>
        <span className="text-fg">{w.name}</span>
        <VerdictChip verdict={w.verdict} />
        <span className="font-mono text-label-sm">v3</span>
      </div>
      <StageRail current={stage} completed={completed} onSelect={(s) => nav(`/app/${STAGE_HOME[s]}`)} />
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-headline-lg text-fg">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-body-sm text-fg-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  )
}
