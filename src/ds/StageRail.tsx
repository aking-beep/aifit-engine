import React, { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { StageId } from './types'
import { STAGES } from './config'
import { cn } from './lib'

/**
 * The five-stage spine. Identical in Consumer and Teams.
 * Full rail at md+, compact "stage + progress" header below md that expands on tap.
 */
export function StageRail({ current, completed = [], onSelect }: { current: StageId; completed?: StageId[]; onSelect?: (s: StageId) => void }) {
  const [open, setOpen] = useState(false)
  const idx = STAGES.findIndex((s) => s.id === current)
  return (
    <nav aria-label="Assessment stages">
      {/* Compact */}
      <div className="md:hidden">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 py-1">
          <span className="text-label-md text-fg">
            {STAGES[idx].label} <span className="text-fg-muted">· {idx + 1} of 5</span>
          </span>
          <ChevronDown size={16} className={cn('text-fg-muted transition-transform duration-150', open && 'rotate-180')} />
        </button>
        <ProgressBar value={((idx + 1) / 5) * 100} className="mt-2" label="Stage progress" />
        {open && (
          <ol className="mt-3 flex flex-col gap-1">
            {STAGES.map((s, i) => (
              <StageItem key={s.id} n={i + 1} label={s.label} summary={s.summary} state={stateOf(s.id, current, completed)} onClick={onSelect ? () => onSelect(s.id) : undefined} />
            ))}
          </ol>
        )}
      </div>
      {/* Full */}
      <ol className="hidden grid-cols-5 gap-px overflow-hidden rounded-md border border-line bg-line md:grid">
        {STAGES.map((s, i) => (
          <StageItem key={s.id} n={i + 1} label={s.label} summary={s.summary} state={stateOf(s.id, current, completed)} onClick={onSelect ? () => onSelect(s.id) : undefined} />
        ))}
      </ol>
    </nav>
  )
}

type StageState = 'done' | 'current' | 'upcoming'
const stateOf = (id: StageId, current: StageId, completed: StageId[]): StageState => (id === current ? 'current' : completed.includes(id) ? 'done' : 'upcoming')

function StageItem({ n, label, summary, state, onClick }: { n: number; label: string; summary: string; state: StageState; onClick?: () => void }) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <li className="min-w-0">
      <Comp
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        aria-current={state === 'current' ? 'step' : undefined}
        className={cn(
          'relative flex h-full w-full items-start gap-2.5 bg-surface px-3 py-2.5 text-left',
          onClick && 'transition-colors duration-150 hover:bg-sunken',
        )}
      >
        {state === 'current' && <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />}
        <span
          className={cn(
            'mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-mono text-[10px]',
            state === 'done' && 'border-fg bg-fg text-canvas',
            state === 'current' && 'border-accent text-accent',
            state === 'upcoming' && 'border-line-strong text-fg-muted',
          )}
        >
          {state === 'done' ? <Check size={11} strokeWidth={2.5} /> : n}
        </span>
        <span className="min-w-0">
          <span className={cn('block truncate text-label-md', state === 'upcoming' ? 'text-fg-muted' : 'text-fg')}>{label}</span>
          <span className="hidden truncate text-label-sm text-fg-muted lg:block">{summary}</span>
        </span>
      </Comp>
    </li>
  )
}

export function ProgressBar({ value, className, label, tone = 'accent' }: { value: number; className?: string; label: string; tone?: 'accent' | 'neutral' }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} className={cn('h-1.5 w-full overflow-hidden rounded-full bg-sunken', className)}>
      <div className={cn('h-full rounded-full transition-[width] duration-300 ease-[var(--ease-out-strong)]', tone === 'accent' ? 'bg-accent' : 'bg-fg-muted')} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

/** Segmented ring for readiness/score. Neutral unless the figure is measured. */
export function ScoreRing({ value, size = 64, label, tone = 'neutral' }: { value: number; size?: number; label: string; tone?: 'neutral' | 'accent' }) {
  const r = (size - 6) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${value} of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-sunken)" strokeWidth={5} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone === 'accent' ? 'var(--color-accent)' : 'var(--color-fg)'}
          strokeWidth={5}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute font-mono text-label-md text-fg tabular">{value}</span>
    </div>
  )
}
