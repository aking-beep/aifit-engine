import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { Button, Drawer, KeyValue, PageHeader, ProgressBar, RiskBadge, Tabs, VerdictChip, formatRange } from '../ds'
import type { Workload } from '../ds'
import { SAMPLE_WORKLOADS } from '../ds/sample/teams'

/** Team workspace — the workload portfolio with filters and a detail drawer. */
export function Workspace() {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [sel, setSel] = useState<Workload | null>(null)
  const rows = SAMPLE_WORKLOADS.filter((w) => w.name.toLowerCase().includes(q.toLowerCase())).filter((w) => (filter === 'all' ? true : filter === 'ai' ? ['buy', 'build'].includes(w.verdict) : !['buy', 'build'].includes(w.verdict)))
  return (
    <div>
      <PageHeader
        title="Workload portfolio"
        description="Every process your teams have proposed for AI, and where each one stands."
        actions={
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => nav('/app/intake')}>
            New intake
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative">
          <Search size={14} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter workloads" aria-label="Filter workloads" className="h-8 w-56 rounded-sm border border-line-strong bg-surface pr-3 pl-8 text-body-sm text-fg placeholder:text-fg-muted focus:border-accent focus:outline-none" />
        </label>
        <Tabs
          variant="segmented"
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: 'all', label: 'All' },
            { value: 'ai', label: 'AI recommended' },
            { value: 'non', label: 'Non-AI' },
          ]}
        />
      </div>
      <div className="overflow-x-auto rounded-md border border-line bg-surface">
        <table className="w-full min-w-[860px] text-body-sm">
          <thead className="bg-sunken text-left text-label-sm text-fg-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Workload</th>
              <th className="px-4 py-2 font-medium">Owner</th>
              <th className="px-4 py-2 text-right font-medium">Volume/mo</th>
              <th className="px-4 py-2 font-medium">Verdict</th>
              <th className="px-4 py-2 font-medium">Readiness</th>
              <th className="px-4 py-2 font-medium">Risk</th>
              <th className="px-4 py-2 font-medium">Eval</th>
              <th className="px-4 py-2 text-right font-medium">Monthly</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w.id} onClick={() => setSel(w)} className="h-9 cursor-pointer border-t border-line transition-colors duration-150 hover:bg-sunken">
                <td className="px-4 py-2">
                  <span className="text-fg">{w.name}</span>
                  <span className="block text-label-sm text-fg-muted">{w.department}</span>
                </td>
                <td className="px-4 py-2 text-fg-2">{w.owner}</td>
                <td className="px-4 py-2 text-right font-mono text-fg-2">{w.volumePerMonth.toLocaleString()}</td>
                <td className="px-4 py-2">
                  <VerdictChip verdict={w.verdict} />
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <ProgressBar value={w.readiness} tone="neutral" label="Readiness" className="h-1 w-14" />
                    <span className="font-mono text-label-sm text-fg">{w.readiness}</span>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <RiskBadge level={w.risk} />
                </td>
                <td className="px-4 py-2 text-fg-2 capitalize">{w.evalStatus.replace('-', ' ')}</td>
                <td className="px-4 py-2 text-right font-mono text-fg">{w.investment.high === 0 ? '$0' : formatRange({ ...w.investment, per: undefined })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-4 py-10 text-center text-body-sm text-fg-muted">No workloads match “{q}”. Clear the filter or start a new intake.</p>}
      </div>
      <Drawer
        open={!!sel}
        onClose={() => setSel(null)}
        title={sel?.name ?? ''}
        footer={
          <Button variant="primary" onClick={() => nav('/app/verdict')}>
            Open assessment
          </Button>
        }
      >
        {sel && (
          <div>
            <VerdictChip verdict={sel.verdict} size="md" />
            <dl className="mt-4">
              <KeyValue label="Department">{sel.department}</KeyValue>
              <KeyValue label="Owner">{sel.owner}</KeyValue>
              <KeyValue label="Volume">{sel.volumePerMonth.toLocaleString()} / month</KeyValue>
              <KeyValue label="Suitability">{sel.suitability}</KeyValue>
              <KeyValue label="Readiness">{sel.readiness}</KeyValue>
              <KeyValue label="Risk"><RiskBadge level={sel.risk} /></KeyValue>
              <KeyValue label="Stage"><span className="capitalize">{sel.stage}</span></KeyValue>
              <KeyValue label="Run cost"><span className="font-mono">{formatRange(sel.investment)}</span></KeyValue>
            </dl>
          </div>
        )}
      </Drawer>
    </div>
  )
}
