/**
 * SAMPLE DATA — mock organisation for the Teams prototype. Not from a live integration.
 * Costs are illustrative ranges; model prices carry an as-of date and must be
 * re-verified against provider pricing before use.
 */
import type { ActivityItem, ArchEdge, ArchNode, AssessmentRecord, CostLine, EvalCheck, GeneratedFile, Member, ModelOption, Reason, RiskItem, RoadmapPhase, Workload } from '../types'

export const SAMPLE_ORG = {
  name: 'Northwind Logistics',
  industry: 'Logistics & freight',
  size: '1,200 employees',
  region: 'US + EU',
  dataClasses: ['Customer PII', 'Shipment records', 'Contracts'],
}

export const SAMPLE_WORKLOADS: Workload[] = [
  { id: 'w1', name: 'Customer support triage', department: 'Support', owner: 'Priya Natarajan', volumePerMonth: 12400, verdict: 'buy', suitability: 84, readiness: 72, risk: 'medium', investment: { low: 3200, high: 5400, currency: 'USD', per: 'month' }, stage: 'validate', evalStatus: 'running' },
  { id: 'w2', name: 'Invoice data extraction', department: 'Finance', owner: 'Tom Alvarez', volumePerMonth: 38000, verdict: 'build', suitability: 78, readiness: 54, risk: 'high', investment: { low: 6800, high: 11200, currency: 'USD', per: 'month' }, stage: 'configure', evalStatus: 'planned' },
  { id: 'w3', name: 'Shipment status emails', department: 'Operations', owner: 'Lena Fischer', volumePerMonth: 52000, verdict: 'automation', suitability: 31, readiness: 90, risk: 'low', investment: { low: 400, high: 900, currency: 'USD', per: 'month' }, stage: 'improve', evalStatus: 'passed' },
  { id: 'w4', name: 'Contract clause review', department: 'Legal', owner: 'David Okafor', volumePerMonth: 340, verdict: 'buy', suitability: 66, readiness: 38, risk: 'high', investment: { low: 1800, high: 3000, currency: 'USD', per: 'month' }, stage: 'decide', evalStatus: 'not-started' },
  { id: 'w5', name: 'Payroll reconciliation', department: 'HR', owner: 'Sara Lindqvist', volumePerMonth: 2, verdict: 'no-ai', suitability: 12, readiness: 95, risk: 'low', investment: { low: 0, high: 0, currency: 'USD', per: 'month' }, stage: 'decide', evalStatus: 'not-started' },
  { id: 'w6', name: 'Route exception summaries', department: 'Operations', owner: 'Lena Fischer', volumePerMonth: 4100, verdict: 'software', suitability: 44, readiness: 61, risk: 'medium', investment: { low: 900, high: 1500, currency: 'USD', per: 'month' }, stage: 'understand', evalStatus: 'not-started' },
]

export const SUITABILITY_REASONS: Reason[] = [
  { label: 'High repetitive volume', detail: '12,400 tickets/month, ~62% fall into 14 intents.', weight: 0.24, direction: 'for', evidence: 'verified' },
  { label: 'Tolerant of occasional error', detail: 'Misroutes are caught by agents within one hop.', weight: 0.18, direction: 'for', evidence: 'assumption' },
  { label: 'Labelled history exists', detail: '18 months of tagged tickets available for evaluation.', weight: 0.16, direction: 'for', evidence: 'verified' },
  { label: 'Mature vendor market', detail: 'At least four products cover triage for Zendesk.', weight: 0.14, direction: 'for', evidence: 'estimated' },
  { label: 'Customer PII in tickets', detail: 'Requires redaction and a DPA with any vendor.', weight: 0.16, direction: 'against', evidence: 'verified' },
  { label: 'EU residency needed', detail: 'Narrows vendor and model options.', weight: 0.12, direction: 'against', evidence: 'verified' },
]

export const BUILD_VS_BUY = {
  criteria: ['Time to value', 'Year-1 cost', 'Control over data', 'Customisation', 'Maintenance burden', 'Vendor lock-in'],
  options: [
    { id: 'buy', name: 'Buy · Zendesk AI agents', scores: [5, 4, 2, 2, 5, 2], cost: { low: 38000, high: 62000, currency: 'USD', per: 'year' as const }, weeks: '3–5', evidence: 'estimated' as const },
    { id: 'build', name: 'Build · custom classifier + LLM', scores: [2, 2, 5, 5, 2, 5], cost: { low: 95000, high: 150000, currency: 'USD', per: 'year' as const }, weeks: '12–16', evidence: 'estimated' as const },
    { id: 'hybrid', name: 'Hybrid · vendor + own guardrails', scores: [4, 3, 4, 3, 3, 3], cost: { low: 54000, high: 80000, currency: 'USD', per: 'year' as const }, weeks: '6–8', evidence: 'estimated' as const },
  ],
}

