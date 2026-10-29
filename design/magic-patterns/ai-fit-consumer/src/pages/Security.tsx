import React, { useState } from 'react'
import { EvidenceLabel, Tabs, cn } from '../ds'
import { SECURITY } from '../ds/sample/teams'
import { WorkloadHeader } from '../layout/WorkloadHeader'

const LABEL = { met: 'In place', planned: 'Planned', gap: 'Gap', verify: 'Verify with vendor' } as const

/** Security assessment. Vendor claims surface as "verify" requirements, not badges. */
export function Security() {
  const [f, setF] = useState('all')
  const rows = f === 'all' ? SECURITY : SECURITY.filter((s) => s.status !== 'met')
  return (
    <div>
      <WorkloadHeader stage="validate" title="Security assessment" description="Checks derived from your data classes (customer PII, EU residency) and the recommended architecture." />
      <Tabs
        variant="segmented"
        className="mb-4"
        value={f}
        onChange={setF}
        tabs={[
          { value: 'all', label: `All (${SECURITY.length})` },
          { value: 'open', label: `Needs action (${SECURITY.filter((s) => s.status !== 'met').length})` },
        ]}
      />
      <div className="overflow-hidden rounded-md border border-line bg-surface">
        <table className="w-full text-body-sm">
          <thead className="hidden bg-sunken text-left text-label-sm text-fg-muted md:table-header-group">
            <tr>
              <th className="px-4 py-2 font-medium">Check</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Note</th>
              <th className="px-4 py-2 font-medium">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.check} className="flex flex-col gap-1 border-t border-line px-4 py-3 first:border-t-0 md:table-row md:p-0">
                <td className="text-label-md text-fg md:px-4 md:py-2.5">{s.check}</td>
                <td className={cn('md:px-4 md:py-2.5', s.status === 'gap' ? 'text-fg' : 'text-fg-2')}>
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', s.status === 'met' ? 'bg-fg' : s.status === 'gap' && (s.evidence as string) === 'verified' ? 'bg-danger' : s.status === 'gap' ? 'border border-fg' : 'border border-fg-muted')} />
                    {LABEL[s.status]}
                  </span>
                </td>
                <td className="text-fg-muted md:px-4 md:py-2.5">{s.note}</td>
                <td className="md:px-4 md:py-2.5">
                  <EvidenceLabel kind={s.evidence} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-body-sm text-fg-muted">Gaps turn danger-coloured only once verified. Prompt injection resistance hasn’t been tested yet, so it stays neutral until the red-team run in the evaluation plan.</p>
    </div>
  )
}
