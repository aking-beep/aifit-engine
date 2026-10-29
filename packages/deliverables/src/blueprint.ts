import { z } from 'zod';
import {
  assess,
  byId,
  PATTERN_LABEL,
  type Assessment,
  type CalibrationSet,
  type Workload,
} from '@aifit/teams-core';
import {
  decide,
  decisionIntakeFromWorkload,
  ENGINE_VERSION,
  OUTCOME_LABEL,
  RULES_VERSION,
  type DecisionResult,
} from '@aifit/decision-core';
import { findSecrets } from './secrets.js';

export const BLUEPRINT_VERSION = '1.0.0';

export interface BlueprintMeta {
  /** ISO timestamp, supplied by the caller so output is reproducible in tests. */
  generatedAt: string;
  assessment: { id: string; rootId: string; version: number } | null;
}

const EstimateShape = z.object({
  value: z.number(),
  low: z.number().optional(),
  high: z.number().optional(),
  basis: z.enum(['heuristic', 'benchmark', 'calibrated', 'measured']),
  confidence: z.enum(['low', 'medium', 'high']),
  source: z.string(),
  sampleSize: z.number().optional(),
  asOf: z.string().optional(),
});

/** The blueprint's top-level contract. Validated before any download is served. */
export const BlueprintSchema = z.object({
  kind: z.literal('aifit.teams.blueprint'),
  version: z.literal(BLUEPRINT_VERSION),
  title: z.string().min(1),
  meta: z.object({
    generatedAt: z.string().datetime(),
    assessment: z.object({ id: z.string(), rootId: z.string(), version: z.number().int().positive() }).nullable(),
    engines: z.record(z.string(), z.string()),
    decisionInputHash: z.string().regex(/^[0-9a-f]{64}$/),
    calibrated: z.boolean(),
    weakestBasis: z.enum(['heuristic', 'benchmark', 'calibrated', 'measured']),
  }),
  verdict: z.object({
    verdict: z.enum(['not-ai', 'not-yet', 'assisted', 'automate-bounded', 'automate']),
    headline: z.string(),
    score: EstimateShape,
    blockers: z.array(z.string()),
    unlocks: z.array(z.string()),
  }),
  decision: z.object({
    outcome: z.enum(['no_change', 'conventional_software', 'conventional_automation', 'buy_ai', 'build_ai']),
    outcomeLabel: z.string(),
    confidence: z.enum(['low', 'medium', 'high']),
    summary: z.string(),
    comparison: z.array(z.object({ outcome: z.string(), label: z.string(), score: z.number(), eligible: z.boolean(), excludedBy: z.array(z.string()) })).length(5),
    hardConstraints: z.array(z.object({ id: z.string(), detail: z.string() })),
    requiredControls: z.array(z.string()),
    whatWouldChange: z.array(z.string()),
    agreement: z.object({ consistent: z.boolean(), note: z.string() }),
  }),
  architecture: z.object({ pattern: z.string(), label: z.string(), summary: z.string(), components: z.array(z.string()), rejected: z.array(z.object({ pattern: z.string(), why: z.string() })) }),
  model: z.object({
    primary: z.object({ id: z.string(), name: z.string(), provider: z.string(), priceAsOf: z.string(), priceExpiresOn: z.string().nullable() }),
    alternatives: z.array(z.object({ id: z.string(), name: z.string(), provider: z.string() })),
    rationale: z.array(z.string()),
  }).nullable(),
  costs: z.object({
    perUnit: EstimateShape,
    perMonth: EstimateShape,
    buildCost: EstimateShape,
    paybackMonths: EstimateShape.nullable(),
    effort: z.array(z.object({ id: z.string(), label: z.string(), low: z.number().nullable(), high: z.number().nullable(), unit: z.string(), period: z.string(), basis: z.string(), source: z.string() })),
  }),
  security: z.object({
    level: z.enum(['low', 'moderate', 'high', 'severe']),
    drivers: z.array(z.string()),
    controls: z.array(z.object({ id: z.string(), requirement: z.string(), why: z.string(), verifiedBy: z.string(), blocking: z.boolean() })),
    complianceFlags: z.array(z.string()),
  }),
  evaluation: z.object({
    kind: z.enum(['golden-set', 'deterministic']),
    goldenSetSize: z.number().nullable(),
    acceptanceCriteria: z.array(z.object({ name: z.string(), threshold: z.string(), measuredHow: z.string(), blocksLaunch: z.boolean() })),
    cadence: z.string(),
    regressionPolicy: z.string(),
    humanBaselineNote: z.string(),
  }),
  milestones: z.array(z.object({ name: z.string(), durationWeeks: z.number(), goal: z.string(), exitCriteria: z.array(z.string()), killCriteria: z.string() })),
  unknowns: z.array(z.string()),
  assumptions: z.array(z.string()),
  limitations: z.array(z.string()),
  validation: z.object({ status: z.literal('not_validated'), note: z.string() }),
}).strict();
export type Blueprint = z.infer<typeof BlueprintSchema>;