export const ARCH_NODES: ArchNode[] = [
  { id: 'zd', label: 'Zendesk', kind: 'source', layer: 0, zone: 'public', detail: 'Inbound tickets via webhook.', evidence: 'verified' },
  { id: 'email', label: 'Support inbox', kind: 'source', layer: 0, zone: 'public', detail: 'Forwarded email channel.', evidence: 'verified' },
  { id: 'gw', label: 'API gateway', kind: 'gateway', layer: 1, zone: 'internal', detail: 'Auth, rate limits, request logging.', monthly: { low: 120, high: 200, currency: 'USD', per: 'month' }, evidence: 'estimated' },
  { id: 'redact', label: 'PII redaction', kind: 'guard', layer: 1, zone: 'internal', detail: 'Removes names, emails, addresses before model calls.', monthly: { low: 300, high: 500, currency: 'USD', per: 'month' }, evidence: 'estimated' },
  { id: 'router', label: 'Intent classifier', kind: 'model', layer: 2, zone: 'internal', detail: 'Small model, routes 14 intents.', monthly: { low: 180, high: 340, currency: 'USD', per: 'month' }, evidence: 'estimated' },
  { id: 'llm', label: 'Response drafter', kind: 'model', layer: 2, zone: 'internal', detail: 'Mid-tier LLM, EU region.', monthly: { low: 1400, high: 2600, currency: 'USD', per: 'month' }, evidence: 'estimated' },
  { id: 'kb', label: 'Knowledge base', kind: 'store', layer: 3, zone: 'restricted', detail: 'Vector index of help center + macros.', monthly: { low: 220, high: 380, currency: 'USD', per: 'month' }, evidence: 'estimated' },
  { id: 'crm', label: 'Order system', kind: 'tool', layer: 3, zone: 'restricted', detail: 'Read-only shipment lookup.', evidence: 'assumption' },
  { id: 'human', label: 'Agent review', kind: 'human', layer: 4, zone: 'internal', detail: 'Agents approve drafts under 0.8 confidence.', evidence: 'recommendation' },
  { id: 'out', label: 'Reply + tag', kind: 'output', layer: 4, zone: 'internal', detail: 'Writes back to Zendesk.', evidence: 'recommendation' },
]

export const ARCH_EDGES: ArchEdge[] = [
  { from: 'zd', to: 'gw', pii: true },
  { from: 'email', to: 'gw', pii: true },
  { from: 'gw', to: 'redact', pii: true },
  { from: 'redact', to: 'router' },
  { from: 'redact', to: 'llm' },
  { from: 'llm', to: 'kb' },
  { from: 'llm', to: 'crm', pii: true },
  { from: 'router', to: 'out' },
  { from: 'kb', to: 'human' },
  { from: 'crm', to: 'human', pii: true },
  { from: 'human', to: 'out' },
]

export const MODELS: ModelOption[] = [
  { id: 'm1', name: 'Claude Sonnet', provider: 'Anthropic (via AWS EU)', contextK: 200, costPer1kRuns: { value: 4.8, evidence: 'verified', asOf: '2025-06' }, latencyP50Ms: { value: 1900, evidence: 'estimated' }, quality: { value: 0.91, evidence: 'estimated' }, residency: 'EU available', recommended: true },
  { id: 'm2', name: 'GPT-4o mini', provider: 'OpenAI (Azure EU)', contextK: 128, costPer1kRuns: { value: 0.9, evidence: 'verified', asOf: '2025-06' }, latencyP50Ms: { value: 1100, evidence: 'estimated' }, quality: { value: 0.84, evidence: 'estimated' }, residency: 'EU available' },
  { id: 'm3', name: 'Llama 3.1 70B', provider: 'Self-hosted', contextK: 128, costPer1kRuns: { value: 2.6, evidence: 'estimated' }, latencyP50Ms: { value: 2400, evidence: 'assumption' }, quality: { value: null, evidence: 'untested' }, residency: 'Your infrastructure' },
  { id: 'm4', name: 'Gemini Flash', provider: 'Google (Vertex EU)', contextK: 1000, costPer1kRuns: { value: 0.6, evidence: 'verified', asOf: '2025-06' }, latencyP50Ms: { value: 900, evidence: 'estimated' }, quality: { value: 0.81, evidence: 'estimated' }, residency: 'EU available' },
]

