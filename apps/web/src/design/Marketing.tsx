'use client'
// GENERATED from packages/design by scripts/sync-design.mjs. Do not edit here.

import React, { useEffect, useState } from 'react'
import { ArrowUpRight, CalendarClock, Check } from 'lucide-react'
import { Button } from './Button'
import { Select, TextArea, TextInput } from './Forms'
import { cn } from './lib'
import {
  LEAD_INTERESTS,
  arcUtm,
  captureAttribution,
  onConsentChange,
  readConsent,
  registerTracker,
  trackConversion,
  withUtm,
  writeConsent,
  type ArcLinks,
  type Consent,
  type ConversionEvent,
  type LeadInput,
  type LeadInterest,
} from './marketing'

type App = 'ai-fit' | 'ai-fit-teams'

/** Records the campaign that brought this visitor (first touch). Render once near the root. */
export function AttributionCapture() {
  useEffect(() => {
    captureAttribution()
  }, [])
  return null
}

/** The two ways to reach ARC: book a call, or read about the practice. Both carry attribution. */
export function ArcCta({
  links,
  app,
  placement,
  title = 'Want ARC to do this with you?',
  body = 'ARC Transformation Group runs the assessment with your team, checks the figures against your systems, and turns the blueprint into a delivery plan.',
  className,
}: {
  links: ArcLinks
  app: App
  placement: string
  title?: string
  body?: string
  className?: string
}) {
  const [hrefs, setHrefs] = useState({ booking: links.booking, site: links.aiFitPage })
  useEffect(() => {
    // captureAttribution, not read: this effect can run before AttributionCapture's on the first page view.
    const utm = arcUtm(app, placement, captureAttribution())
    setHrefs({ booking: withUtm(links.booking, utm), site: withUtm(links.aiFitPage, utm) })
  }, [app, placement, links.booking, links.aiFitPage])
  return (
    <section className={cn('rounded-md border border-line bg-surface p-5', className)} aria-labelledby={`arc-cta-${placement}`}>
      <h2 id={`arc-cta-${placement}`} className="text-title-md text-fg">
        {title}
      </h2>
      <p className="mt-1 max-w-2xl text-body-sm text-fg-2">{body}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={hrefs.booking}
          target="_blank"
          rel="noopener"
          onClick={() => trackConversion('booking_clicked', { app, placement })}
          className="inline-flex h-9 items-center gap-1.5 rounded-sm bg-accent px-3.5 text-label-md text-on-accent"
        >
          <CalendarClock size={14} aria-hidden /> Book an assessment call
        </a>
        <a
          href={hrefs.site}
          target="_blank"
          rel="noopener"
          onClick={() => trackConversion('arc_site_clicked', { app, placement })}
          className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-line px-3.5 text-label-md text-fg hover:bg-sunken"
        >
          About ARC Transformation Group <ArrowUpRight size={13} aria-hidden />
        </a>
      </div>
      <p className="mt-2 text-label-sm text-fg-muted">Opens ARC&apos;s booking page in a new tab. A 30-minute call; no obligation.</p>
    </section>
  )
}

type LeadState = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent' } | { kind: 'error'; message: string }

/**
 * Lead capture. Posts to the app's own endpoint, which validates, stores and
 * forwards it. The form asks only for what a follow-up needs.
 */
