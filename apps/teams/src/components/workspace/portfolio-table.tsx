'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Drawer, EvidenceLabel, KeyValue, RiskBadge, Tabs, VerdictChip, formatRange, verdictFromOutcome, type EngineOutcome } from '@/design';
import type { PortfolioRow } from '@/server/portfolio';

type Filter = 'all' | 'ai' | 'non-ai';
const RISK = { low: 'low', moderate: 'medium', high: 'high', severe: 'critical' } as const;

export function PortfolioTable({ rows }: { rows: PortfolioRow[] }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<PortfolioRow | null>(null);
  const isAi = (r: PortfolioRow) => r.outcome === 'buy_ai' || r.outcome === 'build_ai';
  const shown = useMemo(() => rows
    .filter((r) => filter === 'all' || (filter === 'ai' ? isAi(r) : !isAi(r)))
    .filter((r) => !q.trim() || r.title.toLowerCase().includes(q.trim().toLowerCase())), [rows, q, filter]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="portfolio-search">Search workloads</label>
        <input id="portfolio-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search workloads" className="h-9 w-64 rounded-sm border border-line-strong bg-surface px-3 text-body-md text-fg placeholder:text-fg-muted" />
        <Tabs<Filter> variant="segmented" value={filter} onChange={setFilter} tabs={[
          { value: 'all', label: 'All', count: rows.length },
          { value: 'ai', label: 'AI recommended', count: rows.filter(isAi).length },
          { value: 'non-ai', label: 'Non-AI', count: rows.filter((r) => !isAi(r)).length },
        ]} />
      </div>
      <div className="overflow-x-auto rounded-md border border-line bg-surface">
        <table className="w-full min-w-[820px] text-body-sm">
          <caption className="sr-only">Saved workloads</caption>
          <thead>
            <tr className="border-b border-line text-left text-label-sm text-fg-muted">
              <th scope="col" className="px-4 py-2 font-medium">Workload</th>
              <th scope="col" className="px-3 py-2 font-medium">Recommendation</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Suitability</th>
              <th scope="col" className="px-3 py-2 font-medium">Risk</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Run cost / mo</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Volume / mo</th>
              <th scope="col" className="px-4 py-2 font-medium">Saved</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2">
                  <button type="button" onClick={() => setOpen(r)} className="text-left text-label-md text-fg underline-offset-2 hover:underline">{r.title}</button>
                  <span className="block text-label-sm text-fg-muted">v{r.version}{r.versions > 1 ? ` of ${r.versions}` : ''}</span>
                </td>
                <td className="px-3 py-2"><VerdictChip verdict={verdictFromOutcome(r.outcome as EngineOutcome)} /></td>
                <td className="px-3 py-2 text-right font-mono tabular text-fg">{r.suitability}</td>
                <td className="px-3 py-2"><RiskBadge level={RISK[r.riskLevel as keyof typeof RISK] ?? 'medium'} /></td>
                <td className="px-3 py-2 text-right font-mono tabular text-fg">{r.monthly && r.monthly.high > 0 ? formatRange({ low: r.monthly.low, high: r.monthly.high, currency: 'USD', per: 'month' }) : '≈ $0'}</td>
                <td className="px-3 py-2 text-right font-mono tabular text-fg-2">{r.units.toLocaleString('en-US')}</td>
                <td className="px-4 py-2 text-fg-muted"><time dateTime={r.createdAt}>{r.createdAt.slice(0, 10)}</time></td>
              </tr>
            ))}
            {shown.length === 0 ? <tr><td colSpan={7} className="px-4 py-6 text-center text-fg-muted">No workloads match.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <Drawer open={open !== null} onClose={() => setOpen(null)} title={open?.title ?? ''} footer={open ? <Link href={`/workspace/assessments/${open.id}`} className="inline-flex h-9 items-center rounded-sm bg-accent px-3.5 text-label-md text-on-accent">Open assessment</Link> : undefined}>
        {open ? (
          <dl>
            <KeyValue label="Recommendation"><VerdictChip verdict={verdictFromOutcome(open.outcome as EngineOutcome)} /></KeyValue>
            <KeyValue label="Suitability verdict">{open.verdict}</KeyValue>
            <KeyValue label="Suitability score">{open.suitability} / 100</KeyValue>
            <KeyValue label="Risk">{open.riskLevel}</KeyValue>
            <KeyValue label="Run cost / month">{open.monthly && open.monthly.high > 0 ? <span className="inline-flex items-center gap-2">{formatRange({ low: open.monthly.low, high: open.monthly.high, currency: 'USD', per: 'month' })}<EvidenceLabel kind={open.monthly.basis === 'measured' || open.monthly.basis === 'calibrated' ? 'verified' : 'estimated'} compact /></span> : '≈ $0'}</KeyValue>
            <KeyValue label="Launch-blocking controls">{open.blockingControls}</KeyValue>
            <KeyValue label="Evaluation checks planned">{open.evalChecks} (not run)</KeyValue>
            <KeyValue label="Saved by">{open.createdBy}</KeyValue>
          </dl>
        ) : null}
      </Drawer>
    </div>
  );
}
