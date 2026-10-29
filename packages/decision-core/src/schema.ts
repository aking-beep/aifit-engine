import { z } from 'zod';

/**
 * The decision contract shared by AI Fit Consumer (Python, `aifit.decision`)
 * and AI Fit Teams (this package). Field names, enums and defaults here are
 * mirrored in `packages/core/src/aifit/decision.py`; the shared fixtures in
 * `fixtures/` fail both suites if the two drift.
 *
 * Every field has a default so a parsed intake always has the same key set in
 * both languages. That is what makes `inputHash` reproducible across stacks.
 */

export const WorkType = z.enum([
  'classify', 'extract', 'summarize', 'generate', 'converse', 'search', 'decide',
  'act', 'transfer',
  'calculate', 'lookup', 'record',
]);
export type WorkType = z.infer<typeof WorkType>;

export const DataClass = z.enum([
  'public', 'internal', 'pii', 'sensitive_pii', 'phi', 'pci', 'financial', 'credentials', 'trade_secret', 'minors',
]);
export type DataClass = z.infer<typeof DataClass>;

export const Regulation = z.enum(['hipaa', 'pci', 'gdpr', 'ccpa', 'sox', 'ferpa', 'glba', 'eu_ai_act']);
export type Regulation = z.infer<typeof Regulation>;

export const Outcome = z.enum(['no_change', 'conventional_software', 'conventional_automation', 'buy_ai', 'build_ai']);
export type Outcome = z.infer<typeof Outcome>;

const money = z.number().nonnegative().max(1e9).nullable().default(null);
const count = z.number().nonnegative().max(1e9).nullable().default(null);

/** Free text is display-only. Nothing in the engine reads it to score. */
const freeText = (max: number) => z.string().max(max).default('');

export const DecisionIntake = z.object({
  schemaVersion: z.literal('1').default('1'),
  surface: z.enum(['consumer', 'teams']).default('consumer'),
  goal: freeText(2000),
  workTypes: z.array(WorkType).min(1).max(12).transform((xs) => Array.from(new Set(xs)).sort()),
  frequencyPerMonth: count,
  minutesPerOccurrence: count,
  currentApproach: z.enum(['none', 'manual', 'spreadsheet', 'existing_software', 'existing_ai']).default('manual'),
  currentWorksWell: z.boolean().default(false),
  correctness: z.enum(['exact', 'tolerant', 'subjective']).default('tolerant'),
  errorImpact: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  role: z.enum([
    'individual', 'student', 'creator', 'freelancer', 'small_business_owner', 'engineer', 'manager', 'executive', 'other',
  ]).default('individual'),
  technicalAbility: z.enum(['none', 'basic', 'intermediate', 'advanced']).default('basic'),
  org: z.object({
    size: z.enum(['solo', 'small', 'mid', 'enterprise']).default('solo'),
    engineers: z.number().int().nonnegative().max(100_000).default(0),
    hasMlExperience: z.boolean().default(false),
    hasSecurityReview: z.boolean().default(false),
  }).default({}),
  constraints: z.object({
    dataClasses: z.array(DataClass).max(10).default(['internal']).transform((xs) => Array.from(new Set(xs)).sort()),
    regulated: z.array(Regulation).max(8).default([]).transform((xs) => Array.from(new Set(xs)).sort()),
    dataResidency: z.enum(['any', 'us', 'eu', 'on_prem']).default('any'),
    localOnly: z.boolean().default(false),
    monthlyBudgetUsd: money,
    oneTimeBudgetUsd: money,
    timelineWeeks: z.number().nonnegative().max(520).nullable().default(null),
    integrations: z.array(z.string().trim().min(1).max(80)).max(20).default([])
      .transform((xs) => Array.from(new Set(xs.map((x) => x.toLowerCase()))).sort()),
    autonomy: z.enum(['suggest', 'approve', 'bounded', 'full']).default('suggest'),
    irreversibleActions: z.boolean().default(false),
    offTheShelfAcceptable: z.boolean().default(true),
  }).default({}),
  /** What an hour of the person's time is worth. Converts hours to dollars only when supplied. */
  hourlyValueUsd: money,
  /**
   * Figures the caller computed elsewhere, passed through with their basis.
   * Teams supplies the model run cost from its dated catalog here; the
   * decision engine never prices a model itself.
   */
  externalEstimates: z.object({
    runCostPerMonthUsd: z.object({
      low: z.number().nonnegative(),
      high: z.number().nonnegative(),
      basis: z.enum(['heuristic', 'benchmark', 'calibrated', 'measured']),
      source: z.string().max(300),
    }).nullable().default(null),
  }).default({}),
});
export type DecisionIntake = z.infer<typeof DecisionIntake>;
export type DecisionIntakeInput = z.input<typeof DecisionIntake>;

export type HardConstraintEffect = 'exclude_outcomes' | 'require_control' | 'restrict_tools';

export interface HardConstraint {
  id: string;
  triggered: boolean;
  effect: HardConstraintEffect;
  excludes: Outcome[];
  detail: string;
  /** Always deterministic: no model output reaches a hard constraint. */
  authority: 'deterministic-rule';
}

export interface Contribution {
  factor: string;
  points: number;
}

export interface OutcomeScore {
  outcome: Outcome;
  score: number;
  eligible: boolean;
  excludedBy: string[];
  contributions: Contribution[];
}

export interface SuitabilityDimension {
  key: 'taskFit' | 'correctness' | 'errorImpact' | 'data' | 'volume' | 'value';
  score: number;
  weight: number;
  known: boolean;
  reasoning: string;
}

export type CostBasis = 'heuristic' | 'user_input' | 'catalog' | 'benchmark' | 'calibrated' | 'measured';

export interface CostLine {
  id: string;
  label: string;
  low: number | null;
  high: number | null;
  unit: 'hours' | 'usd';
  period: 'one_time' | 'month';
  basis: CostBasis;
  source: string;
}

export interface DecisionResult {
  engine: { name: 'aifit-decision'; version: string; rulesVersion: string; inputHash: string };
  surface: 'consumer' | 'teams';
  outcome: Outcome;
  runnerUp: Outcome | null;
  confidence: 'low' | 'medium' | 'high';
  summary: string;
  aiSuitability: { score: number; band: string; dimensions: SuitabilityDimension[] };
  outcomeScores: OutcomeScore[];
  hardConstraints: HardConstraint[];
  requiredControls: string[];
  toolRequirements: { categories: string[]; localOnly: boolean; freeTierOnly: boolean };
  costs: { lines: CostLine[]; hoursSavedPerMonth: number | null; uncertainty: 'low' | 'medium' | 'high' };
  risk: { level: 'low' | 'medium' | 'high'; score: number; factors: string[] };
  feasibility: { level: 'low' | 'medium' | 'high'; factors: string[] };
  missingInputs: string[];
  contradictions: { id: string; detail: string }[];
  whatWouldChange: string[];
  assumptions: string[];
  limitations: string[];
  validation: { status: 'not_validated'; note: string };
}
