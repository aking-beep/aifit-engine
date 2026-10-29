import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button, Drawer, EvidenceLabel, Modal, ReasonList, ScoreRing, Tabs, VerdictChip, VERDICT_META } from '../ds'
import type { Verdict as V } from '../ds'
import { SUITABILITY_REASONS } from '../ds/sample/teams'
import { WorkloadHeader } from '../layout/WorkloadHeader'

const ALTERNATIVES: { v: V; score: number; why: string }[] = [
  { v: 'buy', score: 84, why: 'Mature vendors cover triage in Zendesk; fastest path with acceptable control.' },
  { v: 'build', score: 61, why: 'More control, but 3× cost and 12+ weeks with no quality advantage at this volume.' },
  { v: 'automation', score: 48, why: 'Rules cover ~30% of intents (tracking lookups); misses free-text nuance.' },
  { v: 'software', score: 35, why: 'Existing Zendesk macros already in use; ceiling reached.' },
  { v: 'no-ai', score: 22, why: 'Status quo misses the 4-hour response target by 5 hours.' },
]

/** AI suitability verdict — the answer first, the reasoning one click away. */
export function Verdict() {
  const nav = useNavigate()
  const [why, setWhy] = useState(false)
  const [preview, setPreview] = useState<'buy' | 'no-ai'>('buy')
  const [accept, setAccept] = useState(false)
  const isNoAi = preview === 'no-ai'
  return (
    <div>
      <WorkloadHeader
        stage="decide"
        title="AI suitability verdict"
        actions={
          <Tabs
            variant="segmented"
            value={preview}
            onChange={(v) => setPreview(v as 'buy' | 'no-ai')}
            tabs={[
              { value: 'buy', label: 'Support triage' },
              { value: 'no-ai', label: 'Payroll (No-AI example)' },
            ]}
          />
        }
      />

      <section className="grid gap-8 rounded-md border border-line bg-surface p-6 lg:grid-cols-[1fr_auto] lg:p-8">
        <div>
          <VerdictChip verdict={isNoAi ? 'no-ai' : 'buy'} size="md" />
          <h2 className="mt-4 max-w-3xl font-display text-display-lg text-fg">{isNoAi ? 'Don’t use AI for payroll reconciliation.' : 'Buy a triage product, and add your own guardrails.'}</h2>
          <p className="mt-3 max-w-2xl text-body-md text-fg-2">
            {isNoAi
              ? 'Two runs a month, zero error tolerance, and your payroll system already reconciles with deterministic rules. AI would add cost and audit risk with no measurable gain.'
              : 'High-volume, repetitive tickets with a human safety net make this a strong AI fit. A vendor gets you live in 3–5 weeks; your redaction and grounding layer addresses the PII and accuracy risks.'}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {isNoAi ? (
              <Button variant="primary" onClick={() => setAccept(true)}>
                Accept and close workload
              </Button>
            ) : (
              <Button variant="primary" iconRight={<ArrowRight size={14} />} onClick={() => nav('/app/build-vs-buy')}>
                Compare build vs buy
              </Button>
            )}
            <Button onClick={() => setWhy(true)}>Why this verdict</Button>
          </div>
        </div>
        <div className="flex items-center gap-6 lg:flex-col lg:items-end">
          <ScoreRing value={isNoAi ? 12 : 84} size={88} label="Suitability" />
          <div className="lg:text-right">
            <p className="text-label-sm text-fg-muted">Suitability score</p>
            <EvidenceLabel kind="recommendation" />
            <p className="mt-1 text-label-sm text-fg-muted">Confidence <span className="font-mono text-fg">{isNoAi ? '0.93' : '0.84'}</span></p>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-1 text-headline-md text-fg">How every option scored</h2>
        <p className="mb-4 text-body-sm text-fg-muted">The verdict is the highest score that also meets your constraints.</p>
        <div className="overflow-hidden rounded-md border border-line bg-surface">
          {(isNoAi ? [...ALTERNATIVES].reverse().map((a, i) => ({ ...a, score: [93, 40, 28, 18, 12][i], why: ['Deterministic rules already reconcile correctly; 2 runs/month.', 'Payroll system has built-in exception reports.', 'Rules already automated in payroll system.', 'Off-the-shelf AI tools add audit burden.', 'No quality or speed gain to justify custom work.'][i] })) : ALTERNATIVES).map((a, i) => (
            <div key={a.v} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 border-b border-line px-4 py-3 last:border-0 md:grid-cols-[180px_200px_1fr]">
              <VerdictChip verdict={a.v} size="md" className={i === 0 ? 'border-fg' : ''} />
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-28 overflow-hidden rounded-full bg-sunken">
                  <div className={i === 0 ? 'h-full bg-fg' : 'h-full bg-fg-muted'} style={{ width: `${a.score}%` }} />
                </div>
                <span className="font-mono text-label-sm text-fg">{a.score}</span>
              </div>
              <p className="col-span-2 text-body-sm text-fg-2 md:col-span-1">{a.why}</p>
            </div>
          ))}
        </div>
      </section>

      <Drawer open={why} onClose={() => setWhy(false)} title="Why this verdict">
        <p className="mb-4 text-body-sm text-fg-2">{VERDICT_META[isNoAi ? 'no-ai' : 'buy'].sentence} Factors are weighted by the seven-dimension rubric; weights are configuration, not code.</p>
        <ReasonList reasons={SUITABILITY_REASONS} />
        <h3 className="mt-6 mb-2 text-title-md text-fg">Assumptions you can change</h3>
        <ul className="flex flex-col gap-2 text-body-sm text-fg-2">
          <li className="flex items-center justify-between gap-3">Agents catch misroutes in one hop <EvidenceLabel kind="assumption" compact /></li>
          <li className="flex items-center justify-between gap-3">Ticket volume stays within ±20% <EvidenceLabel kind="assumption" compact /></li>
        </ul>
        <Button className="mt-4" size="sm" onClick={() => nav('/app/intake')}>
          Edit intake answers
        </Button>
      </Drawer>
      <Modal
        open={accept}
        onClose={() => setAccept(false)}
        title="Close this workload as No AI?"
        description="It stays in your portfolio as a decided workload. Anyone can re-open it if the process changes."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAccept(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => { setAccept(false); nav('/app/workspace') }}>Close workload</Button>
          </>
        }
      />
    </div>
  )
}