export const INFRA = [
  { area: 'Hosting', choice: 'AWS eu-central-1', why: 'Existing account; EU residency for ticket data.', evidence: 'verified' as const },
  { area: 'Model access', choice: 'Amazon Bedrock', why: 'Keeps traffic in-region under your AWS DPA.', evidence: 'recommendation' as const },
  { area: 'Vector store', choice: 'OpenSearch Serverless', why: 'Already approved by IT; no new vendor review.', evidence: 'assumption' as const },
  { area: 'Observability', choice: 'CloudWatch + prompt logs (redacted)', why: 'Audit trail required by governance policy.', evidence: 'recommendation' as const },
  { area: 'Secrets', choice: 'AWS Secrets Manager', why: 'Standard; rotation every 90 days.', evidence: 'verified' as const },
]

export const RISKS: RiskItem[] = [
  { id: 'R-01', title: 'PII leaks into model prompts', category: 'security', likelihood: 3, impact: 5, owner: 'Security', mitigation: 'Redaction layer + output scanning; quarterly red-team.', status: 'mitigating', evidence: 'recommendation' },
  { id: 'R-02', title: 'Hallucinated shipment status', category: 'quality', likelihood: 3, impact: 4, owner: 'Support Ops', mitigation: 'Ground on order system; human review under 0.8 confidence.', status: 'mitigating', evidence: 'estimated' },
  { id: 'R-03', title: 'Vendor price increase > 30%', category: 'financial', likelihood: 2, impact: 3, owner: 'Finance', mitigation: 'Model-agnostic gateway; annual price lock.', status: 'open', evidence: 'assumption' },
  { id: 'R-04', title: 'Agent over-reliance on drafts', category: 'operational', likelihood: 4, impact: 2, owner: 'Support Ops', mitigation: 'Sample 5% for QA weekly.', status: 'open', evidence: 'assumption' },
  { id: 'R-05', title: 'EU AI Act transparency duty', category: 'governance', likelihood: 4, impact: 3, owner: 'Legal', mitigation: 'Disclose AI-assisted replies in footer.', status: 'open', evidence: 'recommendation' },
  { id: 'R-06', title: 'Vendor outage halts triage', category: 'vendor', likelihood: 2, impact: 4, owner: 'Platform', mitigation: 'Fallback to rules-based routing.', status: 'accepted', evidence: 'estimated' },
  { id: 'R-07', title: 'Prompt injection via ticket body', category: 'security', likelihood: 3, impact: 3, owner: 'Security', mitigation: 'Input isolation; tool calls read-only.', status: 'open', evidence: 'untested' },
]

export const COST_LINES: CostLine[] = [
  { id: 'c1', label: 'Response drafting (LLM)', category: 'Model usage', monthly: { low: 1400, high: 2600, currency: 'USD' }, evidence: 'estimated', driver: '7,700 drafts × $0.18–0.34' },
  { id: 'c2', label: 'Intent classification', category: 'Model usage', monthly: { low: 180, high: 340, currency: 'USD' }, evidence: 'estimated', driver: '12,400 tickets × small model' },
  { id: 'c3', label: 'Vector store + embeddings', category: 'Infrastructure', monthly: { low: 220, high: 380, currency: 'USD' }, evidence: 'estimated', driver: '2 OCUs minimum' },
  { id: 'c4', label: 'Gateway, logging, redaction', category: 'Infrastructure', monthly: { low: 420, high: 700, currency: 'USD' }, evidence: 'estimated', driver: 'Request volume' },
  { id: 'c5', label: 'Zendesk AI add-on', category: 'Licence', monthly: { low: 1000, high: 1400, currency: 'USD' }, evidence: 'verified', driver: '20 agent seats' },
]

export const ROI_DEFAULTS = {
  ticketsPerMonth: 12400,
  automationRate: 38,
  minutesSaved: 4.5,
  hourlyCost: 32,
  monthlyCost: 4300,
  implementation: 48000,
}

