import { twMerge } from 'tailwind-merge'
import type { Basis, Evidence, MoneyRange, PlanConfig, Tone, Verdict } from './types'

export function cn(...parts: (string | false | null | undefined)[]) {
  return twMerge(parts.filter(Boolean).join(' '))
}

export function formatMoney(n: number, currency = 'USD', compact = false) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: n % 1 === 0 || compact ? 0 : 2,
    notation: compact && n >= 10000 ? 'compact' : 'standard',
  }).format(n)
}

export function formatRange(r: MoneyRange, compact = true) {
  const per = r.per === 'month' ? '/mo' : r.per === 'year' ? '/yr' : r.per === 'run' ? '/run' : ''
  if (r.low === r.high) return `${formatMoney(r.low, r.currency, compact)}${per}`
  return `${formatMoney(r.low, r.currency, compact)}–${formatMoney(r.high, r.currency, compact)}${per}`
}

export function formatPlanPrice(plan: PlanConfig) {
  if (!plan.price) return { amount: 'Custom', suffix: '' }
  const amount = formatMoney(plan.price.amount, plan.price.currency)
  const suffix = plan.price.interval === 'month' ? '/month' : plan.price.interval === 'year' ? '/year' : 'one-time'
  return { amount, suffix }
}

/** Colour follows provenance, not optimism. */
export function toneFor(basis: Basis | Evidence, wouldBe: Tone): Tone {
  const earns = basis === 'measured' || basis === 'calibrated' || basis === 'verified'
  return earns ? wouldBe : 'neutral'
}

export const VERDICT_META: Record<Verdict, { label: string; short: string; sentence: string }> = {
  'no-ai': { label: 'Don’t use AI', short: 'No AI', sentence: 'A simpler approach is more reliable and cheaper here.' },
  software: { label: 'Conventional software', short: 'Software', sentence: 'An existing non-AI product already solves this well.' },
  automation: { label: 'Rules-based automation', short: 'Automation', sentence: 'Deterministic automation covers this without model risk.' },
  buy: { label: 'Buy an AI tool', short: 'Buy', sentence: 'A commercial AI product fits with minimal configuration.' },
  build: { label: 'Build a custom solution', short: 'Build', sentence: 'Your requirements justify a custom AI implementation.' },
}

export const EVIDENCE_META: Record<Evidence, { label: string; help: string }> = {
  verified: { label: 'Verified', help: 'Checked against a dated source or measured in your environment.' },
  estimated: { label: 'Estimated', help: 'Modelled from benchmarks or comparable deployments. Expect variance.' },
  assumption: { label: 'Assumption', help: 'An input we assumed. Change it if it doesn’t match your situation.' },
  recommendation: { label: 'Recommendation', help: 'Our judgement based on the factors shown.' },
  untested: { label: 'Not tested', help: 'No evidence yet. Treat as unknown until validated.' },
}

/** The decision engine's five outcomes, in the design's verdict vocabulary. */
export const VERDICT_FROM_OUTCOME = {
  no_change: 'no-ai',
  conventional_software: 'software',
  conventional_automation: 'automation',
  buy_ai: 'buy',
  build_ai: 'build',
} as const satisfies Record<string, Verdict>

export type EngineOutcome = keyof typeof VERDICT_FROM_OUTCOME

export function verdictFromOutcome(o: EngineOutcome): Verdict {
  return VERDICT_FROM_OUTCOME[o]
}

/** Engine basis tags in the design's evidence vocabulary. Only measured or calibrated figures count as verified. */
export function evidenceFromBasis(b: Basis): Evidence {
  return b === 'measured' || b === 'calibrated' ? 'verified' : 'estimated'
}
