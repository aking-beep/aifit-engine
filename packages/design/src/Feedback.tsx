'use client'

import React, { useEffect, useState } from 'react'
import { AlertTriangle, Check, Info, Loader2, RotateCw, XCircle } from 'lucide-react'
import { Button } from './Button'
import { cn } from './lib'

/** Empty states always name the next step. */
export function EmptyState({ icon, title, description, action, className }: { icon?: React.ReactNode; title: string; description: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-md border border-dashed border-line-strong px-6 py-12 text-center', className)}>
      {icon && <div className="mb-3 text-fg-muted">{icon}</div>}
      <h3 className="text-title-md text-fg">{title}</h3>
      <p className="mt-1 max-w-sm text-body-sm text-fg-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/** Errors are cause + fix + retry. Never a bare "Something went wrong". */
export function ErrorState({ title, cause, fix, onRetry, code }: { title: string; cause: string; fix: string; onRetry?: () => void; code?: string }) {
  return (
    <div role="alert" className="rounded-md border border-danger/40 bg-surface p-4">
      <div className="flex items-start gap-3">
        <XCircle size={18} className="mt-0.5 shrink-0 text-danger" strokeWidth={1.5} />
        <div className="min-w-0 flex-1">
          <h3 className="text-title-md text-fg">{title}</h3>
          <dl className="mt-2 grid gap-1 text-body-sm sm:grid-cols-[72px_1fr]">
            <dt className="text-fg-muted">Cause</dt>
            <dd className="text-fg-2">{cause}</dd>
            <dt className="text-fg-muted">Fix</dt>
            <dd className="text-fg-2">{fix}</dd>
          </dl>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {onRetry && (
              <Button size="sm" icon={<RotateCw size={13} />} onClick={onRetry}>
                Retry
              </Button>
            )}
            {code && <span className="font-mono text-label-sm text-fg-muted">ref {code}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

export function Banner({ tone = 'info', title, children, action }: { tone?: 'info' | 'warn' | 'danger' | 'success'; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  const Icon = tone === 'warn' ? AlertTriangle : tone === 'danger' ? XCircle : tone === 'success' ? Check : Info
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex flex-col gap-3 rounded-md border bg-surface px-4 py-3 sm:flex-row sm:items-center',
        tone === 'info' && 'border-line',
        tone === 'warn' && 'border-warn/50',
        tone === 'danger' && 'border-danger/50',
        tone === 'success' && 'border-accent/50',
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Icon size={16} strokeWidth={1.5} className={cn('mt-0.5 shrink-0', tone === 'info' && 'text-fg-muted', tone === 'warn' && 'text-warn', tone === 'danger' && 'text-danger', tone === 'success' && 'text-accent')} />
        <div className="min-w-0">
          <p className="text-label-md text-fg">{title}</p>
          {children && <div className="mt-0.5 text-body-sm text-fg-muted">{children}</div>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-sm bg-sunken', className)} />
}

/**
 * Engine progress for runs longer than ~2s. It is driven by the real request:
 * steps advance on a timer only while `done` is false and never past the last
 * step, and all of them complete when the work has actually finished.
 */
export function EngineProgress({ steps, done = false, onDone, stepMs = 550 }: { steps: string[]; done?: boolean; onDone?: () => void; stepMs?: number }) {
  const [i, setI] = useState(0)
  const shown = done ? steps.length : i
  useEffect(() => {
    if (done) {
      onDone?.()
      return
    }
    if (i >= steps.length - 1) return
    const t = setTimeout(() => setI((n) => n + 1), stepMs)
    return () => clearTimeout(t)
  }, [i, done, steps.length, stepMs, onDone])
  return (
    <ol aria-live="polite" className="flex flex-col gap-2.5">
      {steps.map((s, n) => (
        <li key={s} className={cn('flex items-center gap-3 text-body-md', n < shown ? 'text-fg-2' : n === shown ? 'text-fg' : 'text-fg-muted')}>
          <span className="flex h-5 w-5 items-center justify-center">
            {n < shown ? <Check size={15} className="text-accent" /> : n === shown ? <Loader2 size={15} className="animate-spin text-fg" /> : <span className="h-1.5 w-1.5 rounded-full bg-line-strong" />}
          </span>
          {s}
        </li>
      ))}
    </ol>
  )
}