export const GOVERNANCE = [
  { control: 'AI use policy covers customer-facing replies', status: 'met' as const, evidence: 'verified' as const },
  { control: 'Named accountable owner for the workload', status: 'met' as const, evidence: 'verified' as const },
  { control: 'Human-in-the-loop threshold documented', status: 'partial' as const, evidence: 'recommendation' as const },
  { control: 'AI disclosure to end customers', status: 'gap' as const, evidence: 'recommendation' as const },
  { control: 'Model change management process', status: 'gap' as const, evidence: 'untested' as const },
  { control: 'Prompt and output retention schedule', status: 'partial' as const, evidence: 'assumption' as const },
]

export const SECURITY = [
  { check: 'Vendor DPA in place', status: 'verify' as const, note: 'Verify DPA with vendor before go-live.', evidence: 'untested' as const },
  { check: 'Data residency (EU)', status: 'met' as const, note: 'Bedrock eu-central-1.', evidence: 'verified' as const },
  { check: 'PII redaction before model calls', status: 'planned' as const, note: 'In architecture; not yet built.', evidence: 'recommendation' as const },
  { check: 'Prompt injection controls', status: 'gap' as const, note: 'Needs input isolation + red-team.', evidence: 'untested' as const },
  { check: 'Least-privilege tool access', status: 'met' as const, note: 'Order system read-only.', evidence: 'assumption' as const },
  { check: 'Encryption in transit and at rest', status: 'met' as const, note: 'AWS defaults, TLS 1.2+.', evidence: 'verified' as const },
]

export const EVAL_CHECKS: EvalCheck[] = [
  { id: 'e1', name: 'Intent routing accuracy', metric: 'Top-1 accuracy on 2,000 labelled tickets', threshold: '≥ 92%', result: '94.1%', status: 'pass', evidence: 'verified' },
  { id: 'e2', name: 'Draft factual grounding', metric: 'Claims supported by KB/order data', threshold: '≥ 97%', result: '95.3%', status: 'fail', evidence: 'verified' },
  { id: 'e3', name: 'PII leakage', metric: 'Redaction misses per 1k prompts', threshold: '0', result: undefined, status: 'pending', evidence: 'untested' },
  { id: 'e4', name: 'Latency p95', metric: 'End-to-end draft time', threshold: '≤ 6s', result: '4.8s', status: 'pass', evidence: 'verified' },
  { id: 'e5', name: 'Prompt injection resistance', metric: 'Red-team suite (120 cases)', threshold: '0 tool misuse', result: undefined, status: 'untested', evidence: 'untested' },
  { id: 'e6', name: 'Agent acceptance rate', metric: 'Drafts sent with ≤ minor edits', threshold: '≥ 60%', result: undefined, status: 'pending', evidence: 'estimated' },
]

export const ROADMAP: RoadmapPhase[] = [
  { id: 'p1', name: 'Discovery & data access', weeks: [1, 2], stage: 'understand', deliverables: ['Ticket export', 'DPA review', 'Intent taxonomy'], owner: 'Support Ops' },
  { id: 'p2', name: 'Vendor pilot setup', weeks: [2, 4], stage: 'configure', deliverables: ['Zendesk AI sandbox', 'Redaction layer', 'KB index'], owner: 'Platform' },
  { id: 'p3', name: 'Offline evaluation', weeks: [4, 6], stage: 'validate', deliverables: ['Eval suite run', 'Red-team', 'Go/no-go'], owner: 'AI team' },
  { id: 'p4', name: 'Shadow mode (10%)', weeks: [6, 9], stage: 'validate', deliverables: ['Drafts hidden from customers', 'Acceptance tracking'], owner: 'Support Ops' },
  { id: 'p5', name: 'Rollout & monitoring', weeks: [9, 12], stage: 'improve', deliverables: ['50% → 100% traffic', 'Weekly QA sample', 'Cost dashboard'], owner: 'Support Ops' },
]

