import React from 'react'
import { cn } from './lib'

/** Underline tabs for page sections; segmented for compact view switches. */
export function Tabs<T extends string>({ tabs, value, onChange, variant = 'underline', className }: { tabs: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; variant?: 'underline' | 'segmented'; className?: string }) {
  if (variant === 'segmented') {
    return (
      <div role="tablist" className={cn('inline-flex rounded-sm border border-line bg-sunken p-0.5', className)}>
        {tabs.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={value === t.value}
            onClick={() => onChange(t.value)}
            className={cn('h-7 whitespace-nowrap rounded-xs px-3 text-label-md transition-colors duration-150', value === t.value ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg')}
          >
            {t.label}
          </button>
        ))}
      </div>
    )
  }
  return (
    <div role="tablist" className={cn('flex gap-5 overflow-x-auto border-b border-line', className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            '-mb-px flex h-10 items-center gap-1.5 whitespace-nowrap border-b-2 text-label-md transition-colors duration-150',
            value === t.value ? 'border-accent text-fg' : 'border-transparent text-fg-muted hover:text-fg',
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="font-mono text-label-sm text-fg-muted">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}
