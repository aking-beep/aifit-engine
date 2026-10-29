'use client'
// GENERATED from packages/design by scripts/sync-design.mjs. Do not edit here.

import React, { useId } from 'react'
import type { ArchEdge, ArchNode } from './types'
import { cn, formatRange } from './lib'

const NODE_W = 168
const NODE_H = 56
const COL_GAP = 64
const ROW_GAP = 20
const PAD = 28

const ZONE_LABEL: Record<ArchNode['zone'], string> = {
  public: 'Public boundary',
  internal: 'Internal network',
  restricted: 'Restricted data zone',
}

const KIND_LABEL: Record<ArchNode['kind'], string> = {
  source: 'Source',
  gateway: 'Gateway',
  model: 'Model',
  store: 'Data store',
  tool: 'Integration',
  human: 'Human review',
  output: 'Output',
  guard: 'Guardrail',
}

/**
 * Architecture diagram. Layered left→right; security zones drawn as dashed
 * boundaries; PII-carrying edges can be highlighted; costs overlaid per node.
 * Below md it becomes a vertical layer list.
 */
export function ArchitectureDiagram({
  nodes,
  edges,
  selected,
  onSelect,
  showZones = true,
  showCosts = false,
  highlightPii = false,
}: {
  nodes: ArchNode[]
  edges: ArchEdge[]
  selected?: string | null
  onSelect?: (id: string | null) => void
  showZones?: boolean
  showCosts?: boolean
  highlightPii?: boolean
}) {
  const uid = useId().replace(/:/g, '')
  const layers = Math.max(...nodes.map((n) => n.layer)) + 1
  const byLayer = Array.from({ length: layers }, (_, l) => nodes.filter((n) => n.layer === l))
  const maxRows = Math.max(...byLayer.map((l) => l.length))
  const height = PAD * 2 + 24 + maxRows * NODE_H + (maxRows - 1) * ROW_GAP
  const width = PAD * 2 + layers * NODE_W + (layers - 1) * COL_GAP

  const pos: Record<string, { x: number; y: number }> = {}
  byLayer.forEach((col, l) => {
    const colH = col.length * NODE_H + (col.length - 1) * ROW_GAP
    const top = PAD + 24 + (maxRows * NODE_H + (maxRows - 1) * ROW_GAP - colH) / 2
    col.forEach((n, i) => {
      pos[n.id] = { x: PAD + l * (NODE_W + COL_GAP), y: top + i * (NODE_H + ROW_GAP) }
    })
  })

  const zones = (['public', 'internal', 'restricted'] as const)
    .map((z) => {
      const ns = nodes.filter((n) => n.zone === z)
      if (!ns.length) return null
      const xs = ns.map((n) => pos[n.id]?.x ?? 0)
      return { z, x: Math.min(...xs) - 14, w: Math.max(...xs) - Math.min(...xs) + NODE_W + 28 }
    })
    .filter(Boolean) as { z: ArchNode['zone']; x: number; w: number }[]

  const linked = new Set<string>()
  if (selected) edges.forEach((e) => (e.from === selected || e.to === selected) && (linked.add(e.from), linked.add(e.to)))

  return (
    <>
      {/* Desktop diagram */}
      <div className="hidden overflow-x-auto md:block">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full min-w-[720px]" role="img" aria-label="Recommended architecture diagram">
          <defs>
            <marker id={`${uid}-arrow`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" fill="var(--color-fg-muted)" />
            </marker>
            <marker id={`${uid}-arrow-pii`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" fill="var(--color-warn)" />
            </marker>
          </defs>
          {showZones &&
            zones.map((z) => (
              <g key={z.z}>
                <rect x={z.x} y={PAD - 4} width={z.w} height={height - PAD * 2 + 8} rx={8} fill="none" stroke="var(--color-line-strong)" strokeDasharray="4 4" />
                <text x={z.x + 10} y={PAD + 12} fontSize={11} fill="var(--color-fg-muted)" fontFamily="var(--font-sans)">
                  {ZONE_LABEL[z.z]}
                </text>
              </g>
            ))}
          {edges.map((e, i) => {
            const a = pos[e.from]
            const b = pos[e.to]
            if (!a || !b) return null
            const x1 = a.x + NODE_W
            const y1 = a.y + NODE_H / 2
            const x2 = b.x - 2
            const y2 = b.y + NODE_H / 2
            const mx = (x1 + x2) / 2
            const pii = highlightPii && e.pii
            const dim = selected && !(e.from === selected || e.to === selected)
            return (
              <path
                key={i}
                d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                fill="none"
                stroke={pii ? 'var(--color-warn)' : 'var(--color-fg-muted)'}
                strokeWidth={pii ? 1.75 : 1.25}
                strokeDasharray={pii ? '5 3' : undefined}
                opacity={dim ? 0.2 : 1}
                markerEnd={pii ? `url(#${uid}-arrow-pii)` : `url(#${uid}-arrow)`}
                style={{ transition: 'opacity 150ms ease-out' }}
              />
            )
          })}
          {nodes.map((n) => {
            const p = pos[n.id]
            if (!p) return null
            const isSel = selected === n.id
            const dim = selected && !isSel && !linked.has(n.id)
            return (
              <g
                key={n.id}
                transform={`translate(${p.x},${p.y})`}
                onClick={() => onSelect?.(isSel ? null : n.id)}
                className="cursor-pointer"
                opacity={dim ? 0.35 : 1}
                style={{ transition: 'opacity 150ms ease-out' }}
                role="button"
                aria-label={`${n.label}, ${KIND_LABEL[n.kind]}`}
                tabIndex={0}
                onKeyDown={(ev) => ev.key === 'Enter' && onSelect?.(isSel ? null : n.id)}
              >
                <rect width={NODE_W} height={NODE_H} rx={8} fill="var(--color-surface)" stroke={isSel ? 'var(--color-accent)' : 'var(--color-line-strong)'} strokeWidth={isSel ? 2 : 1} />
                {n.kind === 'model' && <rect x={0} y={10} width={3} height={NODE_H - 20} rx={1.5} fill="var(--color-accent)" />}
                {n.kind === 'guard' && <rect x={0} y={10} width={3} height={NODE_H - 20} rx={1.5} fill="var(--color-warn)" />}
                <text x={14} y={22} fontSize={13} fontWeight={500} fill="var(--color-fg)" fontFamily="var(--font-sans)">
                  {n.label}
                </text>
                <text x={14} y={40} fontSize={11} fill="var(--color-fg-muted)" fontFamily={showCosts && n.monthly ? 'var(--font-mono)' : 'var(--font-sans)'}>
                  {showCosts && n.monthly ? formatRange(n.monthly) : KIND_LABEL[n.kind]}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Mobile layer list */}
      <ol className="flex flex-col gap-4 md:hidden">
        {byLayer.map((col, l) => (
          <li key={l}>
            <p className="mb-1.5 text-label-sm text-fg-muted">Layer {l + 1}</p>
            <div className="flex flex-col gap-1.5">
              {col.map((n) => (
                <button
                  key={n.id}
                  onClick={() => onSelect?.(selected === n.id ? null : n.id)}
                  className={cn('flex items-center justify-between rounded-sm border bg-surface px-3 py-2 text-left', selected === n.id ? 'border-accent' : 'border-line')}
                >
                  <span>
                    <span className="block text-label-md text-fg">{n.label}</span>
                    <span className="text-label-sm text-fg-muted">
                      {KIND_LABEL[n.kind]} · {ZONE_LABEL[n.zone]}
                    </span>
                  </span>
                  {showCosts && n.monthly && <span className="font-mono text-label-sm text-fg">{formatRange(n.monthly)}</span>}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </>
  )
}

export { KIND_LABEL, ZONE_LABEL }
