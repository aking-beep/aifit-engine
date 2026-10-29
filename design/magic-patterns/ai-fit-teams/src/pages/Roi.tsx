import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button, EvidenceLabel, Slider, formatMoney } from '../ds'
import { ROI_DEFAULTS } from '../ds/sample/teams'
import { WorkloadHeader } from '../layout/WorkloadHeader'

/** ROI assumptions: every input is labelled as an assumption and editable. */
export function Roi() {
  const nav = useNavigate()
  const [a, setA] = useState(ROI_DEFAULTS)
  const set = (k: keyof typeof a) => (v: number) => setA({ ...a, [k]: v })
  const hoursSaved = (a.ticketsPerMonth * (a.automationRate / 100) * a.minutesSaved) / 60
  const grossMonthly = hoursSaved * a.hourlyCost
  const net = grossMonthly - a.monthlyCost
  const payback = net > 0 ? a.implementation / net : null
  const months = Array.from({ length: 19 }, (_, m) => -a.implementation + net * m)
  const minV = Math.min(...months)
  const maxV = Math.max(...months, 1)
  const W = 560
  const H = 160
  const y = (v: number) => H - ((v - minV) / (maxV - minV)) * H
  const path = months.map((v, m) => `${m === 0 ? 'M' : 'L'}${(m / 18) * W},${y(v)}`).join(' ')

  return (
    <div>
      <WorkloadHeader
        stage="decide"
        title="ROI assumptions"
        description="ROI is only as good as its inputs. Each one below is an assumption until measured in shadow mode."
        actions={
          <Button variant="primary" iconRight={<ArrowRight size={14} />} onClick={() => nav('/app/architecture')}>
            Continue to architecture
          </Button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="rounded-md border border-line bg-surface p-4">
          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <p className="text-label-sm text-fg-muted">Payback period</p>
              <p className="font-mono text-data-lg text-fg">{payback ? `${payback.toFixed(1)} mo` : 'Never'}</p>
              <EvidenceLabel kind="estimated" />
            </div>
            <div>
              <p className="text-label-sm text-fg-muted">Net monthly benefit</p>
              <p className="font-mono text-headline-md text-fg">{formatMoney(Math.round(net))}</p>
            </div>
            <div>
              <p className="text-label-sm text-fg-muted">Agent hours saved / mo</p>
              <p className="font-mono text-headline-md text-fg">{Math.round(hoursSaved).toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-8">
            <p className="mb-2 text-label-sm text-fg-muted">Cumulative net value over 18 months</p>
            <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" preserveAspectRatio="none" role="img" aria-label="Cumulative value chart">
              <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--color-line-strong)" strokeDasharray="3 3" />
              <path d={path} fill="none" stroke="var(--color-fg)" strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="mt-1 flex justify-between font-mono text-label-sm text-fg-muted">
              <span>0</span>
              <span>6</span>
              <span>12</span>
              <span>18 mo</span>
            </div>
          </div>
          {net <= 0 && <p className="mt-4 text-body-sm text-fg-2">With these inputs the workload doesn’t pay back. That’s a valid answer — consider rules-based automation for the top intents instead.</p>}
        </div>
        <aside className="rounded-md border border-line bg-surface p-4">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-title-md text-fg">Inputs</p>
            <EvidenceLabel kind="assumption" />
          </div>
          <div className="flex flex-col gap-5">
            <Slider label="Tickets / month" value={a.ticketsPerMonth} min={1000} max={50000} step={100} onChange={set('ticketsPerMonth')} format={(v) => v.toLocaleString()} />
            <Slider label="Handled with AI assist" value={a.automationRate} min={0} max={80} onChange={set('automationRate')} format={(v) => `${v}%`} />
            <Slider label="Minutes saved per ticket" value={a.minutesSaved} min={0.5} max={15} step={0.5} onChange={set('minutesSaved')} format={(v) => `${v}`} />
            <Slider label="Loaded agent cost / hour" value={a.hourlyCost} min={15} max={80} onChange={set('hourlyCost')} format={(v) => `$${v}`} />
            <Slider label="Monthly run cost" value={a.monthlyCost} min={500} max={12000} step={100} onChange={set('monthlyCost')} format={(v) => formatMoney(v)} />
            <Slider label="Implementation cost" value={a.implementation} min={0} max={150000} step={1000} onChange={set('implementation')} format={(v) => formatMoney(v, 'USD', true)} />
          </div>
          <Button size="sm" variant="ghost" className="mt-4" onClick={() => setA(ROI_DEFAULTS)}>
            Reset to defaults
          </Button>
        </aside>
      </div>
    </div>
  )
}
