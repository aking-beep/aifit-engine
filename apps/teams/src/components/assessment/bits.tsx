import type { Estimate } from '@aifit/teams-core';
import { EvidenceLabel, evidenceFromBasis, cn } from '@/design';

/**
 * The engine's provenance tag in the design's vocabulary. Heuristic and
 * benchmark figures read "Estimated"; only calibrated or measured ones read
 * "Verified". The source sentence is always available, never just a colour.
 */
export function Basis({ e, className }: { e: Pick<Estimate<unknown>, 'basis' | 'source'> & { sampleSize?: number }; className?: string }) {
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1.5', className)}>
      <EvidenceLabel kind={evidenceFromBasis(e.basis)} />
      <span className="text-label-sm text-fg-muted">
        {e.basis}
        {e.sampleSize ? ` · n=${e.sampleSize}` : ''}
      </span>
      <span className="sr-only">Source: {e.source}</span>
      <span aria-hidden title={e.source} className="cursor-help text-label-sm text-fg-muted underline decoration-dotted underline-offset-2">source</span>
    </span>
  );
}

export function Stat({ label, value, hint, footer, tone = 'neutral' }: { label: string; value: React.ReactNode; hint?: string; footer?: React.ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'danger' }) {
  return (
    <div className="min-w-0">
      <p className="text-label-sm text-fg-muted">{label}</p>
      <p className={cn('mt-1 font-mono text-data-lg tabular', tone === 'good' && 'text-good', tone === 'warn' && 'text-warn', tone === 'danger' && 'text-danger', tone === 'neutral' && 'text-fg')}>{value}</p>
      {hint && <p className="mt-1 text-body-sm text-fg-muted">{hint}</p>}
      {footer && <div className="mt-2">{footer}</div>}
    </div>
  );
}

export function Bullets({ items, className }: { items: React.ReactNode[]; className?: string }) {
  return (
    <ul className={cn('space-y-1.5', className)}>
      {items.map((x, i) => (
        <li key={i} className="flex gap-2 text-body-sm text-fg-2">
          <span aria-hidden className="text-fg-muted">·</span>
          <span className="min-w-0">{x}</span>
        </li>
      ))}
    </ul>
  );
}

export const usd = (n: number, digits = 0) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);

export const compactUsd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: n >= 10_000 ? 'compact' : 'standard', maximumFractionDigits: n >= 10_000 ? 1 : 0 }).format(n);

export const int = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n));

/** "query" → "queries", "ticket" → "tickets". */
export function plural(unit: string): string {
  if (/[^aeiou]y$/i.test(unit)) return unit.slice(0, -1) + 'ies';
  if (/(s|x|ch|sh)$/i.test(unit)) return unit + 'es';
  return unit + 's';
}
