'use client'
// GENERATED from packages/design by scripts/sync-design.mjs. Do not edit here.

import React from 'react'
import { cn } from './lib'

/** Level-1 surface. Use sparingly — whitespace and hairlines group first. */
export function Panel({ className, children, as: As = 'section', ...rest }: React.HTMLAttributes<HTMLElement> & { as?: 'section' | 'div' | 'article' | 'aside' }) {
  return (
    <As {...rest} className={cn('rounded-md border border-line bg-surface', className)}>
      {children}
    </As>
  )
}

export function PanelHeader({ title, description, actions, className }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <header className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3', className)}>
      <div className="min-w-0">
        <h3 className="text-title-md text-fg">{title}</h3>
        {description && <p className="mt-0.5 text-body-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}

/** Page title block — one headline-lg per screen. */
export function PageHeader({ title, description, actions, meta }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {meta && <div className="mb-2 flex flex-wrap items-center gap-2">{meta}</div>}
        <h1 className="text-headline-lg text-fg">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-body-md text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function SectionTitle({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-headline-md text-fg">{children}</h2>
      {actions}
    </div>
  )
}

/** Key/value row used in detail panels and reports. */
export function KeyValue({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-0">
      <dt className="text-body-sm text-fg-muted">{label}</dt>
      <dd className="text-right text-body-sm text-fg">{children}</dd>
    </div>
  )
}

export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('inline-flex h-6 items-center whitespace-nowrap rounded-xs bg-sunken px-2 text-label-sm text-fg-2', className)}>{children}</span>
}
