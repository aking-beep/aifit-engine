import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button, EvidenceLabel, PageHeader, Panel, PanelHeader, RiskBadge, STAGES, VerdictChip, cn, formatMoney, formatRange } from '../ds'
import { EVAL_CHECKS, RISKS, SAMPLE_ORG, SAMPLE_WORKLOADS, TEAM_ACTIVITY } from '../ds/sample/teams'
import { riskLevelOf } from '../ds'

export function TeamsDashboard() {
  const nav = useNavigate()
  const ws = SAMPLE_WORKLOADS
  const low = ws.reduce((s, w) => s + w.investment.low, 0)
  const high = ws.reduce((s, w) => s + w.investment.high, 0)
  const avgReady = Math.round(ws.reduce((s, w) => s + w.readiness, 0) / ws.length)
  const highRisks = RISKS.filter((r) => ['high', 'critical'].includes(riskLevelOf(r)))
  const stageCounts = STAGES.map((s) => ({ ...s, n: ws.filter((w) => w.stage === s.id).length }))

  return (
    <div>
      <PageHeader
        title="Organization overview"
        description={`${SAMPLE_ORG.name} · ${SAMPLE_ORG.industry} · ${SAMPLE_ORG.size} · ${SAMPLE_ORG.region}`}
        actions={
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => nav('/app/intake')}>
            New workload
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Primary: portfolio */}
        <Panel className="xl:col-span-2">
          <div className="flex flex-wrap items-end justify-between gap-6 border-b border-line px-4 py-4">
            <div>
              <p className="text-label-sm text-fg-muted">Estimated monthly run cost · 6 workloads</p>
              <p className="mt-1 font-mono text-data-lg text-fg tabular">
                {formatMoney(low, 'USD', true)}–{formatMoney(high, 'USD', true)}
              </p>
              <EvidenceLabel kind="estimated" className="mt-1" />
            </div>
            <div className="flex gap-8">
              <div>
                <p className="text-label-sm text-fg-muted">Readiness</p>
                <p className="font-mono text-headline-md text-fg">{avgReady}</p>
              </div>
              <div>
                <p className="text-label-sm text-fg-muted">Don’t need AI</p>
                <p className="font-mono text-headline-md text-fg">{ws.filter((w) => ['no-ai', 'automation', 'software'].includes(w.verdict)).length}/6</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-body-sm">
              <thead className="text-left text-label-sm text-fg-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Workload</th>
                  <th className="px-4 py-2 font-medium">Verdict</th>
                  <th className="px-4 py-2 font-medium">Stage</th>
                  <th className="px-4 py-2 font-medium">Risk</th>
                  <th className="px-4 py-2 text-right font-medium">Monthly</th>
                </tr>
              </thead>
              <tbody>
                {ws.map((w) => (
                  <tr key={w.id} onClick={() => nav('/app/verdict')} className="h-9 cursor-pointer border-t border-line transition-colors duration-150 hover:bg-sunken">
                    <td className="px-4 py-2">
                      <span className="text-fg">{w.name}</span>
                      <span className="ml-2 text-fg-muted">{w.department}</span>
                    </td>
                    <td className="px-4 py-2">
                      <VerdictChip verdict={w.verdict} />
                    </td>
                    <td className="px-4 py-2 text-fg-2 capitalize">{w.stage}</td>
                    <td className="px-4 py-2">
                      <RiskBadge level={w.risk} />
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-fg">{w.investment.high === 0 ? '$0' : formatRange({ ...w.investment, per: undefined })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Secondary column */}
        <div className="flex flex-col gap-4">
          <Panel>
            <PanelHeader title="Assessment status" />
            <div className="p-4">
              <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
                {stageCounts.map((s, i) => s.n > 0 && <span key={s.id} className={cn('h-full', ['bg-fg-muted/40', 'bg-fg-muted/70', 'bg-fg-2', 'bg-fg', 'bg-accent'][i])} style={{ flex: s.n }} />)}
              </div>
              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-body-sm">
                {stageCounts.map((s) => (
                  <li key={s.id} className="flex justify-between">
                    <span className="text-fg-2">{s.label}</span>
                    <span className="font-mono text-fg">{s.n}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>
          <Panel>
            <PanelHeader title="Risk indicators" actions={<Button size="sm" variant="ghost" onClick={() => nav('/app/risks')}>Register</Button>} />
            <ul>
              {highRisks.slice(0, 3).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-2 last:border-0">
                  <span className="min-w-0 truncate text-body-sm text-fg">{r.title}</span>
                  <RiskBadge level={riskLevelOf(r)} />
                </li>
              ))}
            </ul>
          </Panel>
          <Panel>
            <PanelHeader title="Evaluation status" actions={<Button size="sm" variant="ghost" onClick={() => nav('/app/evaluation')}>Open</Button>} />
            <div className="p-4 text-body-sm">
              <p className="text-fg-2">
                Support triage: <span className="font-mono text-fg">{EVAL_CHECKS.filter((c) => c.status === 'pass').length}</span> pass, <span className="font-mono text-danger">{EVAL_CHECKS.filter((c) => c.status === 'fail').length}</span> fail,{' '}
                <span className="font-mono text-fg">{EVAL_CHECKS.filter((c) => c.status === 'pending' || c.status === 'untested').length}</span> not run
              </p>
              <p className="mt-1 text-fg-muted">Grounding is below threshold — blocks go-live.</p>
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-headline-md text-fg">Recommended solutions</h2>
          <ul className="overflow-hidden rounded-md border border-line bg-surface">
            {[
              { w: 'Customer support triage', s: 'Zendesk AI agents + own redaction layer', next: 'Fix grounding before shadow mode', to: 'evaluation' },
              { w: 'Invoice data extraction', s: 'Custom document model on Bedrock', next: 'Approve architecture', to: 'architecture' },
              { w: 'Payroll reconciliation', s: 'Keep existing payroll rules — no AI', next: 'Close workload', to: 'verdict' },
            ].map((r) => (
              <li key={r.w} className="border-b border-line px-4 py-3 last:border-0">
                <p className="text-label-md text-fg">{r.w}</p>
                <p className="text-body-sm text-fg-2">{r.s}</p>
                <button onClick={() => nav(`/app/${r.to}`)} className="mt-1 text-label-sm text-accent hover:underline">
                  Next: {r.next} →
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="mb-3 text-headline-md text-fg">Recent activity</h2>
          <ol className="flex flex-col">
            {TEAM_ACTIVITY.map((a) => (
              <li key={a.id} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-0">
                <p className="text-body-sm text-fg-2">
                  <span className="text-fg">{a.actor}</span> {a.action} <span className="text-fg">{a.target}</span>
                </p>
                <span className="shrink-0 text-label-sm text-fg-muted">{a.at}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  )
}
