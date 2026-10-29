'use client'
// GENERATED from packages/design by scripts/sync-design.mjs. Do not edit here.

import React from 'react'
import type { RiskItem, RiskLevel } from './types'
import { cn } from './lib'

export const riskLevelOf = (r: Pick<RiskItem, 'likelihood' | 'impact'>): RiskLevel => {
  const s = r.likelihood * r.impact
  return s >= 16 ? 'critical' : s >= 10 ? 'high' : s >= 5 ? 'medium' : 'low'
}

const LEVEL: Record<RiskLevel, { label: string; bars: number; cls: string }> = {
  low: { label: 'Low', bars: 1, cls: 'bg-fg-muted' },
  medium: { label: 'Medium', bars: 2, cls: 'bg-warn' },
  high: { label: 'High', bars: 3, cls: 'bg-danger' },
  critical: { label: 'Critical', bars: 4, cls: 'bg-danger' },
}

/** Risk indicator — bar count + word, never colour alone. */
export function RiskBadge({ level, className }: { level: RiskLevel; className?: string }) {
  const m = LEVEL[level]
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-label-sm text-fg', className)}>
      <span className="flex items-end gap-px" aria-hidden>
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={cn('w-[3px] rounded-[1px]', n <= m.bars ? m.cls : 'bg-line-strong')} style={{ height: 4 + n * 2 }} />
        ))}
      </span>
      {m.label}
    </span>
  )
}

/** 5×5 likelihood × impact matrix. Cells are buttons that filter the register. */
export function RiskMatrix({ risks, selected, onSelect }: { risks: RiskItem[]; selected?: [number, number] | null; onSelect?: (cell: [number, number] | null) => void }) {
  return (
    <div className="flex gap-2">
      <div className="flex flex-col justify-between py-1 text-label-sm text-fg-muted [writing-mode:vertical-rl] rotate-180">Likelihood →</div>
      <div className="flex-1">
        <div className="grid grid-cols-5 gap-1">
          {[5, 4, 3, 2, 1].map((l) =>
            [1, 2, 3, 4, 5].map((i) => {
              const items = risks.filter((r) => r.likelihood === l && r.impact === i)
              const level = riskLevelOf({ likelihood: l as 1, impact: i as 1 })
              const isSel = selected && selected[0] === l && selected[1] === i
              return (
                <button
                  key={`${l}-${i}`}
                  type="button"
                  disabled={!items.length}
                  onClick={() => onSelect?.(isSel ? null : [l, i])}
                  aria-label={`Likelihood ${l}, impact ${i}: ${items.length} risks`}
                  className={cn(
                    'flex aspect-square items-center justify-center rounded-xs border font-mono text-label-md transition-colors duration-150',
                    level === 'low' && 'border-line bg-sunken',
                    level === 'medium' && 'border-warn/30 bg-warn/10',
                    (level === 'high' || level === 'critical') && 'border-danger/30 bg-danger/10',
                    items.length ? 'text-fg hover:border-fg-muted' : 'text-transparent',
                    isSel && 'ring-2 ring-accent',
                  )}
                >
                  {items.length || '·'}
                </button>
              )
            }),
          )}
        </div>
        <p className="mt-1.5 text-center text-label-sm text-fg-muted">Impact →</p>
      </div>
    </div>
  )
}
