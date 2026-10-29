import React from 'react'
import { PageHeader } from '../ds'

const SURFACES = ['canvas', 'surface', 'raised', 'sunken', 'line', 'line-strong']
const TEXT = ['fg', 'fg-2', 'fg-muted']
const SIGNAL = ['accent', 'accent-subtle', 'on-accent']
const OUTCOME = ['good', 'warn', 'danger']
const EVIDENCE = ['ev-verified', 'ev-estimated', 'ev-assumption', 'ev-recommendation', 'ev-untested']
const VERDICT = ['v-noai', 'v-software', 'v-automation', 'v-buy', 'v-build']

const TYPE: [string, string, string][] = [
  ['display-xl', 'text-display-xl font-display', 'Defensible AI decisions'],
  ['display-lg', 'text-display-lg font-display', 'Don’t use AI for this'],
  ['headline-lg', 'text-headline-lg', 'Workload portfolio'],
  ['headline-md', 'text-headline-md', 'Build versus buy'],
  ['title-md', 'text-title-md', 'Recommended architecture'],
  ['body-lg', 'text-body-lg', 'What do you want AI to help you do?'],
  ['body-md', 'text-body-md', 'A commercial AI product fits with minimal configuration.'],
  ['body-sm', 'text-body-sm', 'Volume 12,400 tickets per month, 38% repetitive.'],
  ['label-md', 'text-label-md', 'Generate blueprint'],
  ['label-sm', 'text-label-sm', 'Estimated · as of 2025-06'],
  ['data-lg', 'text-data-lg font-mono', '$4,180–6,920'],
  ['data-md', 'text-data-md font-mono', '$0.42 / 1k runs'],
  ['code-sm', 'text-code-sm font-mono', 'model: claude-sonnet'],
]

export function Foundations() {
  return (
    <div>
      <PageHeader title="Tokens" description="Generated from design.md. Swatches read live CSS variables, so switching theme in the top bar shows the dark and light values." />
      <Group title="Surfaces" tokens={SURFACES} />
      <Group title="Text" tokens={TEXT} />
      <Group title="Signal" tokens={SIGNAL} />
      <Group title="Outcome — verified figures only" tokens={OUTCOME} />
      <Group title="Evidence" tokens={EVIDENCE} />
      <Group title="Verdict" tokens={VERDICT} />

      <h2 className="mt-12 mb-4 text-headline-md text-fg">Type scale</h2>
      <div className="overflow-hidden rounded-md border border-line bg-surface">
        {TYPE.map(([name, cls, sample]) => (
          <div key={name} className="grid items-baseline gap-2 border-b border-line px-4 py-4 last:border-0 md:grid-cols-[140px_1fr]">
            <span className="font-mono text-label-sm text-fg-muted">{name}</span>
            <span className={`${cls} truncate text-fg`}>{sample}</span>
          </div>
        ))}
      </div>

      <div className="mt-12 grid gap-10 md:grid-cols-2">
        <div>
          <h2 className="mb-4 text-headline-md text-fg">Radius</h2>
          <div className="flex flex-wrap items-end gap-4">
            {[
              ['xs', 'rounded-xs'],
              ['sm', 'rounded-sm'],
              ['md', 'rounded-md'],
              ['lg', 'rounded-lg'],
              ['xl', 'rounded-xl'],
            ].map(([n, c]) => (
              <div key={n} className="text-center">
                <div className={`h-14 w-14 border border-line-strong bg-surface ${c}`} />
                <p className="mt-1.5 font-mono text-label-sm text-fg-muted">{n}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="mb-4 text-headline-md text-fg">Spacing (4px base)</h2>
          <div className="flex flex-col gap-1.5">
            {[2, 4, 8, 12, 16, 24, 32, 48, 64, 96].map((px) => (
              <div key={px} className="flex items-center gap-3">
                <span className="w-10 text-right font-mono text-label-sm text-fg-muted">{px}</span>
                <span className="h-2 rounded-[1px] bg-fg-muted" style={{ width: px * 2 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Group({ title, tokens }: { title: string; tokens: string[] }) {
  return (
    <div className="mb-8">
      <h2 className="mb-3 text-title-md text-fg">{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tokens.map((t) => (
          <div key={t}>
            <div className="h-14 rounded-sm border border-line" style={{ background: `var(--color-${t})` }} />
            <p className="mt-1.5 font-mono text-label-sm text-fg-2">{t}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