export interface BlueprintBundle {
  blueprint: Blueprint;
  assessment: Assessment;
  decision: DecisionResult;
}

const AI_OUTCOMES = new Set(['buy_ai', 'build_ai']);

function agreement(verdict: string, outcome: string): { consistent: boolean; note: string } {
  const aiOutcome = AI_OUTCOMES.has(outcome);
  if (verdict === 'not-ai' && aiOutcome) {
    return { consistent: false, note: 'The suitability rubric says not to use a model, but the option comparison favours an AI option. Treat this as unresolved: the rubric weighs task shape and correctness more heavily. Check the blockers before buying or building.' };
  }
  if ((verdict === 'automate' || verdict === 'automate-bounded') && !aiOutcome) {
    return { consistent: false, note: 'The suitability rubric rates this a strong AI candidate, but the option comparison favours a non-AI option (usually because of budget, capacity or volume). Read the comparison before committing either way.' };
  }
  return { consistent: true, note: 'The suitability verdict and the option comparison point the same way.' };
}

/**
 * Build the blueprint from a Workload. Pure apart from `meta`, which the
 * caller supplies, so the same inputs always produce the same document.
 */
export function buildBlueprint(workload: Workload, meta: BlueprintMeta, calibration: CalibrationSet | null = null): BlueprintBundle {
  const a = assess(workload, { depth: 'business', calibration });
  const run = a.model
    ? {
        low: a.cost.perMonth.low ?? a.cost.perMonth.value,
        high: a.cost.perMonth.high ?? a.cost.perMonth.value,
        basis: a.cost.perMonth.basis,
        source: `${a.cost.perMonth.source}${a.cost.perMonth.asOf ? ` (prices as of ${a.cost.perMonth.asOf})` : ''}`.slice(0, 300),
      }
    : null;
  const d = decide(decisionIntakeFromWorkload(a.workload, run));
  const primary = a.model ? byId(a.model.primary.id) : undefined;

  const blueprint: Blueprint = {
    kind: 'aifit.teams.blueprint',
    version: BLUEPRINT_VERSION,
    title: a.workload.name,
    meta: {
      generatedAt: meta.generatedAt,
      assessment: meta.assessment,
      engines: {
        blueprint: BLUEPRINT_VERSION,
        decision: ENGINE_VERSION,
        decisionRules: RULES_VERSION,
        suitabilityRubric: 'ARK suitability rubric v0.1',
        modelCatalogAsOf: primary?.asOf ?? 'n/a',
      },
      decisionInputHash: d.engine.inputHash,
      calibrated: a.trust.calibrated,
      weakestBasis: a.trust.weakestBasis,
    },
    verdict: {
      verdict: a.suitability.verdict,
      headline: a.suitability.headline,
      score: a.suitability.score,
      blockers: a.suitability.blockers,
      unlocks: a.suitability.unlocks,
    },
    decision: {
      outcome: d.outcome,
      outcomeLabel: OUTCOME_LABEL[d.outcome],
      confidence: d.confidence,
      summary: d.summary,
      comparison: d.outcomeScores.map((o) => ({ outcome: o.outcome, label: OUTCOME_LABEL[o.outcome], score: o.score, eligible: o.eligible, excludedBy: o.excludedBy })),
      hardConstraints: d.hardConstraints.filter((h) => h.triggered).map((h) => ({ id: h.id, detail: h.detail })),
      requiredControls: d.requiredControls,
      whatWouldChange: d.whatWouldChange,
      agreement: agreement(a.suitability.verdict, d.outcome),
    },
    architecture: {
      pattern: a.architecture.pattern,
      label: PATTERN_LABEL[a.architecture.pattern],
      summary: a.architecture.summary,
      components: a.architecture.components,
      rejected: a.architecture.rejected,
    },
    model: a.model && primary
      ? {
          primary: { id: primary.id, name: primary.displayName, provider: primary.provider, priceAsOf: primary.asOf, priceExpiresOn: primary.priceExpiresOn ?? null },
          alternatives: a.model.alternatives.map((m) => ({ id: m.id, name: m.displayName, provider: m.provider })),
          rationale: a.model.rationale,
        }
      : null,
    costs: {
      perUnit: a.cost.perUnit,
      perMonth: a.cost.perMonth,
      buildCost: a.buildCost,
      paybackMonths: a.value.paybackMonths ?? null,
      effort: d.costs.lines,
    },
    security: {
      level: a.security.level,
      drivers: a.security.drivers,
      controls: a.security.controls,
      complianceFlags: a.security.complianceFlags,
    },
    evaluation: {
      kind: a.evaluation.kind,
      goldenSetSize: a.evaluation.goldenSetSize,
      acceptanceCriteria: a.evaluation.metrics,
      cadence: a.evaluation.cadence,
      regressionPolicy: a.evaluation.regressionPolicy,
      humanBaselineNote: a.evaluation.humanBaselineNote,
    },
    milestones: a.phases,
    unknowns: [...a.trust.unknowns, ...d.missingInputs.map((m) => `Not supplied: ${m}.`)],
    assumptions: d.assumptions,
    limitations: [
      ...d.limitations,
      'Figures tagged heuristic are rules of thumb, not forecasts.',
      'This blueprint is generated from your answers; it has not been reviewed by an engineer, security reviewer or lawyer.',
    ],
    validation: {
      status: 'not_validated',
      note: 'Generated by rules from the inputs shown. No evaluation, security review or cost measurement has been run for this workload.',
    },
  };
  return { blueprint: BlueprintSchema.parse(blueprint), assessment: a, decision: d };
}

