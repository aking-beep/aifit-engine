// GENERATED from packages/design by scripts/sync-design.mjs. Do not edit here.
/**
 * Marketing plumbing shared by AI Fit and AI Fit Teams: links to ARC
 * Transformation Group, campaign attribution (UTM), conversion events and
 * ad-pixel consent. Pure functions plus a small browser store; nothing here
 * sends data anywhere by itself. Each app registers its own tracker.
 */

export const ARC = {
  site: 'https://arc-website-pi-five.vercel.app',
  /** Where "Book an assessment" goes: a 30-minute call with ARC. */
  booking: 'https://calendly.com/aking-arctransformationgroup/30min',
  aiFitPage: 'https://arc-website-pi-five.vercel.app/ai-fit',
  contact: 'https://arc-website-pi-five.vercel.app/contact',
} as const

export type ArcLinks = { site: string; booking: string; aiFitPage: string; contact: string }

/** Env overrides (NEXT_PUBLIC_ARC_SITE_URL, NEXT_PUBLIC_ARC_BOOKING_URL), falling back to the defaults above. */
export function arcLinks(env: { site?: string | undefined; booking?: string | undefined } = {}): ArcLinks {
  const site = (env.site || ARC.site).replace(/\/+$/, '')
  return { site, booking: env.booking || ARC.booking, aiFitPage: `${site}/ai-fit`, contact: `${site}/contact` }
}

export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const
export const CLICK_ID_KEYS = ['gclid', 'fbclid', 'li_fat_id', 'msclkid'] as const
export type UtmKey = (typeof UTM_KEYS)[number]
export type ClickIdKey = (typeof CLICK_ID_KEYS)[number]

export interface Attribution {
  utm: Partial<Record<UtmKey, string>>
  clickIds: Partial<Record<ClickIdKey, string>>
  landingPath: string
  referrerHost: string | null
  firstSeenAt: string
}

const clean = (v: string | null) => (v ? v.trim().slice(0, 120).replace(/[^\w.\-~ +:/@]/g, '') : '')

/** Reads campaign parameters from a URL. Values are trimmed and stripped of unusual characters. */
export function parseAttribution(url: string, referrer: string | null, now = new Date()): Attribution | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  const utm: Attribution['utm'] = {}
  const clickIds: Attribution['clickIds'] = {}
  for (const k of UTM_KEYS) {
    const v = clean(u.searchParams.get(k))
    if (v) utm[k] = v
  }
  for (const k of CLICK_ID_KEYS) {
    const v = clean(u.searchParams.get(k))
    if (v) clickIds[k] = v
  }
  let referrerHost: string | null = null
  if (referrer) {
    try {
      const r = new URL(referrer)
      referrerHost = r.host === u.host ? null : r.host
    } catch {
      referrerHost = null
    }
  }
  if (!Object.keys(utm).length && !Object.keys(clickIds).length && !referrerHost) return null
  return { utm, clickIds, landingPath: u.pathname.slice(0, 200), referrerHost, firstSeenAt: now.toISOString() }
}

/** Adds UTM parameters to an outbound link (e.g. the ARC booking page) so ARC can see where the lead came from. */
export function withUtm(href: string, params: Partial<Record<UtmKey, string>>): string {
  try {
    const u = new URL(href)
    for (const [k, v] of Object.entries(params)) if (v && !u.searchParams.has(k)) u.searchParams.set(k, v)
    return u.toString()
  } catch {
    return href
  }
}

/** The outbound UTM for a link from one of our apps to ARC: our app is the source, the original campaign rides along. */
export function arcUtm(app: 'ai-fit' | 'ai-fit-teams', placement: string, attribution: Attribution | null): Partial<Record<UtmKey, string>> {
  return {
    utm_source: app,
    utm_medium: 'product',
    utm_campaign: attribution?.utm.utm_campaign || 'organic',
    utm_content: placement.slice(0, 60),
  }
}

// Browser store ---------------------------------------------------------------

const ATTR_KEY = 'aifit-attribution'
const CONSENT_KEY = 'aifit-consent'

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/** First touch wins: a later visit without campaign parameters does not overwrite the campaign that brought the person. */
export function captureAttribution(): Attribution | null {
  if (typeof window === 'undefined') return null
  const existing = readAttribution()
  const found = parseAttribution(window.location.href, document.referrer || null)
  if (existing) return existing
  if (found) {
    try {
      storage()?.setItem(ATTR_KEY, JSON.stringify(found))
    } catch {
      /* storage blocked: attribution lasts for this page only */
    }
  }
  return found
}

export function readAttribution(): Attribution | null {
  try {
    const raw = storage()?.getItem(ATTR_KEY)
    return raw ? (JSON.parse(raw) as Attribution) : null
  } catch {
    return null
  }
}

export type Consent = 'granted' | 'denied' | null

export function readConsent(): Consent {
  const v = storage()?.getItem(CONSENT_KEY)
  return v === 'granted' || v === 'denied' ? v : null
}

export function writeConsent(c: Exclude<Consent, null>) {
  try {
    storage()?.setItem(CONSENT_KEY, c)
  } catch {
    /* ignore */
  }
  for (const l of consentListeners) l(c)
}

const consentListeners = new Set<(c: Consent) => void>()
export function onConsentChange(fn: (c: Consent) => void) {
  consentListeners.add(fn)
  return () => {
    consentListeners.delete(fn)
  }
}

// Conversion events -----------------------------------------------------------

/** Every conversion event either app sends. Fixed names keep reports comparable across the two products. */
export type ConversionEvent =
  | 'assessment_started'
  | 'assessment_completed'
  | 'report_viewed'
  | 'signup_completed'
  | 'lead_submitted'
  | 'booking_clicked'
  | 'arc_site_clicked'
  | 'checkout_started'
  | 'landing_viewed'

export type EventProps = Record<string, string | number | boolean | null>
type Tracker = (event: ConversionEvent, props: EventProps) => void

const trackers = new Set<Tracker>()

/** Apps register sinks (Vercel Analytics, consented ad pixels). Returns an unregister function. */
export function registerTracker(t: Tracker) {
  trackers.add(t)
  return () => {
    trackers.delete(t)
  }
}

/** Never throws: analytics must not break a page. Props never carry personal data; callers pass labels only. */
export function trackConversion(event: ConversionEvent, props: EventProps = {}) {
  const a = captureAttribution()
  const merged: EventProps = { ...props }
  if (a?.utm.utm_source) merged.utm_source = a.utm.utm_source
  if (a?.utm.utm_campaign) merged.utm_campaign = a.utm.utm_campaign
  for (const t of trackers) {
    try {
      t(event, merged)
    } catch {
      /* a broken sink is ignored */
    }
  }
}

// Leads ----------------------------------------------------------------------

export const LEAD_INTERESTS = [
  { value: 'assessment', label: 'An assessment of one AI idea' },
  { value: 'blueprint', label: 'An implementation blueprint' },
  { value: 'workspace', label: 'A workspace for my team' },
  { value: 'advisory', label: 'Hands-on help from ARC' },
  { value: 'personal', label: 'Setting up AI for myself' },
  { value: 'other', label: 'Something else' },
] as const
export type LeadInterest = (typeof LEAD_INTERESTS)[number]['value']

/** What the lead form sends. Both apps validate the same shape on the server. */
export interface LeadInput {
  email: string
  name?: string
  company?: string
  role?: string
  interest: LeadInterest
  message?: string
  consent: true
  /** Honeypot: real people leave it empty. */
  website?: string
  source: { app: 'ai-fit' | 'ai-fit-teams'; page: string; attribution: Attribution | null }
}
