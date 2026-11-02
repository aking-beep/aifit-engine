'use client'

import React from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { DLink } from './Link'
import { TrackOnView } from './Marketing'

export interface AudienceContent {
  /** URL segment, e.g. "operations". */
  slug: string
  eyebrow: string
  title: string
  lede: string
  /** Problems this audience recognises, in their words. */
  pains: string[]
  /** What the product gives them. Facts about the product only: no invented figures. */
  outcomes: { title: string; body: string }[]
  steps: string[]
  faq: { q: string; a: string }[]
  primary: { href: string; label: string }
  metaTitle: string
  metaDescription: string
}

/**
 * One template for every paid-ad landing page, so each audience gets the same
 * structure: problem, outcome, how it works, questions, then two ways forward
 * (try the product, or talk to ARC). `children` carries the ARC CTA and lead form.
 */
export function AudienceLanding({ content, app, children }: { content: AudienceContent; app: 'ai-fit' | 'ai-fit-teams'; children?: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-14 px-4 py-12">
      <TrackOnView event="landing_viewed" props={{ app, audience: content.slug }} />
      <section className="max-w-3xl">
        <p className="text-label-md text-accent">{content.eyebrow}</p>
        <h1 className="mt-2 text-display-lg text-fg">{content.title}</h1>
        <p className="mt-4 text-body-lg text-fg-2">{content.lede}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <DLink href={content.primary.href} className="inline-flex h-10 items-center gap-1.5 rounded-sm bg-accent px-4 text-label-md text-on-accent">
            {content.primary.label} <ArrowRight size={14} aria-hidden />
          </DLink>
          <a href="#talk-to-arc" className="inline-flex h-10 items-center rounded-sm border border-line px-4 text-label-md text-fg hover:bg-sunken">
            Talk to ARC first
          </a>
        </div>
      </section>

      <section aria-labelledby={`pains-${content.slug}`}>
        <h2 id={`pains-${content.slug}`} className="text-headline-md text-fg">
          Sound familiar?
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {content.pains.map((p) => (
            <li key={p} className="rounded-md border border-line bg-surface p-4 text-body-md text-fg-2">
              {p}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby={`outcomes-${content.slug}`}>
        <h2 id={`outcomes-${content.slug}`} className="text-headline-md text-fg">
          What you get
        </h2>
        <ul className="mt-4 grid gap-4 md:grid-cols-3">
          {content.outcomes.map((o) => (
            <li key={o.title} className="rounded-md border border-line bg-surface p-5">
              <p className="flex items-center gap-2 text-title-md text-fg">
                <Check size={16} aria-hidden className="text-accent" />
                {o.title}
              </p>
              <p className="mt-2 text-body-sm text-fg-2">{o.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby={`steps-${content.slug}`}>
        <h2 id={`steps-${content.slug}`} className="text-headline-md text-fg">
          How it works
        </h2>
        <ol className="mt-4 space-y-3">
          {content.steps.map((s, i) => (
            <li key={s} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sunken font-mono text-label-sm text-fg-muted">{i + 1}</span>
              <span className="text-body-md text-fg-2">{s}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby={`faq-${content.slug}`}>
        <h2 id={`faq-${content.slug}`} className="text-headline-md text-fg">
          Questions
        </h2>
        <dl className="mt-4 divide-y divide-line rounded-md border border-line bg-surface">
          {content.faq.map((f) => (
            <div key={f.q} className="p-4">
              <dt className="text-label-md text-fg">{f.q}</dt>
              <dd className="mt-1 text-body-sm text-fg-2">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div id="talk-to-arc" className="scroll-mt-20 space-y-6">
        {children}
      </div>
    </div>
  )
}
