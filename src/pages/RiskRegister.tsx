import React, { useState } from 'react'
import { Button, Drawer, EvidenceLabel, KeyValue, RiskBadge, RiskMatrix, Tabs, riskLevelOf } from '../ds'
import type { RiskItem } from '../ds'
import { RISKS } from '../ds/sample/teams'
import { WorkloadHeader } from '../layout/WorkloadHeader'

/** Risk register: matrix filters the table; rows open a detail drawer. */
export function RiskRegister() {
  const [cell, setCell] = useState<[number, number] | null>(null)
  const [status, setStatus] = useState('all')
  const [sel, setSel] = useState<RiskItem | null>(null)
  const rows = RISKS.filter((r) => (cell ? r.likelihood === cell[0] && r.impact === cell[1] : true)).filter((r) => (status === 'all' ? true : r.status === status)).sort((a, b) => b.likelihood * b.impact - a.likelihood * a.impact)
  return (
    <div>
      <WorkloadHeader stage="validate" title="Risk register" description="Scored likelihood × impact. Select a matrix cell to filter." actions={<Button>Add risk</Button>} />
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div>
          <RiskMatrix risks={RISKS} selected={cell} onSelect={setCell} />
          {cell && (
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => setCell(null)}>
              Clear filter
            </Button>
          )}
        </div>
        <div>
          <Tabs
            variant="segmented"
            className="mb-3"
            value={status}
            onChange={setStatus}
            tabs={[
              { value: 'all', label: 'All' },
              { value: 'open', label: 'Open' },
              { value: 'mitigating', label: 'Mitigating' },
              { value: 'accepted', label: 'Accepted' },
            ]}
          />
          <div className="overflow-x-auto rounded-md border border-line bg-surface">
            <table className="w-full min-w-[640px] text-body-sm">
              <thead className="bg-sunken text-left text-label-sm text-fg-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">ID</th>
                  <th className="px-4 py-2 font-medium">Risk</th>
                  <th className="px-4 py-2 font-medium">Level</th>
                  <th className="px-4 py-2 font-medium">Owner</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => setSel(r)} className="h-9 cursor-pointer border-t border-line transition-colors duration-150 hover:bg-sunken">
                    <td className="px-4 py-2 font-mono text-fg-muted">{r.id}</td>
                    <td className="px-4 py-2">
                      <span className="text-fg">{r.title}</span>
                      <span className="block text-label-sm text-fg-muted capitalize">{r.category}</span>
                    </td>
                    <td className="px-4 py-2">
                      <RiskBadge level={riskLevelOf(r)} />
                    </td>
                    <td className="px-4 py-2 text-fg-2">{r.owner}</td>
                    <td className="px-4 py-2 text-fg-2 capitalize">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <p className="px-4 py-8 text-center text-body-sm text-fg-muted">No risks match this filter.</p>}
          </div>
        </div>
      </div>
      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel ? `${sel.id} · ${sel.title}` : ''} footer={<Button variant="primary" onClick={() => setSel(null)}>Save</Button>}>
        {sel && (
          <div>
            <RiskBadge level={riskLevelOf(sel)} />
            <dl className="mt-4">
              <KeyValue label="Likelihood"><span className="font-mono">{sel.likelihood}/5</span></KeyValue>
              <KeyValue label="Impact"><span className="font-mono">{sel.impact}/5</span></KeyValue>
              <KeyValue label="Owner">{sel.owner}</KeyValue>
              <KeyValue label="Status"><span className="capitalize">{sel.status}</span></KeyValue>
              <KeyValue label="Evidence"><EvidenceLabel kind={sel.evidence} /></KeyValue>
            </dl>
            <h3 className="mt-5 mb-1 text-title-md text-fg">Mitigation</h3>
            <p className="text-body-sm text-fg-2">{sel.mitigation}</p>
          </div>
        )}
      </Drawer>
    </div>
  )
}
