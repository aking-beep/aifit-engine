import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, EvidenceLabel, PageHeader, VerdictChip, VERDICT_META, cn } from '../ds'
import { SAMPLE_WORKFLOWS } from '../ds/sample/consumer'

/** Workflow recommendations: list on the left, the selected workflow as a numbered flow. */
export function Workflows() {
  const nav = useNavigate()
  const [sel, setSel] = useState(SAMPLE_WORKFLOWS[0].id)
  const w = SAMPLE_WORKFLOWS.find((x) => x.id === sel)!
  return (
    <div>
      <PageHeader title="Workflow recommendations" description="How your tools fit together for each goal — including where no AI is the better call." />
      <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
        <ul className="flex flex-col gap-1" role="listbox" aria-label="Workflows">
          {SAMPLE_WORKFLOWS.map((x) => (
            <li key={x.id}>
              <button
                role="option"
                aria-selected={x.id === sel}
                onClick={() => setSel(x.id)}
                className={cn('w-full rounded-md border px-4 py-3 text-left transition-colors duration-150', x.id === sel ? 'border-line-strong bg-surface' : 'border-transparent hover:bg-surface')}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-label-md text-fg">{x.name}</span>
                  <VerdictChip verdict={x.verdict} />
                </span>
                <span className="mt-0.5 block text-body-sm text-fg-muted">{x.outcome}</span>
              </button>
            </li>
          ))}
        </ul>
        <section>
          <VerdictChip verdict={w.verdict} size="md" />
          <h2 className="mt-3 text-headline-lg text-fg">{w.name}</h2>
          <p className="mt-1 text-body-md text-fg-muted">{VERDICT_META[w.verdict].sentence}</p>
          <p className="mt-4 flex items-center gap-2 text-body-sm text-fg-2">
            Expected time saved <span className="font-mono text-fg">{w.timeSaved.value}</span> <EvidenceLabel kind={w.timeSaved.evidence} />
          </p>
          <ol className="mt-8 flex flex-col">
            {w.steps.map((s, i) => (
              <li key={s.title} className="relative grid grid-cols-[32px_1fr] gap-4 pb-8 last:pb-0">
                {i < w.steps.length - 1 && <span aria-hidden className="absolute top-8 bottom-0 left-[15.5px] w-px bg-line" />}
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line-strong bg-surface font-mono text-label-sm text-fg">{i + 1}</span>
                <div className="pt-1">
                  <p className="text-title-md text-fg">
                    {s.title} <span className="font-normal text-fg-muted">· {s.tool}</span>
                  </p>
                  <p className="mt-0.5 text-body-sm text-fg-2">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap gap-2">
            {w.verdict === 'no-ai' ? (
              <Button variant="primary">Mark as handled</Button>
            ) : (
              <Button variant="primary" onClick={() => nav('/app/configure')}>
                Generate setup for this workflow
              </Button>
            )}
            <Button>Save workflow</Button>
          </div>
        </section>
      </div>
    </div>
  )
}
