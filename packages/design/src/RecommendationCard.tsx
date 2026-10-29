'use client'

import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bookmark, BookmarkCheck, ChevronDown, Settings2, ShieldCheck } from 'lucide-react'
import type { ToolRecommendation } from './types'
import { Button } from './Button'
import { EvidenceLabel } from './Evidence'
import { ReasonList } from './ReasonList'
import { cn } from './lib'

const DIFF: Record<ToolRecommendation['difficulty'], { label: string; bars: number }> = {
  easy: { label: 'Easy', bars: 1 },
  moderate: { label: 'Moderate', bars: 2 },
  advanced: { label: 'Advanced', bars: 3 },
}

/**
 * Recommendation card: name, best use, why it fits, pricing, difficulty,
 * privacy, alternatives, configure action. Reasoning expands in place.
 * Footer is pinned with mt-auto so cards in a row share baselines.
 */
export function RecommendationCard({ rec, onConfigure, onToggleSave, rank }: { rec: ToolRecommendation; onConfigure?: () => void; onToggleSave?: () => void; rank?: number }) {
  const [open, setOpen] = useState(false)
  const d = DIFF[rec.difficulty]
  return (
    <article className="flex h-full flex-col rounded-md border border-line bg-surface">
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-label-sm text-fg-muted">
            {rank !== undefined && <span className="font-mono">#{rank}</span>}
            <span className="truncate">{rec.category}</span>
          </div>
          <h3 className="mt-1 text-headline-md text-fg">{rec.name}</h3>
          <p className="text-body-sm text-fg-muted">{rec.vendor}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="font-mono text-headline-md text-fg tabular">{rec.fit}</span>
          <span className="text-label-sm text-fg-muted">fit</span>
        </div>
      </div>

      <div className="px-5 pt-4">
        <p className="text-label-sm text-fg-muted">Best for</p>
        <p className="mt-0.5 text-body-md text-fg">{rec.bestFor}</p>
        <p className="mt-3 text-label-sm text-fg-muted">Why it fits you</p>
        <p className="mt-0.5 text-body-sm text-fg-2">{rec.whyItFits}</p>
      </div>

      <dl className="mx-5 mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 text-body-sm">
        <div>
          <dt className="text-label-sm text-fg-muted">Expected pricing</dt>
          <dd className="mt-0.5 font-mono text-data-md text-fg">{rec.pricing.value}</dd>
          <EvidenceLabel kind={rec.pricing.evidence} asOf={rec.pricing.asOf} className="mt-1" />
        </div>
        <div>
          <dt className="text-label-sm text-fg-muted">Setup</dt>
          <dd className="mt-0.5 flex items-center gap-2 text-fg">
            <span className="flex gap-0.5" aria-hidden>
              {[1, 2, 3].map((n) => (
                <span key={n} className={cn('h-2.5 w-1 rounded-[1px]', n <= d.bars ? 'bg-fg' : 'bg-line-strong')} />
              ))}
            </span>
            {d.label}
            <span className="font-mono text-fg-muted">~{rec.setupMinutes}m</span>
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="flex items-center gap-1.5 text-label-sm text-fg-muted">
            <ShieldCheck size={12} strokeWidth={1.5} /> Privacy
          </dt>
          <dd className="mt-0.5 text-fg-2">{rec.privacy.summary}</dd>
          <EvidenceLabel kind={rec.privacy.trainsOnData.evidence} asOf={rec.privacy.trainsOnData.asOf} className="mt-1" />
        </div>
      </dl>

      <div className="px-5 pt-4">
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center gap-1.5 text-label-md text-fg-2 transition-colors duration-150 hover:text-fg">
          <ChevronDown size={14} className={cn('transition-transform duration-150', open && 'rotate-180')} />
          {open ? 'Hide reasoning' : `Why this ranks here · ${rec.reasons.length} factors`}
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }} className="overflow-hidden">
              <div className="pt-2">
                <ReasonList reasons={rec.reasons} dense />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-auto px-5 pt-4 pb-5">
        <p className="text-label-sm text-fg-muted">
          Alternatives: <span className="text-fg-2">{rec.alternatives.join(', ')}</span>
        </p>
        <div className="mt-4 flex items-center gap-2">
          <Button variant="primary" className="flex-1" icon={<Settings2 size={14} />} onClick={onConfigure}>
            Configure
          </Button>
          <Button variant="secondary" aria-label={rec.saved ? 'Remove from saved' : 'Save'} onClick={onToggleSave} className="px-2.5">
            {rec.saved ? <BookmarkCheck size={15} className="text-accent" /> : <Bookmark size={15} />}
          </Button>
        </div>
      </div>
    </article>
  )
}