export const BLUEPRINT_FILES: GeneratedFile[] = [
  {
    path: 'blueprint.md',
    language: 'markdown',
    content: `# Technical blueprint — Customer support triage
Northwind Logistics · v3 · sample

## Verdict
Buy (Zendesk AI agents) with own redaction and grounding guardrails.
Confidence: 0.84 (estimated)

## Why
+ 12,400 tickets/mo, 62% in 14 intents        [verified]
+ 18 months labelled history                  [verified]
− Customer PII in ticket bodies               [verified]
− EU residency required                       [verified]

## Architecture
Sources → Gateway → Redaction → Classifier / Drafter → KB, Orders → Agent review → Reply

## Go-live criteria
- Routing accuracy ≥ 92%           PASS (94.1%)
- Grounding ≥ 97%                  FAIL (95.3%) — blocker
- PII leakage = 0                  NOT TESTED`,
  },
  {
    path: 'architecture.json',
    language: 'json',
    content: `{
  "workload": "customer-support-triage",
  "verdict": "buy",
  "region": "eu-central-1",
  "components": [
    { "id": "gateway", "kind": "gateway", "zone": "internal" },
    { "id": "redaction", "kind": "guard", "zone": "internal" },
    { "id": "drafter", "kind": "model", "model": "claude-sonnet", "zone": "internal" },
    { "id": "kb", "kind": "store", "zone": "restricted" }
  ],
  "humanInTheLoop": { "threshold": 0.8 },
  "evidence": "sample"
}`,
  },
  {
    path: 'eval-plan.yaml',
    language: 'yaml',
    content: `suite: support-triage-v3
datasets:
  - name: labelled-tickets
    size: 2000
checks:
  - id: routing_accuracy
    threshold: ">= 0.92"
  - id: grounding
    threshold: ">= 0.97"
  - id: pii_leakage
    threshold: "== 0"
  - id: p95_latency_s
    threshold: "<= 6"`,
  },
  {
    path: 'governance-export.json',
    language: 'json',
    content: `{
  "version": "GovernanceExport v1",
  "enforcement": "recommended-not-enforced",
  "requirements": [
    "Disclose AI-assisted replies to customers",
    "Verify DPA with vendor before go-live",
    "Retain redacted prompts 90 days"
  ]
}`,
  },
]

export const TEAM_ACTIVITY: ActivityItem[] = [
  { id: 't1', actor: 'Priya N.', action: 'ran evaluation on', target: 'Customer support triage', at: '12m ago' },
  { id: 't2', actor: 'AI Fit', action: 'flagged a failing check in', target: 'Draft factual grounding', at: '12m ago' },
  { id: 't3', actor: 'Tom A.', action: 'updated cost assumptions for', target: 'Invoice data extraction', at: '2h ago' },
  { id: 't4', actor: 'David O.', action: 'started intake for', target: 'Contract clause review', at: 'Yesterday' },
  { id: 't5', actor: 'Sara L.', action: 'accepted No-AI verdict for', target: 'Payroll reconciliation', at: '2 days ago' },
]

export const TEAM_HISTORY: AssessmentRecord[] = [
  { id: 'th1', title: 'Customer support triage', date: '2025-06-14', verdict: 'buy', score: 84, status: 'complete', version: 3 },
  { id: 'th2', title: 'Invoice data extraction', date: '2025-06-10', verdict: 'build', score: 78, status: 'complete', version: 2 },
  { id: 'th3', title: 'Shipment status emails', date: '2025-05-21', verdict: 'automation', score: 31, status: 'complete', version: 1 },
  { id: 'th4', title: 'Payroll reconciliation', date: '2025-05-19', verdict: 'no-ai', score: 12, status: 'complete', version: 1 },
  { id: 'th5', title: 'Contract clause review', date: '2025-06-15', verdict: 'buy', score: 66, status: 'draft', version: 1 },
  { id: 'th6', title: 'Support triage (v2)', date: '2025-04-30', verdict: 'buy', score: 80, status: 'stale', version: 2 },
]

export const MEMBERS: Member[] = [
  { id: 'u1', name: 'Jordan Reyes', email: 'jordan@northwind.example', role: 'owner', lastActive: 'Now', status: 'active' },
  { id: 'u2', name: 'Priya Natarajan', email: 'priya@northwind.example', role: 'admin', lastActive: '12m ago', status: 'active' },
  { id: 'u3', name: 'Tom Alvarez', email: 'tom@northwind.example', role: 'analyst', lastActive: '2h ago', status: 'active' },
  { id: 'u4', name: 'David Okafor', email: 'david@northwind.example', role: 'analyst', lastActive: 'Yesterday', status: 'active' },
  { id: 'u5', name: 'Sara Lindqvist', email: 'sara@northwind.example', role: 'viewer', lastActive: '2 days ago', status: 'active' },
  { id: 'u6', name: '', email: 'cfo@northwind.example', role: 'viewer', lastActive: '—', status: 'invited' },
]
