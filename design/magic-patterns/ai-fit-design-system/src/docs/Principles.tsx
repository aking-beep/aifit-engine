import React from 'react'
import { EvidenceLabel, PageHeader, STAGES, StageRail, VerdictChip } from '../ds'
import type { Evidence, Verdict } from '../ds'

export function Principles() {
  return (
    <div>
      <PageHeader
        title="One engine, two depths"
        description="AI Fit turns AI uncertainty into a validated implementation plan. Consumer is the approachable depth, Teams the analytical one. They share every token, every stage, and every evidence label."
      />

      <div className="grid gap-px overflow-hidden rounded-md border border-line bg-line md:grid-cols-2">
        <div className="bg-surface p-6">
          <p className="text-label-sm text-fg-muted">AI Fit</p>
          <p className="mt-2 text-headline-md text-fg">Find the right AI tools. Get set up. Start creating.</p>
          <ul className="mt-4 space-y-1.5 text-body-sm text-fg-2">
            <li>One question per screen, body-lg copy</li>
            <li>48px rows, 24px panel padding</li>
            <li>Reasoning expands in place</li>
          </ul>
        </div>
        <div className="bg-surface p-6">
          <p className="text-label-sm text-fg-muted">AI Fit Teams</p>
          <p className="mt-2 text-headline-md text-fg">Know what to automate, what to build, and what to avoid.</p>
          <ul className="mt-4 space-y-1.5 text-body-sm text-fg-2">
            <li>Dense tables, body-sm and mono figures</li>
            <li>36px rows, 16px panel padding</li>
            <li>Reasoning opens in a right-hand drawer</li>
          </ul>
        </div>
      </div>

      <h2 className="mt-12 mb-3 text-headline-md text-fg">The five-stage spine</h2>
      <p className="mb-4 max-w-2xl text-body-sm text-fg-muted">Every assessment in both products moves through the same stages. The rail is identical everywhere, and collapses to a compact header under 768px.</p>
      <StageRail current="configure" completed={['understand', 'decide']} />
      <ol className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-5">
        {STAGES.map((s, i) => (
          <li key={s.id}>
            <p className="font-mono text-label-sm text-fg-muted">{i + 1}</p>
            <p className="text-label-md text-fg">{s.label}</p>
            <p className="text-body-sm text-fg-muted">{s.summary}</p>
          </li>
        ))}
      </ol>

      <h2 className="mt-12 mb-3 text-headline-md text-fg">Evidence transparency</h2>
      <p className="mb-4 max-w-2xl text-body-sm text-fg-muted">
        Every figure says what it rests on. Colour follows provenance, not optimism: good, warning and danger colours are reserved for verified figures. A great-looking estimate stays neutral.
      </p>
      <div className="overflow-hidden rounded-md border border-line">
        {(['verified', 'estimated', 'assumption', 'recommendation', 'untested'] as Evidence[]).map((e) => (
          <div key={e} className="grid gap-1 border-b border-line bg-surface px-4 py-3 last:border-0 sm:grid-cols-[180px_1fr]">
            <EvidenceLabel kind={e} />
            <p className="text-body-sm text-fg-muted">{EXPLAIN[e]}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-12 mb-3 text-headline-md text-fg">Five verdicts, equal confidence</h2>
      <p className="mb-4 max-w-2xl text-body-sm text-fg-muted">“Don’t use AI” is a first-class answer. It uses the neutral text colour, never warning colours, and gets the same headline treatment as any other verdict.</p>
      <div className="flex flex-wrap gap-2">
        {(['no-ai', 'software', 'automation', 'buy', 'build'] as Verdict[]).map((v) => (
          <VerdictChip key={v} verdict={v} size="md" />
        ))}
      </div>
    </div>
  )
}

const EXPLAIN: Record<Evidence, string> = {
  verified: 'Checked against a dated source, or measured in the user’s own environment. Always shows the as-of date.',
  estimated: 'Modelled from benchmarks or comparable deployments. Ranges, never single numbers.',
  assumption: 'An input the engine assumed. Editable wherever it appears.',
  recommendation: 'The engine’s judgement, with the factors that produced it one click away.',
  untested: 'No evidence yet. Shown explicitly rather than omitted.',
}
