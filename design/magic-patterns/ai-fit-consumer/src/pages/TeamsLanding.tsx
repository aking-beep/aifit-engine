import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button, DownloadPreview, EvidenceLabel, Logo, PricingCard, RiskBadge, ThemeToggle, VerdictChip, VERDICT_META, formatRange, plansFor } from '../ds'
import type { Verdict } from '../ds'
import { BLUEPRINT_FILES, SAMPLE_WORKLOADS } from '../ds/sample/teams'

export function TeamsLanding() {
  const nav = useNavigate()
  return (
    <div className="h-full overflow-y-auto bg-canvas">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-6 px-4 lg:px-8">
          <Logo product="Teams" />
          <nav className="hidden items-center gap-5 text-label-md text-fg-muted md:flex">
            <a href="#verdicts" className="hover:text-fg">Verdicts</a>
            <a href="#deliverables" className="hover:text-fg">Deliverables</a>
            <a href="#pricing" className="hover:text-fg">Pricing</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => nav('/app')}>
              Sign in
            </Button>
            <Button variant="primary" size="sm" onClick={() => nav('/onboarding')}>
              Assess a workload
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1200px] px-4 pt-16 pb-12 lg:px-8 lg:pt-24">
        <h1 className="max-w-4xl font-display text-[40px] leading-[1.05] font-semibold tracking-[-0.035em] text-fg sm:text-display-xl">
          Know what to automate, what to build, and what to avoid.
        </h1>
        <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <p className="max-w-2xl text-body-lg text-fg-2">
            AI Fit Teams assesses each business workload and returns a defensible verdict — AI, conventional software, automation, or nothing at all — with the architecture, costs, risks and evaluation plan to act on it.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" size="lg" iconRight={<ArrowRight size={16} />} onClick={() => nav('/onboarding')}>
              Start an assessment
            </Button>
            <Button size="lg" onClick={() => nav('/app')}>
              View sample workspace
            </Button>
          </div>
        </div>
      </section>

      {/* Portfolio preview */}
      <section className="mx-auto max-w-[1200px] px-4 pb-20 lg:px-8">
        <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <p className="text-label-md text-fg">Northwind Logistics · workload portfolio</p>
            <span className="text-label-sm text-fg-muted">Sample data</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-body-sm">
              <thead className="bg-sunken text-left text-label-sm text-fg-muted">
                <tr>
                  <th className="px-5 py-2 font-medium">Workload</th>
                  <th className="px-5 py-2 font-medium">Verdict</th>
                  <th className="px-5 py-2 font-medium">Risk</th>
                  <th className="px-5 py-2 text-right font-medium">Run cost</th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE_WORKLOADS.slice(0, 5).map((w) => (
                  <tr key={w.id} className="border-t border-line">
                    <td className="px-5 py-3">
                      <span className="text-fg">{w.name}</span>
                      <span className="ml-2 text-fg-muted">{w.department}</span>
                    </td>
                    <td className="px-5 py-3">
                      <VerdictChip verdict={w.verdict} />
                    </td>
                    <td className="px-5 py-3">
                      <RiskBadge level={w.risk} />
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-fg">{w.investment.high === 0 ? '$0' : formatRange(w.investment)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="verdicts" className="border-t border-line bg-surface">
        <div className="mx-auto max-w-[1200px] px-4 py-16 lg:px-8 lg:py-24">
          <h2 className="max-w-3xl font-display text-display-lg text-fg">Five possible answers. Only one of them is “build custom AI”.</h2>
          <p className="mt-4 max-w-2xl text-body-lg text-fg-2">Our verdicts are weighted, explained and evidence-labelled, so you can defend them to a board, an auditor, or a sceptical engineering lead.</p>
          <dl className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-5">
            {(['no-ai', 'automation', 'software', 'buy', 'build'] as Verdict[]).map((v) => (
              <div key={v}>
                <dt>
                  <VerdictChip verdict={v} size="md" />
                </dt>
                <dd className="mt-3 text-body-sm text-fg-2">{VERDICT_META[v].sentence}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="deliverables" className="border-t border-line">
        <div className="mx-auto grid max-w-[1200px] gap-12 px-4 py-16 lg:grid-cols-[1fr_1.4fr] lg:px-8 lg:py-24">
          <div>
            <h2 className="font-display text-display-lg text-fg">A blueprint your engineers can start from on Monday.</h2>
            <p className="mt-4 text-body-lg text-fg-2">Architecture, model choice, infrastructure, cost model, risk register, evaluation plan and a phased roadmap — exported as Markdown and JSON.</p>
            <div className="mt-6 flex flex-col gap-2">
              <EvidenceLabel kind="verified" asOf="2025-06" />
              <EvidenceLabel kind="estimated" />
              <EvidenceLabel kind="untested" />
            </div>
            <p className="mt-3 text-body-sm text-fg-muted">Every line in the blueprint says what it rests on.</p>
          </div>
          <DownloadPreview name="northwind-support-triage-blueprint" files={BLUEPRINT_FILES} meta="4 files · sample" />
        </div>
      </section>

      <section id="pricing" className="border-t border-line bg-surface">
        <div className="mx-auto max-w-[1200px] px-4 py-16 lg:px-8 lg:py-24">
          <h2 className="font-display text-display-lg text-fg">Pay per decision, or run your whole portfolio.</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {plansFor('teams').map((p) => (
              <PricingCard key={p.id} plan={p} onSelect={() => nav('/onboarding')} />
            ))}
          </div>
          <p className="mt-4 text-body-sm text-fg-muted">Prices shown from plan configuration. Enterprise terms available.</p>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-8 text-body-sm text-fg-muted lg:px-8">
          <Logo product="Teams" />
          <p>From AI uncertainty to a validated implementation plan · ARC Transformation Group</p>
        </div>
      </footer>
    </div>
  )
}
