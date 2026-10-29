'use client'
// GENERATED from packages/design by scripts/sync-design.mjs. Do not edit here.

import React from 'react'
import type { Reason } from './types'
import { EvidenceLabel } from './Evidence'
import { cn } from './lib'

/**
 * Explainability: every factor behind a decision, its direction and weight,
 * and the evidence it rests on.
 */
export function ReasonList({ reasons, dense }: { reasons: Reason[]; dense?: boolean }) {
  const sorted = [...reasons].sort((a, b) => b.weight - a.weight)
  return (
    <ul className="flex flex-col">
      {sorted.map((r) => (
        <li key={r.label} className={cn('grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-b border-line last:border-0', dense ? 'py-2' : 'py-3')}>
          <div className="flex min-w-0 items-center gap-2">
            <span aria-label={r.direction === 'for' ? 'Supports' : 'Against'} className={cn('font-mono text-label-md', r.direction === 'for' ? 'text-fg' : 'text-fg-muted')}>
              {r.direction === 'for' ? '+' : '−'}
            </span>
            <span className="truncate text-label-md text-fg">{r.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1 w-16 overflow-hidden rounded-full bg-sunken" aria-hidden>
              <div className={cn('h-full', r.direction === 'for' ? 'bg-fg' : 'bg-fg-muted')} style={{ width: `${r.weight * 100}%` }} />
            </div>
            <span className="w-8 text-right font-mono text-label-sm text-fg-muted tabular">{Math.round(r.weight * 100)}%</span>
          </div>
          <p className={cn('col-span-2 pl-5 text-body-sm text-fg-muted', dense && 'hidden sm:block')}>{r.detail}</p>
          <div className="col-span-2 pl-5">
            <EvidenceLabel kind={r.evidence} />
          </div>
        </li>
      ))}
    </ul>
  )
}
