import React from 'react'
import { STAGES, cn } from '../ds'
import { ROADMAP } from '../ds/sample/teams'
import { WorkloadHeader } from '../layout/WorkloadHeader'

const WEEKS = 12
const CURRENT_WEEK = 5

/** Implementation roadmap — a timeline, because the order matters. */
export function Roadmap() {
  return (
    <div>
      <WorkloadHeader stage="improve" title="Implementation roadmap" description="Twelve weeks from discovery to full rollout, gated by the evaluation plan." />
      <div className="overflow-x-auto rounded-md border border-line bg-surface">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[240px_1fr] border-b border-line">
            <div className="px-4 py-2 text-label-sm text-fg-muted">Phase</div>
            <div className="relative grid" style={{ gridTemplateColumns: `repeat(${WEEKS}, 1fr)` }}>
              {Array.from({ length: WEEKS }, (_, i) => (
                <div key={i} className={cn('border-l border-line py-2 text-center font-mono text-label-sm', i + 1 === CURRENT_WEEK ? 'text-accent' : 'text-fg-muted')}>
                  W{i + 1}
                </div>
              ))}
            </div>
          </div>
          {ROADMAP.map((p) => (
            <div key={p.id} className="grid grid-cols-[240px_1fr] border-b border-line last:border-0">
              <div className="px-4 py-3">
                <p className="text-label-md text-fg">{p.name}</p>
                <p className="text-label-sm text-fg-muted">
                  {STAGES.find((s) => s.id === p.stage)?.label} · {p.owner}
                </p>
              </div>
              <div className="relative grid items-center" style={{ gridTemplateColumns: `repeat(${WEEKS}, 1fr)` }}>
                {Array.from({ length: WEEKS }, (_, i) => (
                  <div key={i} className="h-full border-l border-line" />
                ))}
                <div
                  className={cn('absolute h-6 rounded-xs border px-2 text-label-sm leading-6 whitespace-nowrap overflow-hidden', p.weeks[1] < CURRENT_WEEK ? 'border-fg bg-fg text-canvas' : p.weeks[0] <= CURRENT_WEEK ? 'border-accent bg-accent-subtle text-fg' : 'border-line-strong bg-sunken text-fg-2')}
                  style={{ left: `${((p.weeks[0] - 1) / WEEKS) * 100}%`, width: `${((p.weeks[1] - p.weeks[0] + 1) / WEEKS) * 100}%` }}
                >
                  {p.deliverables[0]}
                </div>
                <div className="pointer-events-none absolute inset-y-0 w-px bg-accent" style={{ left: `${((CURRENT_WEEK - 0.5) / WEEKS) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <section className="mt-8">
        <h2 className="mb-3 text-headline-md text-fg">Deliverables by phase</h2>
        <ol className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {ROADMAP.map((p, i) => (
            <li key={p.id}>
              <p className="font-mono text-label-sm text-fg-muted">
                {i + 1} · Weeks {p.weeks[0]}–{p.weeks[1]}
              </p>
              <p className="text-label-md text-fg">{p.name}</p>
              <ul className="mt-1 flex flex-col gap-0.5 text-body-sm text-fg-2">
                {p.deliverables.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