export function LeadForm({
  endpoint,
  app,
  page,
  headers = {},
  defaultInterest = 'assessment',
  title = 'Get a follow-up from ARC',
  description = 'Tell us what you are trying to decide. Someone from ARC Transformation Group replies by email, usually within one business day.',
  privacyHref = '/privacy',
}: {
  endpoint: string
  app: App
  page: string
  headers?: Record<string, string>
  defaultInterest?: LeadInterest
  title?: string
  description?: string
  privacyHref?: string
}) {
  const [state, setState] = useState<LeadState>({ kind: 'idle' })
  const [form, setForm] = useState({ email: '', name: '', company: '', role: '', interest: defaultInterest as LeadInterest, message: '', website: '' })
  const [consent, setConsent] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!consent) {
      setState({ kind: 'error', message: 'Tick the box so we may contact you about this request.' })
      return
    }
    setState({ kind: 'sending' })
    const body: LeadInput = {
      email: form.email,
      interest: form.interest,
      consent: true,
      source: { app, page, attribution: captureAttribution() },
      ...(form.name ? { name: form.name } : {}),
      ...(form.company ? { company: form.company } : {}),
      ...(form.role ? { role: form.role } : {}),
      ...(form.message ? { message: form.message } : {}),
      ...(form.website ? { website: form.website } : {}),
    }
    try {
      const res = await fetch(endpoint, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; detail?: { message?: string } | string }
        const message = data.error ?? (typeof data.detail === 'string' ? data.detail : data.detail?.message) ?? 'We could not send that. Try again, or book a call instead.'
        setState({ kind: 'error', message })
        return
      }
      trackConversion('lead_submitted', { app, page, interest: form.interest })
      setState({ kind: 'sent' })
    } catch {
      setState({ kind: 'error', message: 'We could not reach the server. Try again, or book a call instead.' })
    }
  }

  if (state.kind === 'sent') {
    return (
      <section className="rounded-md border border-line bg-surface p-5" role="status">
        <p className="flex items-center gap-2 text-title-md text-fg">
          <Check size={16} aria-hidden className="text-good" /> Thanks, we have it.
        </p>
        <p className="mt-1 text-body-sm text-fg-2">ARC will reply to {form.email}. Nothing else is sent to that address.</p>
      </section>
    )
  }

  return (
    <section className="rounded-md border border-line bg-surface p-5" aria-labelledby={`lead-${page}`}>
      <h2 id={`lead-${page}`} className="text-title-md text-fg">
        {title}
      </h2>
      <p className="mt-1 max-w-2xl text-body-sm text-fg-2">{description}</p>
      <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2" noValidate>
        <TextInput label="Work email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} maxLength={254} />
        <TextInput label="Name (optional)" autoComplete="name" value={form.name} onChange={set('name')} maxLength={100} />
        <TextInput label="Company (optional)" autoComplete="organization" value={form.company} onChange={set('company')} maxLength={120} />
        <TextInput label="Role (optional)" autoComplete="organization-title" value={form.role} onChange={set('role')} maxLength={100} />
        <div className="sm:col-span-2">
          <Select label="What would help most?" value={form.interest} onChange={set('interest')} options={LEAD_INTERESTS.map((i) => ({ value: i.value, label: i.label }))} />
        </div>
        <div className="sm:col-span-2">
          <TextArea label="What are you trying to decide? (optional)" rows={3} value={form.message} onChange={set('message')} maxLength={1000} hint="No passwords, customer data or confidential details, please." />
        </div>
        {/* Honeypot: hidden from people and assistive tech; bots fill it. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Website
            <input tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
          </label>
        </div>
        <label className="flex items-start gap-2 text-body-sm text-fg-2 sm:col-span-2">
          <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            ARC Transformation Group may email me about this request. See the <a className="underline underline-offset-2" href={privacyHref}>privacy notice</a>.
          </span>
        </label>
        {state.kind === 'error' ? (
          <p role="alert" className="text-body-sm text-danger sm:col-span-2">
            {state.message}
          </p>
        ) : null}
        <div className="sm:col-span-2">
          <Button type="submit" variant="primary" loading={state.kind === 'sending'} disabled={!form.email || state.kind === 'sending'}>
            Send
          </Button>
        </div>
      </form>
    </section>
  )
}

/**
 * Consent for advertising pixels. Shown only when at least one pixel is
 * configured; until someone accepts, no pixel script loads. Vercel Web
 * Analytics is cookieless and does not need this.
 */
export function ConsentBanner({ needed, privacyHref = '/privacy' }: { needed: boolean; privacyHref?: string }) {
  const [consent, setConsent] = useState<Consent | 'unknown'>('unknown')
  useEffect(() => {
    setConsent(readConsent())
    return onConsentChange(setConsent)
  }, [])
  if (!needed || consent !== null) return null
  return (
    <div role="region" aria-label="Cookie consent" className="fixed inset-x-0 bottom-0 z-[60] border-t border-line bg-raised p-4 shadow-pop">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-body-sm text-fg-2">
          We would like to use advertising cookies to measure which ads bring people here. Nothing loads unless you agree.{' '}
          <a className="underline underline-offset-2" href={privacyHref}>
            Privacy notice
          </a>
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => writeConsent('denied')}>
            Decline
          </Button>
          <Button size="sm" variant="primary" onClick={() => writeConsent('granted')}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  )
}

export interface PixelIds {
  meta?: string | undefined
  gtag?: string | undefined
  linkedin?: string | undefined
}

/** Which configured IDs are well-formed. A malformed ID is ignored rather than injected into a script tag. */
export function validPixels(ids: PixelIds): PixelIds {
  return {
    meta: ids.meta && /^\d{6,20}$/.test(ids.meta) ? ids.meta : undefined,
    gtag: ids.gtag && /^(G|AW)-[A-Z0-9]{4,20}$/.test(ids.gtag) ? ids.gtag : undefined,
    linkedin: ids.linkedin && /^\d{4,12}$/.test(ids.linkedin) ? ids.linkedin : undefined,
  }
}

export const anyPixel = (ids: PixelIds) => Boolean(ids.meta || ids.gtag || ids.linkedin)

function addScript(src: string) {
  const s = document.createElement('script')
  s.async = true
  s.src = src
  document.head.appendChild(s)
}

type W = Window & { fbq?: (...a: unknown[]) => void; _fbq?: unknown; dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void; _linkedin_partner_id?: string; _linkedin_data_partner_ids?: string[] }

/**
 * Loads advertising pixels after consent, then mirrors conversion events into
 * them. Before consent, or with no IDs configured, it does nothing at all.
 */
export function AdPixels({ ids }: { ids: PixelIds }) {
  const v = validPixels(ids)
  useEffect(() => {
    if (!anyPixel(v)) return
    let loaded = false
    let unregister: (() => void) | null = null
    const load = () => {
      if (loaded || readConsent() !== 'granted') return
      loaded = true
      const w = window as W
      if (v.meta) {
        const fbq = function (...args: unknown[]) {
          ;(fbq as unknown as { q: unknown[] }).q.push(args)
        } as unknown as W['fbq'] & { q: unknown[] }
        ;(fbq as unknown as { q: unknown[] }).q = []
        w.fbq = w.fbq ?? fbq
        w._fbq = w.fbq
        addScript('https://connect.facebook.net/en_US/fbevents.js')
        w.fbq!('init', v.meta)
        w.fbq!('track', 'PageView')
      }
      if (v.gtag) {
        w.dataLayer = w.dataLayer ?? []
        w.gtag = function (...args: unknown[]) {
          w.dataLayer!.push(args)
        }
        addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(v.gtag)}`)
        w.gtag('js', new Date())
        w.gtag('config', v.gtag)
      }
      if (v.linkedin) {
        w._linkedin_partner_id = v.linkedin
        w._linkedin_data_partner_ids = [...(w._linkedin_data_partner_ids ?? []), v.linkedin]
        addScript('https://snap.licdn.com/li.lms-analytics/insight.min.js')
      }
      unregister = registerTracker((event, props) => {
        const fb: Partial<Record<ConversionEvent, string>> = { lead_submitted: 'Lead', checkout_started: 'InitiateCheckout', booking_clicked: 'Schedule', signup_completed: 'CompleteRegistration' }
        const g: Partial<Record<ConversionEvent, string>> = { lead_submitted: 'generate_lead', checkout_started: 'begin_checkout', signup_completed: 'sign_up' }
        if (w.fbq && fb[event]) w.fbq('track', fb[event])
        if (w.gtag) w.gtag('event', g[event] ?? event, props)
      })
    }
    load()
    const off = onConsentChange((c) => c === 'granted' && load())
    return () => {
      off()
      unregister?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.meta, v.gtag, v.linkedin])
  return null
}

/** Sends one conversion event when the page renders (e.g. a report was viewed). */
export function TrackOnView({ event, props = {} }: { event: ConversionEvent; props?: Record<string, string | number | boolean | null> }) {
  const key = JSON.stringify(props)
  useEffect(() => {
    trackConversion(event, JSON.parse(key) as Record<string, string | number | boolean | null>)
  }, [event, key])
  return null
}
