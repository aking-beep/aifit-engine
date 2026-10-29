import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button, EvidenceLabel, Logo, PricingCard, STAGES, ThemeToggle, VerdictChip, plansFor } from '../ds'
import { SAMPLE_TOOLS, SAMPLE_WORKFLOWS } from '../ds/sample/consumer'

export function Landing() {
  const nav = useNavigate()
  const start = () => nav('/onboarding')
  return (
    <div className="h-full overflow-y-auto bg-canvas">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-6 px-4 lg:px-8">
          <Logo product="Consumer" />
          <nav className="hidden items-center gap-5 text-label-md text-fg-muted md:flex">
            <a href="#how" className="hover:text-fg">How it works</a>
            <a href="#honest" className="hover:text-fg">Honest answers</a>
            <a href="#pricing" className="hover:text-fg">Pricing</a>
            <span className="text-fg-muted">For teams</span>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => nav('/app')} className="hidden sm:inline-flex">
              Sign in
            </Button>
            <Button variant="primary" size="sm" onClick={start}>
              Start free
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 pt-16 pb-16 lg:grid-cols-[1.05fr_1fr] lg:px-8 lg:pt-24 lg:pb-24">
        <div>
          <h1 className="font-display text-[40px] leading-[1.05] font-semibold tracking-[-0.035em] text-fg sm:text-display-xl">
            Find the right AI tools. Get set up. Start creating.
          </h1>
          <p className="mt-5 max-w-xl text-body-lg text-fg-2">
            A five-minute assessment matches you to tools that fit how you work, your budget and your privacy needs — then generates the setup files so you’re productive today.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button variant="primary" size="lg" onClick={start} iconRight={<ArrowRight size={16} />}>
              Take the 5-minute assessment
            </Button>
            <Button variant="ghost" size="lg" onClick={() => nav('/app')}>
              See a sample result
            </Button>
          </div>
          <p className="mt-4 text-body-sm text-fg-muted">Free. No card. We’ll tell you if you don’t need AI at all.</p>
        </div>
        <HeroPreview />
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-line">
        <div className="mx-auto max-w-[1200px] px-4 py-16 lg:px-8 lg:py-24">
          <h2 className="max-w-2xl text-display-lg font-display text-fg">From “which AI?” to working setup in one sitting.</h2>
          <ol className="mt-12 grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
            {STAGES.map((s, i) => (
              <li key={s.id} className="bg-surface p-5">
                <span className="font-mono text-label-sm text-fg-muted">{i + 1}</span>
                <p className="mt-6 text-title-md text-fg">{s.label}</p>
                <p className="mt-1 text-body-sm text-fg-muted">{CONSUMER_STAGE_COPY[i]}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Honest answers */}
      <section id="honest" className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-[1200px] gap-12 px-4 py-16 lg:grid-cols-2 lg:px-8 lg:py-24">
          <div>
            <h2 className="text-display-lg font-display text-fg">Sometimes the best AI tool is no AI tool.</h2>
            <p className="mt-4 max-w-lg text-body-lg text-fg-2">
              If a built-in feature or a simple automation does the job, we say so — with the reasoning. You’ll never be sold a subscription you don’t need.
            </p>
            <div className="mt-8 flex flex-col gap-3 text-body-md text-fg-2">
              <p className="flex items-center gap-3"><EvidenceLabel kind="verified" /> means we checked a dated source.</p>
              <p className="flex items-center gap-3"><EvidenceLabel kind="estimated" /> means modelled — expect a range.</p>
              <p className="flex items-center gap-3"><EvidenceLabel kind="untested" /> means we don’t know yet, and say so.</p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {SAMPLE_WORKFLOWS.map((w) => (
              <div key={w.id} className="rounded-md border border-line bg-canvas p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-title-md text-fg">{w.name}</p>
                    <p className="mt-0.5 text-body-sm text-fg-muted">{w.outcome}</p>
                  </div>
                  <VerdictChip verdict={w.verdict} />
                </div>
                <p className="mt-3 flex items-center gap-2 text-body-sm text-fg-2">
                  Saves <span className="font-mono text-fg">{w.timeSaved.value}</span>
                  <EvidenceLabel kind={w.timeSaved.evidence} />
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-line">
        <div className="mx-auto max-w-[1200px] px-4 py-16 lg:px-8 lg:py-24">
          <h2 className="text-display-lg font-display text-fg">Start free. Upgrade when it’s working.</h2>
          <div className="mt-10 grid max-w-3xl gap-4 md:grid-cols-2">
            {plansFor('consumer').map((p) => (
              <PricingCard key={p.id} plan={p} onSelect={start} />
            ))}
          </div>
          <p className="mt-4 text-body-sm text-fg-muted">Prices shown from plan configuration. Taxes may apply.</p>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-8 text-body-sm text-fg-muted lg:px-8">
          <Logo product="Consumer" />
          <p>© ARC Transformation Group · Privacy · Terms</p>
        </div>
      </footer>
    </div>
  )
}

const CONSUMER_STAGE_COPY = [
  'Tell us what you make, the tools you use, and your limits.',
  'Get tools — or a no-AI option — ranked with reasons.',
  'Download settings, rules and scripts made for you.',
  'Check privacy and setup steps actually took effect.',
  'Track progress and re-assess when tools change.',
]

function HeroPreview() {
  const t = SAMPLE_TOOLS[0]
  return (
    <div className="rounded-xl border border-line bg-surface p-2 shadow-pop">
      <div className="rounded-lg border border-line bg-canvas">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <p className="text-label-md text-fg">Your top match</p>
          <span className="text-label-sm text-fg-muted">Sample result</span>
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-label-sm text-fg-muted">{t.category}</p>
              <p className="text-headline-lg text-fg">{t.name}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-data-lg text-fg">{t.fit}</p>
              <p className="text-label-sm text-fg-muted">fit score</p>
            </div>
          </div>
          <p className="mt-3 text-body-sm text-fg-2">{t.whyItFits}</p>
          <ul className="mt-4 border-t border-line">
            {t.reasons.slice(0, 3).map((r) => (
              <li key={r.label} className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-0">
                <span className="text-body-sm text-fg">
                  <span className="mr-2 font-mono text-fg-muted">{r.direction === 'for' ? '+' : '−'}</span>
                  {r.label}
                </span>
                <EvidenceLabel kind={r.evidence} />
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between rounded-md bg-sunken px-3 py-2.5">
            <span className="font-mono text-code-sm text-fg-2">.cursor/settings.json</span>
            <span className="text-label-sm text-fg-muted">ready to download</span>
          </div>
        </div>
      </div>
    </div>
  )
}
