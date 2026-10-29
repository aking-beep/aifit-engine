import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { History as HistoryIcon } from 'lucide-react'
import { Button, EmptyState, PageHeader, Tabs, VerdictChip, cn } from '../ds'
import { TEAM_HISTORY } from '../ds/sample/teams'

export function TeamsHistory() {
  const nav = useNavigate()
  const [f, setF] = useState('all')
  const rows = f === 'all' ? TEAM_HISTORY : TEAM_HISTORY.filter((h) => h.status === f)
  return (
    <div>
      <PageHeader title="Assessment history" description="Every version of every assessment. Stale results are flagged when inputs, prices or policies change." />
      <Tabs
        variant="segmented"
        className="mb-4"
        value={f}
        onChange={setF}
        tabs={[
          { value: 'all', label: 'All' },
          { value: 'complete', label: 'Complete' },
          { value: 'draft', label: 'Drafts' },
          { value: 'stale', label: 'Stale' },
          { value: 'archived', label: 'Archived' },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState icon={<HistoryIcon size={22} strokeWidth={1.5} />} title="No archived assessments" description="Archive an assessment from its menu to keep the portfolio focused. Archived versions stay searchable here." action={<Button onClick={() => setF('all')}>Show all</Button>} />
      ) : (
        <div className="overflow-x-auto rounded-md border border-line bg-surface">
          <table className="w-full min-w-[640px] text-body-sm">
            <thead className="bg-sunken text-left text-label-sm text-fg-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Assessment</th>
                <th className="px-4 py-2 font-medium">Version</th>
                <th className="px-4 py-2 font-medium">Verdict</th>
                <th className="px-4 py-2 text-right font-medium">Suitability</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h) => (
                <tr key={h.id} onClick={() => nav('/app/verdict')} className="h-9 cursor-pointer border-t border-line transition-colors duration-150 hover:bg-sunken">
                  <td className="px-4 py-2 text-fg">{h.title}</td>
                  <td className="px-4 py-2 font-mono text-fg-muted">v{h.version}</td>
                  <td className="px-4 py-2">
                    <VerdictChip verdict={h.verdict} />
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-fg">{h.score}</td>
                  <td className="px-4 py-2 font-mono text-fg-muted">{h.date}</td>
                  <td className={cn('px-4 py-2 capitalize', h.status === 'stale' ? 'text-fg' : 'text-fg-muted')}>{h.status === 'stale' ? 'Stale — re-assess' : h.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
