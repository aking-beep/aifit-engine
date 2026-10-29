'use client';

import { useMemo, useState } from 'react';
import { valueModel, type Estimate, type Workload } from '@aifit/teams-core';
import { Button, EvidenceLabel, Slider } from '@/design';

/**
 * What-if inputs for the value model. The arithmetic is the engine's own
 * (`valueModel` from @aifit/teams-core), not a copy. Anything you change here is
 * your assumption and is labelled so; nothing is saved.
 */
export function RoiExplorer({ workload, aiCostPerUnit, buildCost }: { workload: Workload; aiCostPerUnit: Estimate; buildCost: number }) {
  const start = {
    units: workload.volume.unitsPerMonth,
    minutes: workload.current.minutesPerUnit ?? 0,
    hourly: workload.current.fullyLoadedHourlyUsd ?? 0,
    share: 60,
  };
  const [v, setV] = useState(start);
  const changed = JSON.stringify(v) !== JSON.stringify(start);
  const model = useMemo(() => {
    const w: Workload = {
      ...workload,
      volume: { ...workload.volume, unitsPerMonth: v.units },
      current: { ...workload.current, minutesPerUnit: v.minutes || undefined, fullyLoadedHourlyUsd: v.hourly || undefined, costPerUnitUsd: undefined },
    };
    return valueModel(w, aiCostPerUnit, buildCost, v.share / 100);
  }, [workload, aiCostPerUnit, buildCost, v]);
  const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
  const maxUnits = Math.max(1000, Math.ceil((workload.volume.unitsPerMonth * 4) / 100) * 100);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <Slider label="Units per month" value={v.units} min={0} max={maxUnits} step={Math.max(1, Math.round(maxUnits / 200))} onChange={(n) => setV({ ...v, units: n })} format={(n) => n.toLocaleString('en-US')} />
        <Slider label="Minutes per unit today" value={v.minutes} min={0} max={120} step={0.5} onChange={(n) => setV({ ...v, minutes: n })} format={(n) => `${n} min`} />
        <Slider label="Loaded hourly cost" value={v.hourly} min={0} max={300} step={1} onChange={(n) => setV({ ...v, hourly: n })} format={(n) => money(n)} />
        <Slider label="Share of the task AI removes" value={v.share} min={5} max={100} step={5} onChange={(n) => setV({ ...v, share: n })} format={(n) => `${n}%`} />
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={() => setV(start)} disabled={!changed}>Reset to your answers</Button>
          {changed ? <EvidenceLabel kind="assumption" /> : null}
          <span className="text-body-sm text-fg-muted">{changed ? 'What-if values, not saved.' : 'Your intake answers. 60% is the engine default share.'}</span>
        </div>
      </div>
      <dl className="space-y-4 rounded-md border border-line bg-sunken p-4" aria-live="polite">
        <Row label="Net per month" value={model.netPerMonth ? money(model.netPerMonth.value) : 'Unknowable'} />
        <Row label="Payback" value={model.paybackMonths ? `${model.paybackMonths.value.toFixed(1)} months` : model.netPerMonth && model.netPerMonth.value <= 0 ? 'Never at these inputs' : 'Unknowable'} />
        <Row label="Human cost per unit" value={model.humanCostPerUnit ? money(model.humanCostPerUnit.value) : 'Not supplied'} />
        <Row label="AI cost per unit" value={new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 }).format(aiCostPerUnit.value)} />
        {model.unknowns.length ? <ul className="list-disc space-y-1 pl-4 text-body-sm text-fg-muted">{model.unknowns.map((u) => <li key={u}>{u}</li>)}</ul> : null}
        {model.netPerMonth && model.netPerMonth.value <= 0 ? (
          <p className="text-body-sm text-fg-2">At these inputs it does not pay back. That is a valid answer; rules-based automation or no change may serve better.</p>
        ) : null}
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-label-sm text-fg-muted">{label}</dt>
      <dd className="mt-0.5 font-mono text-data-md text-fg tabular">{value}</dd>
    </div>
  );
}
