import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Banner, Button, PageHeader, VerdictChip, cn } from '../ds'
import { SAMPLE_HISTORY } from '../ds/sample/consumer'

export function History() {
  const nav = useNavigate()
  return (
    <div>
      <PageHeader
        title="Assessment history"
        description="Every assessment is versioned. Stale results are flagged when a tool’s terms change."
        actions={
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => nav('/assessment')}>
            New assessment
          </Button>
        }
      />
      <div className="mb-6">
        <Banner tone="warn" title="1 result may be out of date" action={<Button size="sm" onClick={() => nav('/assessment')}>Re-assess</Button>}>
          “Invoice reminders” was decided before your invoicing app added built-in scheduling.
        </Banner>
      </div>
      <div className="overflow-hidden rounded-md border border-line bg-surface">
        <table className="w-full text-body-sm">
          <thead className="hidden bg-sunken md:table-header-group">
            <tr className="text-left text-label-sm text-fg-muted">
              <th className="px-4 py-2 font-medium">Assessment</th>
              <th className="px-4 py-2 font-medium">Verdict</th>
              <th className="px-4 py-2 font-medium">Fit</th>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_HISTORY.map((h) => (
              <tr key={h.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-3 first:border-t-0 md:table-row md:p-0">
                <td className="w-full md:w-auto md:px-4 md:py-3">
                  <button onClick={() => nav('/app/profile')} className="text-label-md text-fg hover:underline">
                    {h.title}
                  </button>
                  <span className="ml-2 font-mono text-label-sm text-fg-muted">v{h.version}</span>
                </td>
                <td className="md:px-4 md:py-3">
                  <VerdictChip verdict={h.verdict} />
                </td>
                <td className="font-mono text-fg md:px-4 md:py-3">{h.score}</td>
                <td className="font-mono text-fg-muted md:px-4 md:py-3">{h.date}</td>
                <td className="md:px-4 md:py-3">
                  <span className={cn('text-label-sm', h.status === 'stale' ? 'text-warn' : 'text-fg-muted')}>{h.status === 'stale' ? 'Needs re-check' : 'Complete'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
