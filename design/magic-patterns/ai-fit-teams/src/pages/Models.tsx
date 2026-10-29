import React, { useState } from 'react'
import { Button, EvidenceLabel, cn, useToast } from '../ds'
import type { ModelOption } from '../ds'
import { MODELS } from '../ds/sample/teams'
import { WorkloadHeader } from '../layout/WorkloadHeader'

type SortKey = 'cost' | 'latency' | 'quality'

/** Model comparison table with sortable metrics; unknowns shown as Not tested. */
export function Models() {
  const toast = useToast()
  const [sort, setSort] = useState<SortKey>('quality')
  const [chosen, setChosen] = useState(MODELS.find((m) => m.recommended)!.id)
  const val = (m: ModelOption) => (sort === 'cost' ? m.costPer1kRuns.value : sort === 'latency' ? m.latencyP50Ms.value : -(m.quality.value ?? -1))
  const rows = [...MODELS].sort((a, b) => val(a) - val(b))
  const H = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th className="px-4 py-2 text-right font-medium">
      <button onClick={() => setSort(k)} className={cn('inline-flex items-center gap-1', sort === k ? 'text-fg' : 'hover:text-fg')} aria-pressed={sort === k}>
        {children} {sort === k && '↓'}
      </button>
    </th>
  )
  return (
    <div>
      <WorkloadHeader stage="configure" title="Model comparison" description="Candidates that meet EU residency. Quality scores come from our offline eval on your sample tickets where available." />
      <div className="overflow-x-auto rounded-md border border-line bg-surface">
        <table className="w-full min-w-[860px] text-body-sm">
          <thead className="bg-sunken text-left text-label-sm text-fg-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Model</th>
              <th className="px-4 py-2 font-medium">Residency</th>
              <th className="px-4 py-2 text-right font-medium">Context</th>
              <H k="cost">$/1k runs</H>
              <H k="latency">p50 latency</H>
              <H k="quality">Quality</H>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className={cn('border-t border-line', chosen === m.id && 'bg-sunken')}>
                <td className="px-4 py-2.5">
                  <span className="text-fg">{m.name}</span>
                  {m.recommended && <span className="ml-2 text-label-sm text-accent">Recommended</span>}
                  <span className="block text-label-sm text-fg-muted">{m.provider}</span>
                </td>
                <td className="px-4 py-2.5 text-fg-2">{m.residency}</td>
                <td className="px-4 py-2.5 text-right font-mono text-fg-2">{m.contextK}k</td>
                <td className="px-4 py-2.5 text-right">
                  <span className="block font-mono text-fg">${m.costPer1kRuns.value.toFixed(2)}</span>
                  <EvidenceLabel kind={m.costPer1kRuns.evidence} asOf={m.costPer1kRuns.asOf} compact />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className="block font-mono text-fg">{(m.latencyP50Ms.value / 1000).toFixed(1)}s</span>
                  <EvidenceLabel kind={m.latencyP50Ms.evidence} compact />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className="block font-mono text-fg">{m.quality.value !== null ? m.quality.value.toFixed(2) : '—'}</span>
                  <EvidenceLabel kind={m.quality.evidence} compact={m.quality.value !== null} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  {chosen === m.id ? (
                    <span className="text-label-sm text-fg-muted">Selected</span>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => {
                        setChosen(m.id)
                        toast({ title: `${m.name} selected`, body: 'Cost model and blueprint updated.', tone: 'success' })
                      }}
                    >
                      Select
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-title-md text-fg">Why Claude Sonnet</h2>
          <p className="text-body-sm text-fg-2">Highest grounding quality on your sample (0.91) at acceptable latency, available in-region through your existing AWS agreement. GPT-4o mini is 5× cheaper; switch if the grounding gap closes in evaluation.</p>
        </div>
        <div>
          <h2 className="mb-2 text-title-md text-fg">Route by task</h2>
          <p className="text-body-sm text-fg-2">Use Gemini Flash for intent classification (cheap, fast, accuracy verified at 94%) and the selected model only for response drafting.</p>
        </div>
      </div>
    </div>
  )
}
