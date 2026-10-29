import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button, CostTable, EvidenceLabel, Slider, formatMoney } from '../ds'
import { COST_LINES } from '../ds/sample/teams'
import { WorkloadHeader } from '../layout/WorkloadHeader'

/** Cost modelling: drivers on the right scale the lines; chart shows range per category. */
export function CostModel() {
  const nav = useNavigate()
  const [volume, setVolume] = useState(100)
  const [draftRate, setDraftRate] = useState(62)
  const scale = (volume / 100) * (draftRate / 62)
  const lines = COST_LINES.map((l) => (l.category === 'Model usage' ? { ...l, monthly: { ...l.monthly, low: Math.round(l.monthly.low * scale), high: Math.round(l.monthly.high * scale) } } : l))
  const low = lines.reduce((s, l) => s + l.monthly.low, 0)
  const high = lines.reduce((s, l) => s + l.monthly.high, 0)
  const maxHigh = Math.max(...lines.map((l) => l.monthly.high))

  return (
    <div>
      <WorkloadHeader
        stage="decide"
        title="Cost model"
        description="Run costs as ranges, with the driver behind each line. Model prices dated 2025-06; re-verify before budgeting."
        actions={
          <Button variant="primary" iconRight={<ArrowRight size={14} />} onClick={() => nav('/app/roi')}>
            ROI assumptions
          </Button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-6">
          <div className="rounded-md border border-line bg-surface p-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-label-sm text-fg-muted">Estimated monthly run cost</p>
                <p className="font-mono text-data-lg text-fg tabular">
                  {formatMoney(low)}–{formatMoney(high)}
                </p>
                <EvidenceLabel kind="estimated" />
              </div>
              <p className="text-body-sm text-fg-muted">
                Annualised <span className="font-mono text-fg">{formatMoney(low * 12, 'USD', true)}–{formatMoney(high * 12, 'USD', true)}</span>
              </p>
            </div>
            <ul className="mt-6 flex flex-col gap-2.5" aria-label="Cost range by line">
              {lines.map((l) => (
                <li key={l.id} className="grid grid-cols-[minmax(0,160px)_1fr] items-center gap-3 sm:grid-cols-[200px_1fr]">
                  <span className="truncate text-body-sm text-fg-2">{l.label}</span>
                  <div className="relative h-4">
                    <div className="absolute inset-y-1.5 right-0 left-0 rounded-full bg-sunken" />
                    <div className="absolute inset-y-0.5 rounded-xs bg-fg-muted/50" style={{ left: `${(l.monthly.low / maxHigh) * 100}%`, width: `${Math.max(1, ((l.monthly.high - l.monthly.low) / maxHigh) * 100)}%` }} title={`${formatMoney(l.monthly.low)}–${formatMoney(l.monthly.high)}`} />
                    <div className="absolute inset-y-0 w-0.5 bg-fg" style={{ left: `${(l.monthly.low / maxHigh) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <CostTable lines={lines} />
        </div>
        <aside className="h-fit rounded-md border border-line bg-surface p-4">
          <p className="mb-4 text-title-md text-fg">Cost drivers</p>
          <div className="flex flex-col gap-5">
            <Slider label="Ticket volume" value={volume} min={50} max={200} step={5} onChange={setVolume} format={(v) => `${v}%`} />
            <Slider label="Tickets that get a draft" value={draftRate} min={20} max={100} onChange={setDraftRate} format={(v) => `${v}%`} />
          </div>
          <p className="mt-4 flex items-center gap-2 text-body-sm text-fg-muted">
            Driver values are <EvidenceLabel kind="assumption" />
          </p>
        </aside>
      </div>
    </div>
  )
}
