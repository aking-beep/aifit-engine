'use client'
// GENERATED from packages/design by scripts/sync-design.mjs. Do not edit here.

import React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from './lib'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: React.ReactNode
  iconRight?: React.ReactNode
}

/**
 * One signal-filled (primary) button per region. Press feedback is 120ms scale.
 */
export function Button({ variant = 'secondary', size = 'md', loading, icon, iconRight, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-sm text-label-md select-none',
        'transition-[background-color,color,border-color,transform] duration-[120ms] ease-out active:scale-[0.98]',
        'disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' && 'h-7 px-2.5',
        size === 'md' && 'h-9 px-3.5',
        size === 'lg' && 'h-11 px-5 text-body-md font-medium',
        variant === 'primary' && 'bg-accent text-on-accent hover:bg-accent/90',
        variant === 'secondary' && 'border border-line-strong bg-surface text-fg hover:bg-sunken',
        variant === 'ghost' && 'text-fg-2 hover:bg-sunken hover:text-fg',
        variant === 'danger' && 'border border-danger/40 text-danger hover:bg-danger/10',
        className,
      )}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : icon}
      {children}
      {iconRight}
    </button>
  )
}
