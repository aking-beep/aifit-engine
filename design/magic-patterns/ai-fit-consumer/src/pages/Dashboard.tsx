import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Check, FileCode2 } from 'lucide-react'
import { Button, EvidenceLabel, PageHeader, Panel, PanelHeader, ProgressBar, StageRail, VerdictChip, cn } from '../ds'
import { SAMPLE_ACTIVITY, SAMPLE_PROFILE, SAMPLE_USER, SAMPLE_WORKFLOWS } from '../ds/sample/consumer'
import { SETUP_STEPS, useConsumer } from '../store'

export function Dashboard() {
  const nav = useNavigate()
  const { tools, setupDone, toggleSetup } = useConsumer()
  const doneCount = setupDone.length
  const next = SETUP_STEPS.find((s) => !setupDone.includes(s.id))

  return (
    <div>
      <PageHeader title={`Good afternoon, ${SAMPLE_USER.name.split(' ')[0]}`} description="You’re in the Configure stage. Finish setup to start measuring time saved." />
      <StageRail current="configure" completed={['understand', 'decide']} />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Primary: next action + setup progress */}
        <Panel>
          <div className="p-6">
            <p className="text-label-sm text-fg-muted">Next recommended action</p>
            {next ? (
              <>
                <h2 className="mt-1 text-headline-md text-fg">{next.label}</h2>
                <p className="mt-1 text-body-md text-fg-muted">Takes about 5 minutes. Your generated config already includes the right settings.</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button variant="primary" iconRight={<ArrowRight size={14} />} onClick={() => nav('/app/configure')}>
                    Open setup guide
                  </Button>
                  <Button onClick={() => toggleSetup(next.id)}>Mark as done</Button>
                </div>
              </>
            ) : (
              <>
                <h2 className="mt-1 text-headline-md text-fg">Setup complete</h2>
                <p className="mt-1 text-body-md text-fg-muted">We’ll check in after a week to measure what changed.</p>
              </>
            )}
          </div>
          <div className="border-t border-line px-6 py-5">
            <div className="mb-3 flex items-baseline justify-between">
              <p className="text-label-md text-fg">Setup progress</p>
              <p className="font-mono text-label-sm text-fg-muted">
                {doneCount}/{SETUP_STEPS.length}
              </p>
            </div>
            <ProgressBar value={(doneCount / SETUP_STEPS.length) * 100} label="Setup progress" />
            <ul className="mt-4 flex flex-col">
              {SETUP_STEPS.map((s) => {
                const on = setupDone.includes(s.id)
                return (
                  <li key={s.id}>
                    <button onClick={() => toggleSetup(s.id)} className="flex w-full items-center gap-3 py-2 text-left">
                      <span className={cn('flex h-4 w-4 items-center justify-center rounded-full border', on ? 'border-fg bg-fg text-canvas' : 'border-line-strong')}>{on && <Check size={10} strokeWidth={3} />}</span>
                      <span className={cn('flex-1 text-body-sm', on ? 'text-fg-muted line-through' : 'text-fg')}>{s.label}</span>
                      <span className="text-label-sm text-fg-muted">{s.tool}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </Panel>

        {/* Profile */}
        <Panel>
          <PanelHeader title="Your AI profile" actions={<Button size="sm" variant="ghost" onClick={() => nav('/app/profile')}>View</Button>} />
          <div className="p-4">
            <p className="text-headline-md text-fg">{SAMPLE_PROFILE.archetype}</p>
            <p className="mt-1 text-body-sm text-fg-muted">{SAMPLE_PROFILE.summary}</p>
            <dl className="mt-4 flex flex-col gap-2.5">
              {SAMPLE_PROFILE.traits.map((t) => (
                <div key={t.label}>
                  <div className="flex justify-between text-body-sm">
                    <dt className="text-fg-2">{t.label}</dt>
                    <dd className="font-mono text-fg">{t.value}</dd>
                  </div>
                  <ProgressBar value={t.value} tone="neutral" label={t.label} className="mt-1 h-1" />
                </div>
              ))}
            </dl>
          </div>
        </Panel>
      </div>

      {/* Recommended tools */}
      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-headline-md text-fg">Recommended tools</h2>
          <Button size="sm" variant="ghost" onClick={() => nav('/app/tools')}>
            All recommendations
          </Button>
        </div>
        <ul className="overflow-hidden rounded-md border border-line bg-surface">
          {tools.map((t, i) => (
            <li key={t.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-line px-4 py-3.5 last:border-0 md:grid-cols-[auto_1.2fr_1fr_auto_auto]">
              <span className="font-mono text-label-sm text-fg-muted">#{i + 1}</span>
              <div className="min-w-0">
                <p className="text-label-md text-fg">{t.name}</p>
                <p className="truncate text-body-sm text-fg-muted">{t.bestFor}</p>
              </div>
              <div className="hidden md:block">
                <p className="font-mono text-data-md text-fg">{t.pricing.value}</p>
                <EvidenceLabel kind={t.pricing.evidence} />
              </div>
              <span className="hidden font-mono text-label-md text-fg md:block">{t.fit}</span>
              <Button size="sm" onClick={() => nav('/app/configure')}>
                Configure
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-headline-md text-fg">Saved workflows</h2>
            <Button size="sm" variant="ghost" onClick={() => nav('/app/workflows')}>
              View
            </Button>
          </div>
          <ul className="flex flex-col">
            {SAMPLE_WORKFLOWS.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-0">
                <div className="min-w-0">
                  <p className="text-label-md text-fg">{w.name}</p>
                  <p className="truncate text-body-sm text-fg-muted">{w.outcome}</p>
                </div>
                <VerdictChip verdict={w.verdict} />
              </li>
            ))}
          </ul>
          <h2 className="mt-10 mb-3 text-headline-md text-fg">Generated configurations</h2>
          <ul className="flex flex-col">
            {[
              { name: 'Cursor · Builder preset', files: 4, at: '2h ago' },
              { name: 'Zapier · Weekly report', files: 1, at: '5 days ago' },
            ].map((c) => (
              <li key={c.name}>
                <button onClick={() => nav('/app/configure')} className="flex w-full items-center gap-3 border-b border-line py-3 text-left transition-colors duration-150 hover:text-fg">
                  <FileCode2 size={16} strokeWidth={1.5} className="text-fg-muted" />
                  <span className="flex-1 text-label-md text-fg">{c.name}</span>
                  <span className="text-label-sm text-fg-muted">
                    {c.files} files · {c.at}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="mb-3 text-headline-md text-fg">Recent activity</h2>
          <ol className="relative border-l border-line pl-5">
            {SAMPLE_ACTIVITY.map((a) => (
              <li key={a.id} className="relative pb-5 last:pb-0">
                <span className="absolute top-1.5 -left-[23.5px] h-2 w-2 rounded-full border border-line-strong bg-canvas" />
                <p className="text-body-sm text-fg-2">
                  <span className="text-fg">{a.actor}</span> {a.action} <span className="text-fg">{a.target}</span>
                </p>
                <p className="text-label-sm text-fg-muted">{a.at}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  )
}
