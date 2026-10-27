import { z } from 'zod';

/**
 * GovernanceExport v1 — what AI Fit Teams hands to ARC Control.
 *
 * Status: PROPOSED. No ARC Control endpoint for this contract is known to
 * exist; AI Fit does not assume one. The default delivery is a file the
 * customer downloads and imports. See CONTRACT.md.
 *
 * Everything in an export is a recommendation derived from one assessment.
 * `enforcement` is a literal so a consumer can never read an export as a
 * statement that a control is in force.
 */

export const CONTROL_EXPORT_CONTRACT = 'aifit.control-export' as const;
export const CONTROL_EXPORT_VERSION = '1.0.0' as const;

const Id = z.string().regex(/^[a-z0-9][a-z0-9_.-]{1,80}$/);
const Text = (max: number) => z.string().min(1).max(max);

export const GovernanceRequirement = z.object({
  id: Id,
  requirement: Text(600),
  rationale: Text(800),
  severity: z.enum(['blocking', 'recommended']),
  source: z.enum(['security-rubric', 'decision-rules', 'evaluation-plan']),
  verification: z.object({
    method: Text(400),
    /** Who must verify it. AI Fit never verifies a customer control. */
    owner: z.literal('customer'),
  }).strict(),
}).strict();

export const PolicyRule = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('require_human_approval'), actions: z.array(Text(120)).min(1).max(50) }).strict(),
  z.object({ kind: z.literal('redact_data_classes'), dataClasses: z.array(Text(40)).min(1).max(10) }).strict(),
  z.object({ kind: z.literal('deny_data_classes'), dataClasses: z.array(Text(40)).min(1).max(10) }).strict(),
  z.object({ kind: z.literal('monthly_spend_cap'), usd: z.number().positive(), basis: z.enum(['heuristic', 'benchmark', 'calibrated', 'measured']) }).strict(),
  z.object({ kind: z.literal('turn_cap'), maxTurnsPerOutcome: z.number().int().positive().max(1000) }).strict(),
  z.object({ kind: z.literal('data_residency'), region: z.enum(['us', 'eu', 'on_prem']) }).strict(),
  z.object({ kind: z.literal('tool_allow_list'), tools: z.array(Text(120)).min(1).max(50) }).strict(),
]);

export const PolicySuggestion = z.object({
  id: Id,
  title: Text(160),
  rule: PolicyRule,
  rationale: Text(800),
  status: z.literal('suggested'),
}).strict();

export const InventoryTool = z.object({
  name: Text(120),
  system: Text(120),
  write: z.boolean(),
  blastRadius: z.enum(['none', 'reversible', 'costly', 'irreversible']),
  approvalRequired: z.boolean(),
}).strict();

export const AgentInventoryEntry = z.object({
  name: Text(160),
  pattern: Text(60),
  autonomy: z.enum(['suggest', 'approve', 'bounded', 'full']),
  modelId: z.string().max(80).nullable(),
  dataClasses: z.array(Text(40)).max(10),
  tools: z.array(InventoryTool).max(50),
  /** Unknown to AI Fit; the customer assigns an accountable owner in Control. */
  owner: z.null(),
}).strict();

export const EvaluationMetric = z.object({
  name: Text(160),
  threshold: Text(300),
  measuredHow: Text(600),
  blocksLaunch: z.boolean(),
}).strict();

export const GovernanceExport = z.object({
  contract: z.literal(CONTROL_EXPORT_CONTRACT),
  version: z.literal(CONTROL_EXPORT_VERSION),
  enforcement: z.literal('recommended-not-enforced'),
  disclaimer: Text(1000),
  source: z.object({
    product: z.literal('AI Fit Teams'),
    generatedAt: z.string().datetime(),
    assessment: z.object({ id: z.string().max(60), rootId: z.string().max(60), version: z.number().int().positive() }).strict().nullable(),
    inputHash: z.string().regex(/^[0-9a-f]{64}$/),
    engines: z.record(z.string().max(60), z.string().max(80)),
  }).strict(),
  workload: z.object({
    name: Text(200),
    verdict: z.enum(['not-ai', 'not-yet', 'assisted', 'automate-bounded', 'automate']),
    outcome: z.enum(['no_change', 'conventional_software', 'conventional_automation', 'buy_ai', 'build_ai']),
    pattern: Text(60),
    dataClasses: z.array(Text(40)).max(10),
    regulated: z.array(Text(40)).max(10),
    riskLevel: z.enum(['low', 'moderate', 'high', 'severe']),
  }).strict(),
  governanceRequirements: z.array(GovernanceRequirement).max(100),
  policySuggestions: z.array(PolicySuggestion).max(100),
  agentInventory: z.object({
    required: z.boolean(),
    reason: Text(400),
    entries: z.array(AgentInventoryEntry).max(20),
  }).strict(),
  evaluationEvidence: z.object({
    /** "planned": a plan exists, nothing has been measured. Never "passed" from AI Fit. */
    status: z.enum(['planned', 'not-applicable']),
    kind: z.enum(['golden-set', 'deterministic']),
    goldenSetSize: z.number().int().positive().nullable(),
    acceptanceCriteria: z.array(EvaluationMetric).max(50),
    /** Always empty from AI Fit: it runs no evaluations. Control fills this from telemetry. */
    observed: z.array(z.never()).max(0),
    note: Text(600),
  }).strict(),
}).strict();
export type GovernanceExport = z.infer<typeof GovernanceExport>;

export function parseGovernanceExport(value: unknown) {
  return GovernanceExport.safeParse(value);
}
