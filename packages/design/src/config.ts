import type { PlanConfig, Stage } from './types'

/**
 * Commercial configuration.
 * Prices and features are data, not component logic. Swap this object for a
 * value loaded from your billing provider or CMS; every pricing surface reads
 * from here and only formats what it receives.
 */
export const PLANS: PlanConfig[] = [
  {
    id: 'consumer-free',
    product: 'consumer',
    name: 'Free',
    tagline: 'Find your fit and set up one tool.',
    price: { amount: 0, currency: 'USD', interval: 'month' },
    features: ['Five-minute assessment', '3 tool recommendations', '1 configuration package', 'Assessment history (30 days)'],
    cta: 'Start free',
  },
  {
    id: 'consumer-pro',
    product: 'consumer',
    name: 'Pro',
    tagline: 'Every recommendation, every config, kept current.',
    price: { amount: 12, currency: 'USD', interval: 'month' },
    features: ['Unlimited recommendations and comparisons', 'Unlimited configuration packages', 'Workflow builder', 'Re-assess when tools change', 'Full history and exports'],
    cta: 'Upgrade to Pro',
    highlighted: true,
  },
  {
    id: 'teams-assessment',
    product: 'teams',
    name: 'Assessment',
    tagline: 'A defensible verdict for one workload.',
    price: { amount: 149, currency: 'USD', interval: 'one-time' },
    features: ['Cost model and ROI for one workload', 'Risk register you can edit', 'Security and governance requirements', 'Printable report'],
    cta: 'Buy assessment',
  },
  {
    id: 'teams-blueprint',
    product: 'teams',
    name: 'Blueprint',
    tagline: 'From verdict to an implementation-ready plan.',
    price: { amount: 399, currency: 'USD', interval: 'one-time' },
    features: ['Everything in Assessment', 'Architecture, models and infrastructure', 'Evaluation plan and roadmap', 'Technical blueprint (Markdown, JSON)'],
    cta: 'Buy blueprint',
    highlighted: true,
  },
  {
    id: 'teams-workspace',
    product: 'teams',
    name: 'Workspace',
    tagline: 'Your whole AI portfolio, continuously assessed.',
    price: { amount: 199, currency: 'USD', interval: 'month' },
    features: ['Blueprint level for every workload', 'Unlimited workloads and versions', 'Team roles and audit log', 'Governance export for ARC Control'],
    limits: 'Up to 25 members',
    cta: 'Start workspace',
  },
]

export const plansFor = (product: PlanConfig['product']) => PLANS.filter((p) => p.product === product)
export const planById = (id: string) => PLANS.find((p) => p.id === id)

export const STAGES: Stage[] = [
  { id: 'understand', label: 'Understand', summary: 'Objective, requirements, constraints' },
  { id: 'decide', label: 'Decide', summary: 'AI, software, automation, or custom' },
  { id: 'configure', label: 'Configure', summary: 'Setup and implementation artifacts' },
  { id: 'validate', label: 'Validate', summary: 'Evaluation plan and checks' },
  { id: 'improve', label: 'Improve', summary: 'Adoption, outcomes, next steps' },
]

/** Every screen in the integrated apps shows live engine output. Sample data is not shipped. */
export const DATA_MODE: 'sample' | 'live' = 'live'
