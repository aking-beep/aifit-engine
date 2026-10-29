import React, { useId } from 'react'
import { Check } from 'lucide-react'
import { cn } from './lib'

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-label-md text-fg">
        {label}
      </label>
      {children}
      {error ? <p className="text-body-sm text-danger">{error}</p> : hint ? <p className="text-body-sm text-fg-muted">{hint}</p> : null}
    </div>
  )
}

const control =
  'w-full rounded-sm border border-line-strong bg-surface px-3 text-body-md text-fg placeholder:text-fg-muted transition-[border-color] duration-150 focus:border-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-accent aria-[invalid=true]:border-danger'

export function TextInput({ label, hint, error, className, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const id = useId()
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <input id={id} aria-invalid={!!error} {...rest} className={cn(control, 'h-9', className)} />
    </Field>
  )
}

export function TextArea({ label, hint, error, className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string; error?: string }) {
  const id = useId()
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <textarea id={id} aria-invalid={!!error} rows={4} {...rest} className={cn(control, 'py-2 leading-relaxed', className)} />
    </Field>
  )
}

export function Select({ label, hint, options, className, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string; options: { value: string; label: string }[] }) {
  const id = useId()
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <select id={id} {...rest} className={cn(control, 'h-9 appearance-none pr-8', className)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

/** Choice cards — used for assessment questions. Single or multi select. */
export function ChoiceGroup<T extends string>({
  options,
  value,
  onChange,
  multiple,
  columns = 1,
  size = 'md',
  label,
}: {
  options: { value: T; label: string; description?: string }[]
  value: T[]
  onChange: (v: T[]) => void
  multiple?: boolean
  columns?: 1 | 2
  size?: 'md' | 'lg'
  label: string
}) {
  return (
    <div role={multiple ? 'group' : 'radiogroup'} aria-label={label} className={cn('grid gap-2', columns === 2 && 'sm:grid-cols-2')}>
      {options.map((o) => {
        const on = value.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            role={multiple ? 'checkbox' : 'radio'}
            aria-checked={on}
            onClick={() => onChange(multiple ? (on ? value.filter((v) => v !== o.value) : [...value, o.value]) : [o.value])}
            className={cn(
              'flex items-start gap-3 rounded-md border text-left transition-[border-color,background-color] duration-150',
              size === 'lg' ? 'px-4 py-3.5' : 'px-3 py-2.5',
              on ? 'border-accent bg-accent-subtle' : 'border-line bg-surface hover:border-line-strong',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border',
                multiple ? 'rounded-xs' : 'rounded-full',
                on ? 'border-accent bg-accent text-on-accent' : 'border-line-strong',
              )}
            >
              {on && (multiple ? <Check size={11} strokeWidth={3} /> : <span className="h-1.5 w-1.5 rounded-full bg-on-accent" />)}
            </span>
            <span className="min-w-0">
              <span className={cn('block text-fg', size === 'lg' ? 'text-body-md font-medium' : 'text-label-md')}>{o.label}</span>
              {o.description && <span className="mt-0.5 block text-body-sm text-fg-muted">{o.description}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span className="min-w-0">
        <span className="block text-label-md text-fg">{label}</span>
        {description && <span className="mt-0.5 block text-body-sm text-fg-muted">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn('relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-150', checked ? 'bg-accent' : 'bg-line-strong')}
      >
        <span
          className={cn('absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-surface shadow transition-transform duration-150 ease-[var(--ease-out-strong)]', checked && 'translate-x-4')}
        />
      </button>
    </label>
  )
}

export function Slider({ label, value, min, max, step = 1, onChange, format = String }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-label-md text-fg">
          {label}
        </label>
        <span className="font-mono text-data-md text-fg tabular">{format(value)}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--color-accent)]" />
    </div>
  )
}
