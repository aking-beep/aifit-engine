import { Banner, Chip, Panel as DPanel, PanelHeader, ProgressBar, cn } from '@/design';
import { Basis } from './assessment/bits';

/**
 * The few pre-2.0 component shapes the remaining pages still use (Panel with a
 * title, Badge, BasisTag, Callout, CardTable, DimensionList), drawn with the
 * design system so every Teams screen shares one look and one contrast check.
 */

type Tone = 'neutral' | 'good' | 'warn' | 'danger' | 'info' | 'signal';

export function Panel({ title, subtitle, right, children, className }: { title?: React.ReactNode; subtitle?: React.ReactNode; right?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <DPanel className={className}>
      {title || right ? <PanelHeader title={title ?? ''} description={subtitle} actions={right} /> : null}
      <div className="px-4 py-4">{children}</div>
    </DPanel>
  );
}

/** Tone is carried by the word, not by colour: badges stay neutral unless they report a measured outcome. */
export function Badge({ children, tone = 'neutral', className, title }: { children: React.ReactNode; tone?: Tone; className?: string; title?: string }) {
  return (
    <span title={title}>
      <Chip className={cn(tone === 'danger' && 'text-danger', className)}>{children}</Chip>
    </span>
  );
}

export function BasisTag({ basis, source, sampleSize }: { basis: 'heuristic' | 'benchmark' | 'calibrated' | 'measured'; source?: string; sampleSize?: number }) {
  return <Basis e={{ basis, source: source ?? `${basis} figure`, sampleSize }} />;
}

export function Callout({ tone = 'info', title, children }: { tone?: Tone; title?: React.ReactNode; children: React.ReactNode }) {
  const t = tone === 'danger' ? 'danger' : tone === 'warn' ? 'warn' : tone === 'good' ? 'success' : 'info';
  return <Banner tone={t} title={typeof title === 'string' ? title : ''}>{children}</Banner>;
}

export interface CardColumn { label: string; align?: 'left' | 'right'; mono?: boolean; className?: string }

export function CardTable({ columns, rows, className, label }: { columns: CardColumn[]; rows: { key: string; cells: React.ReactNode[] }[]; className?: string; label?: string }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-[560px] text-body-sm" aria-label={label}>
        <thead>
          <tr className="border-b border-line text-label-sm text-fg-muted">
            {columns.map((c, i) => <th key={i} scope="col" className={cn('px-3 py-2 font-medium', (c.align ?? (i === 0 ? 'left' : 'right')) === 'left' ? 'text-left' : 'text-right')}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-line align-top last:border-0">
              {r.cells.map((cell, i) => (
                <td key={i} className={cn('px-3 py-2 text-fg-2', (columns[i]?.align ?? (i === 0 ? 'left' : 'right')) === 'left' ? 'text-left' : 'text-right', columns[i]?.mono && 'font-mono', columns[i]?.className)}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DimensionList({ dimensions, showWeight = false }: { dimensions: { key: string; label: string; score: number; weight: number; reasoning?: string }[]; showWeight?: boolean; spacing?: 'tight' | 'roomy' }) {
  return (
    <ul className="space-y-4">
      {dimensions.map((d) => (
        <li key={d.key}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-body-sm text-fg">{d.label}{showWeight ? <span className="ml-2 font-mono text-label-sm text-fg-muted">weight {d.weight.toFixed(2)}</span> : null}</span>
            <span className="font-mono text-label-sm text-fg-muted">{Math.round(d.score)}</span>
          </div>
          <ProgressBar value={d.score} tone="neutral" label={`${d.label} score`} className="mt-1.5" />
          {d.reasoning ? <p className="mt-1.5 max-w-3xl text-body-sm text-fg-muted">{d.reasoning}</p> : null}
        </li>
      ))}
    </ul>
  );
}
