import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, EvidenceLabel, PageHeader, cn } from '../ds'
import { COMPARISON_ROWS } from '../ds/sample/consumer'
import { useConsumer } from '../store'

const COLS = [
  { id: 'cursor', name: 'Cursor', fit: 92 },
  { id: 'copilot', name: 'GitHub Copilot', fit: 84 },
  { id: 'claude', name: 'Claude', fit: 86 },
]

export function Compare() {
  const nav = useNavigate()
  const { setConfigTool } = useConsumer()
  const [diffOnly, setDiffOnly] = useState(false)
  const rows = diffOnly ? COMPARISON_ROWS.filter((r) => new Set(Object.values(r.values)).size > 1) : COMPARISON_ROWS
  return (
    <div>
      <PageHeader
        title="Compare tools"
        description="Side by side on the things that matter for your profile."
        actions={
          <label className="flex items-center gap-2 text-label-md text-fg-2">
            <input type="checkbox" checked={diffOnly} onChange={(e) => setDiffOnly(e.target.checked)} className="accent-[var(--color-accent)]" />
            Only show differences
          </label>
        }
      />
      <div className="overflow-x-auto rounded-md border border-line bg-surface">
        <table className="w-full min-w-[640px] text-body-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="w-48 px-4 py-4 text-left text-label-sm font-medium text-fg-muted">Criteria</th>
              {COLS.map((c, i) => (
                <th key={c.id} className={cn('px-4 py-4 text-left align-bottom', i === 0 && 'bg-sunken')}>
                  {i === 0 && <span className="mb-1 block text-label-sm font-medium text-accent">Best fit for you</span>}
                  <span className="block text-title-md text-fg">{c.name}</span>
                  <span className="font-mono text-label-sm font-normal text-fg-muted">fit {c.fit}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <span className="block text-label-md text-fg">{r.label}</span>
                  <EvidenceLabel kind={r.evidence} className="mt-0.5" />
                </td>
                {COLS.map((c, i) => (
                  <td key={c.id} className={cn('px-4 py-3 text-fg-2', i === 0 && 'bg-sunken')}>
                    {r.values[c.id]}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="px-4 py-4" />
              {COLS.map((c, i) => (
                <td key={c.id} className={cn('px-4 py-4', i === 0 && 'bg-sunken')}>
                  <Button
                    size="sm"
                    variant={i === 0 ? 'primary' : 'secondary'}
                    onClick={() => {
                      setConfigTool(c.id)
                      nav('/app/configure')
                    }}
                  >
                    Configure {c.name.split(' ').pop()}
                  </Button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-4 max-w-2xl text-body-sm text-fg-muted">
        Why Cursor wins for you: it’s the only option that combines multi-file edits with a privacy mode that doesn’t need a business plan. Copilot is cheaper if budget matters more than privacy defaults.
      </p>
    </div>
  )
}