// --- Markdown -----------------------------------------------------------------

const money = (n: number) => (n >= 100 ? `$${Math.round(n).toLocaleString('en-US')}` : `$${n.toFixed(n < 1 ? 4 : 2)}`);
function est(e: { value: number; low?: number; high?: number; basis: string }, fmt: (n: number) => string = money): string {
  const range = e.low !== undefined && e.high !== undefined ? ` (range ${fmt(e.low)}–${fmt(e.high)})` : '';
  return `${fmt(e.value)}${range} — *${e.basis}*`;
}
const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function blueprintMarkdown(b: Blueprint): string {
  const L: string[] = [];
  const h = (t: string) => L.push('', `## ${t}`, '');
  L.push(`# Technical blueprint — ${b.title}`, '');
  L.push(`Generated ${b.meta.generatedAt} by AI Fit Teams. ${b.meta.calibrated ? 'Some figures are calibrated against telemetry.' : 'Uncalibrated: every figure rests on rules of thumb unless tagged otherwise.'}`);
  if (b.meta.assessment) L.push('', `Assessment ${b.meta.assessment.id}, version ${b.meta.assessment.version}.`);
  L.push('', `> ${b.validation.note}`);

  h('1. Verdict');
  L.push(`**${b.verdict.verdict}** — ${b.verdict.headline}`, '', `Suitability score: ${est(b.verdict.score, (n) => `${n}/100`)}`);
  if (b.verdict.blockers.length) L.push('', '**Blockers**', '', ...b.verdict.blockers.map((x) => `- ${x}`));
  if (b.verdict.unlocks.length) L.push('', '**What would move the verdict**', '', ...b.verdict.unlocks.map((x) => `- ${x}`));

  h('2. Build, buy, or automate');
  L.push(`Recommended: **${b.decision.outcomeLabel}** (confidence ${b.decision.confidence}). ${b.decision.summary}`, '');
  L.push('| Option | Score | Eligible |', '|---|---:|---|');
  for (const c of b.decision.comparison) L.push(`| ${c.label} | ${c.score} | ${c.eligible ? 'yes' : `no — ${c.excludedBy.join(', ')}`} |`);
  L.push('', `*${b.decision.agreement.note}*`);
  if (b.decision.hardConstraints.length) L.push('', '**Hard rules that applied**', '', ...b.decision.hardConstraints.map((x) => `- \`${x.id}\` ${x.detail}`));
  if (b.decision.whatWouldChange.length) L.push('', '**What would change the answer**', '', ...b.decision.whatWouldChange.map((x) => `- ${x}`));

  h('3. Architecture');
  L.push(`**${b.architecture.label}** (\`${b.architecture.pattern}\`). ${b.architecture.summary}`, '', '**Components**', '', ...b.architecture.components.map((x) => `- ${x}`));
  if (b.architecture.rejected.length) L.push('', '**Rejected**', '', ...b.architecture.rejected.map((r) => `- \`${r.pattern}\`: ${r.why}`));

  h('4. Model and infrastructure');
  if (b.model) {
    L.push(`Primary: **${b.model.primary.name}** (${b.model.primary.provider}), list prices as of ${b.model.primary.priceAsOf}${b.model.primary.priceExpiresOn ? `; promotional rate ends ${b.model.primary.priceExpiresOn}` : ''}.`);
    if (b.model.alternatives.length) L.push('', `Alternatives: ${b.model.alternatives.map((m) => `${m.name} (${m.provider})`).join(', ')}.`);
    L.push('', ...b.model.rationale.map((x) => `- ${x}`));
  } else {
    L.push('No model is recommended: the verdict is that a deterministic implementation is the right tool.');
  }

  h('5. Cost and operating expense');
  L.push('| Item | Estimate |', '|---|---|');
  L.push(`| Run cost per unit | ${est(b.costs.perUnit)} |`, `| Run cost per month | ${est(b.costs.perMonth)} |`, `| Build cost | ${est(b.costs.buildCost)} |`);
  L.push(`| Payback | ${b.costs.paybackMonths ? est(b.costs.paybackMonths, (n) => `${n.toFixed(1)} months`) : 'unknowable from the inputs given'} |`);
  for (const l of b.costs.effort) {
    const f = (n: number) => (l.unit === 'usd' ? money(n) : `${n.toLocaleString('en-US')} h`);
    const range = l.low === null || l.high === null ? 'not estimated' : l.low === l.high ? f(l.low) : `${f(l.low)}–${f(l.high)}`;
    L.push(`| ${cell(l.label)} (${l.period === 'month' ? 'per month' : 'one time'}) | ${range} — *${l.basis}*: ${cell(l.source)} |`);
  }

  h('6. Security, privacy and governance');
  L.push(`Risk level: **${b.security.level}**.`, '', ...b.security.drivers.map((x) => `- ${x}`));
  L.push('', '| Control | Requirement | Blocking | Verified by |', '|---|---|---|---|');
  for (const c of b.security.controls) L.push(`| ${c.id} | ${cell(c.requirement)} | ${c.blocking ? 'yes' : 'no'} | ${cell(c.verifiedBy)} |`);
  if (b.decision.requiredControls.length) L.push('', '**Also required by the decision rules**', '', ...b.decision.requiredControls.map((x) => `- ${x}`));
  if (b.security.complianceFlags.length) L.push('', '**Compliance flags** (confirm with counsel; AI Fit does not certify compliance)', '', ...b.security.complianceFlags.map((x) => `- ${x}`));

  h('7. Evaluation plan and acceptance criteria');
  L.push(b.evaluation.kind === 'golden-set' ? `Golden set of ${b.evaluation.goldenSetSize} real, labelled examples.` : 'Deterministic: test the rules directly; no golden set.');
  L.push('', '| Metric | Threshold | How measured | Blocks launch |', '|---|---|---|---|');
  for (const m of b.evaluation.acceptanceCriteria) L.push(`| ${cell(m.name)} | ${cell(m.threshold)} | ${cell(m.measuredHow)} | ${m.blocksLaunch ? 'yes' : 'no'} |`);
  L.push('', `Cadence: ${b.evaluation.cadence}`, '', `Regression policy: ${b.evaluation.regressionPolicy}`, '', b.evaluation.humanBaselineNote);

  h('8. Implementation milestones');
  b.milestones.forEach((p, i) => {
    L.push(`### ${i + 1}. ${p.name} (${p.durationWeeks} week${p.durationWeeks === 1 ? '' : 's'}, rule of thumb)`, '', p.goal, '', '**Exit criteria**', '', ...p.exitCriteria.map((x) => `- ${x}`), '', `**Kill criteria:** ${p.killCriteria}`, '');
  });

  h('9. What this blueprint does not know');
  L.push(...b.unknowns.map((x) => `- ${x}`), '', '**Assumptions**', '', ...b.assumptions.map((x) => `- ${x}`), '', '**Limitations**', '', ...b.limitations.map((x) => `- ${x}`));
  L.push('', '---', '', `Engines: ${Object.entries(b.meta.engines).map(([k, v]) => `${k} ${v}`).join(' · ')} · decision input ${b.meta.decisionInputHash.slice(0, 16)}`, '');
  return L.join('\n');
}

export class DeliverableValidationError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`Deliverable failed validation: ${problems.join('; ')}`);
    this.problems = problems;
  }
}

/** Final gate before any download: schema, format and secret checks. */
export function renderBlueprint(b: Blueprint, format: 'json' | 'md'): { filename: string; contentType: string; body: string } {
  const problems: string[] = [];
  const parsed = BlueprintSchema.safeParse(b);
  if (!parsed.success) problems.push('blueprint does not match its schema');
  const body = format === 'json' ? JSON.stringify(b, null, 2) + '\n' : blueprintMarkdown(b);
  if (format === 'json') {
    try { JSON.parse(body); } catch { problems.push('JSON did not round-trip'); }
  } else if (!body.startsWith('# ')) {
    problems.push('Markdown does not start with a heading');
  }
  const leaked = findSecrets(body);
  if (leaked.length) problems.push(`credential-like content found (${leaked.join(', ')})`);
  if (problems.length) throw new DeliverableValidationError(problems);
  const slug = b.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'workload';
  return format === 'json'
    ? { filename: `blueprint-${slug}.json`, contentType: 'application/json; charset=utf-8', body }
    : { filename: `blueprint-${slug}.md`, contentType: 'text/markdown; charset=utf-8', body };
}
