/**
 * Shared TypeScript interfaces for AI Fit Consumer and AI Fit Teams.
 * These describe UI-facing shapes only. They do not imply any backend endpoint.
 */

export type Theme = 'light' | 'dark'

/** The five shared stages of every AI Fit journey. */
export type StageId = 'understand' | 'decide' | 'configure' | 'validate' | 'improve'

export interface Stage {
  id: StageId
  label: string
  summary: string
}

/** Provenance of a figure or claim. Every number shown carries one. */
export type Evidence = 'verified' | 'estimated' | 'assumption' | 'recommendation' | 'untested'

/** Outcome of the Decide stage. */
export type Verdict = 'no-ai' | 'software' | 'automation' | 'buy' | 'build'

/** Outcome colour is only allowed on measured or calibrated figures. */
export type Basis = 'heuristic' | 'benchmark' | 'calibrated' | 'measured'
export type Tone = 'neutral' | 'good' | 'warn' | 'danger'

export interface Sourced<T> {
  value: T
  evidence: Evidence
  asOf?: string
  note?: string
}

export interface MoneyRange {
  low: number
  high: number
  currency: string
  per?: 'month' | 'year' | 'one-time' | 'run'
}

export type Difficulty = 'easy' | 'moderate' | 'advanced'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

/** A decision factor — the "why" behind a recommendation. */
export interface Reason {
  label: string
  detail: string
  weight: number // 0..1 contribution to the decision
  direction: 'for' | 'against'
  evidence: Evidence
}

/** Consumer recommendation card. */
export interface ToolRecommendation {
  id: string
  name: string
  vendor: string
  category: string
  bestFor: string
  whyItFits: string
  reasons: Reason[]
  pricing: Sourced<string>
  difficulty: Difficulty
  setupMinutes: number
  privacy: { summary: string; trainsOnData: Sourced<boolean | null>; dataRegion?: string }
  alternatives: string[]
  fit: number // 0..100
  saved?: boolean
}

export interface WorkflowStep {
  title: string
  tool: string
  detail: string
}

export interface Workflow {
  id: string
  name: string
  outcome: string
  verdict: Verdict
  steps: WorkflowStep[]
  timeSaved: Sourced<string>
}

export interface GeneratedFile {
  path: string
  language: 'json' | 'yaml' | 'markdown' | 'bash' | 'typescript' | 'text'
  content: string
}

export interface SetupPackage {
  id: string
  name: string
  createdAt: string
  files: GeneratedFile[]
}

export interface ActivityItem {
  id: string
  actor: string
  action: string
  target: string
  at: string
}

export interface AssessmentRecord {
  id: string
  title: string
  date: string
  verdict: Verdict
  score: number
  status: 'complete' | 'draft' | 'stale'
  version: number
}

/* ---------- Teams ---------- */

export interface Workload {
  id: string
  name: string
  department: string
  owner: string
  volumePerMonth: number
  verdict: Verdict
  suitability: number
  readiness: number // 0..100
  risk: RiskLevel
  investment: MoneyRange
  stage: StageId
  evalStatus: 'not-started' | 'planned' | 'running' | 'passed' | 'failed'
}

export interface RiskItem {
  id: string
  title: string
  category: 'security' | 'governance' | 'operational' | 'financial' | 'vendor' | 'quality'
  likelihood: 1 | 2 | 3 | 4 | 5
  impact: 1 | 2 | 3 | 4 | 5
  owner: string
  mitigation: string
  status: 'open' | 'mitigating' | 'accepted' | 'closed'
  evidence: Evidence
}

export interface CostLine {
  id: string
  label: string
  category: string
  monthly: MoneyRange
  evidence: Evidence
  driver: string
}

export interface ModelOption {
  id: string
  name: string
  provider: string
  contextK: number
  costPer1kRuns: Sourced<number>
  latencyP50Ms: Sourced<number>
  quality: Sourced<number | null>
  residency: string
  recommended?: boolean
}

export interface EvalCheck {
  id: string
  name: string
  metric: string
  threshold: string
  result?: string
  status: 'pass' | 'fail' | 'pending' | 'untested'
  evidence: Evidence
}

export interface ArchNode {
  id: string
  label: string
  kind: 'source' | 'gateway' | 'model' | 'store' | 'tool' | 'human' | 'output' | 'guard'
  layer: number
  zone: 'public' | 'internal' | 'restricted'
  detail: string
  monthly?: MoneyRange
  evidence: Evidence
}

export interface ArchEdge {
  from: string
  to: string
  label?: string
  pii?: boolean
}

export interface RoadmapPhase {
  id: string
  name: string
  weeks: [number, number]
  stage: StageId
  deliverables: string[]
  owner: string
}

export interface Member {
  id: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'analyst' | 'viewer'
  lastActive: string
  status: 'active' | 'invited'
}

/* ---------- Commercial ---------- */

export type PlanInterval = 'month' | 'year' | 'one-time'

export interface PlanConfig {
  id: string
  product: 'consumer' | 'teams'
  name: string
  tagline: string
  price: { amount: number; currency: string; interval: PlanInterval } | null
  features: string[]
  limits?: string
  cta: string
  highlighted?: boolean
}

export type BillingStatus = 'active' | 'trialing' | 'past-due' | 'canceled' | 'free'

export interface Subscription {
  planId: string
  status: BillingStatus
  renewsOn?: string
  paymentMethod?: string
  invoices: { id: string; date: string; amount: number; currency: string; status: 'paid' | 'open' | 'failed' }[]
}
