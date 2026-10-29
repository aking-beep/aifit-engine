import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, RotateCw } from 'lucide-react'
import { Button, Chip, EvidenceLabel, PageHeader, ProgressBar, StageRail, VerdictChip } from '../ds'
import { SAMPLE_PROFILE, SAMPLE_WORKFLOWS } from '../ds/sample/consumer'
import { useConsumer } from '../store'

/** AI profile results — the verdict leads, the reasoning follows. */
export function Profile() {
  const nav = useNavigate()
  const { tools } = useConsumer()
  const top = tools[0]
  return (
    <div>
      <PageHeader
        title="Your AI profile"
        description="Based on your assessment on 12 June. Re-assess any time your work changes."
        actions={
          <Button icon={<RotateCw size={14} />} onClick={() => nav('/assessment')}>
            Re-assess
          </Button>
        }
      />
      <StageRail current="decide" completed={['understand']} />

      <section className="mt-10 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="text-label-sm text-fg-muted">You are a</p>
          <h2 className="mt-1 font-display text-display-lg text-fg">{SAMPLE_PROFILE.archetype}</h2>
          <p className="mt-4 max-w-xl text-body-lg text-fg-2">{SAMPLE_PROFILE.summary}</p>
          <div className="mt-8 rounded-md border border-line bg-surface p-5">
            <p className="text-label-sm text-fg-muted">Your next step</p>
            <p className="mt-1 text-headline-md text-fg">Set up {top.name} with Privacy Mode on</p>
            <p className="mt-1 text-body-sm text-fg-muted">Your highest-fit tool, and it covers your #1 goal. About {top.setupMinutes} minutes.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="primary" iconRight={<ArrowRight size={14} />} onClick={() => nav('/app/configure')}>
                Generate my config
              </Button>
              <Button onClick={() => nav('/app/tools')}>See all recommendations</Button>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-8">
          <div>
            <h3 className="mb-3 text-title-md text-fg">How you work</h3>
            <dl className="flex flex-col gap-3">
              {SAMPLE_PROFILE.traits.map((t) => (
                <div key={t.label}>
                  <div className="flex justify-between text-body-sm">
                    <dt className="text-fg-2">{t.label}</dt>
                    <dd className="font-mono text-fg">{t.value}</dd>
                  </div>
                  <ProgressBar value={t.value} tone="neutral" label={t.label} className="mt-1.5" />
                </div>
              ))}
            </dl>
            <EvidenceLabel kind="estimated" className="mt-3" />
          </div>
          <div>
            <h3 className="mb-2 text-title-md text-fg">Goals</h3>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_PROFILE.goals.map((g) => (
                <Chip key={g}>{g}</Chip>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-title-md text-fg">Constraints we respected</h3>
            <ul className="flex flex-col gap-1.5 text-body-sm text-fg-2">
              {SAMPLE_PROFILE.constraints.map((c) => (
                <li key={c} className="flex items-center justify-between gap-3">
                  {c} <EvidenceLabel kind="assumption" compact />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-headline-md text-fg">What we decided for each goal</h2>
        <p className="mt-1 mb-4 text-body-sm text-fg-muted">Not every goal needs AI. Here’s the right tool for each job.</p>
        <div className="overflow-hidden rounded-md border border-line">
          {SAMPLE_WORKFLOWS.map((w) => (
            <div key={w.id} className="grid gap-2 border-b border-line bg-surface px-5 py-4 last:border-0 md:grid-cols-[1fr_auto_1.4fr] md:items-center md:gap-6">
              <p className="text-label-md text-fg">{w.name}</p>
              <VerdictChip verdict={w.verdict} size="md" />
              <p className="text-body-sm text-fg-muted">{w.verdict === 'no-ai' ? 'Your invoicing app’s built-in reminders already do this reliably. Adding AI would cost more and add risk.' : w.outcome}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
