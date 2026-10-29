import React from 'react'
import type { Evidence, Verdict } from './types'
import { EVIDENCE_META, VERDICT_META, cn } from './lib'

/**
 * Evidence label — the visual signature of AI Fit.
 * Shape + colour + word, so it never relies on colour alone.
 */
export function EvidenceLabel({ kind, asOf, className, compact }: { kind: Evidence; asOf?: string; className?: string; compact?: boolean }) {
  const meta = EVIDENCE_META[kind]
  return (
    <span
      title={meta.help + (asOf ? ` As of ${asOf}.` : '')}
      className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-label-sm text-fg-muted', className)}
    >
      <EvidenceMark kind={kind} />
      {!compact && <span className="text-fg-2">{meta.label}</span>}
      {asOf && !compact && <span className="font-mono text-fg-muted">· {asOf}</span>}
    </span>
  )
}

export function EvidenceMark({ kind }: { kind: Evidence }) {
  const base = 'inline-block h-2 w-2 shrink-0'
  switch (kind) {
    case 'verified':
      return <span aria-hidden className={cn(base, 'rounded-full bg-ev-verified')} />
    case 'estimated':
      return (
        <span aria-hidden className={cn(base, 'relative overflow-hidden rounded-full border border-ev-estimated')}>
          <span className="absolute inset-y-0 left-0 w-1/2 bg-ev-estimated" />
        </span>
      )
    case 'assumption':
      return <span aria-hidden className={cn(base, 'rounded-full border-[1.5px] border-ev-assumption')} />
    case 'recommendation':
      return <span aria-hidden className={cn(base, 'rounded-[1px] bg-ev-recommendation')} />
    case 'untested':
      return <span aria-hidden className={cn(base, 'rounded-full border border-dashed border-ev-untested')} />
  }
}

const VERDICT_DOT: Record<Verdict, string> = {
  'no-ai': 'bg-v-noai',
  software: 'bg-v-software',
  automation: 'bg-v-automation',
  buy: 'bg-v-buy',
  build: 'bg-v-build',
}

/** Verdict chip. "No AI" is neutral by design — a first-class answer, not a warning. */
export function VerdictChip({ verdict, size = 'sm', className }: { verdict: Verdict; size?: 'sm' | 'md'; className?: string }) {
  const meta = VERDICT_META[verdict]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-xs border border-line bg-surface text-fg',
        size === 'sm' ? 'h-6 px-2 text-label-sm' : 'h-7 px-2.5 text-label-md',
        className,
      )}
    >
      <span aria-hidden className={cn('h-2 w-2 rounded-full ring-1 ring-line-strong', VERDICT_DOT[verdict])} />
      {size === 'sm' ? meta.short : meta.label}
    </span>
  )
}

export const verdictDot = (v: Verdict) => VERDICT_DOT[v]
