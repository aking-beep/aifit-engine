import { assess, type Assessment, type Workload } from '@aifit/teams-core';
import { decide, decisionIntakeFromWorkload, type DecisionResult } from '@aifit/decision-core';
import type { SyntheticCase } from './workloads.js';

/**
 * Rules every report must obey, whatever the workload. A failure here is a bug
 * in the engine, not a matter of judgement.
 */

export interface Run {
  assessment: Assessment;
  decision: DecisionResult;
}

/** Mirrors apps/teams/src/server/assessments.ts decisionFor. */
export function run(w: Workload): Run {
  const a = assess(w);
  const runCost = a.model
    ? { low: a.cost.perMonth.low ?? a.cost.perMonth.value, high: a.cost.perMonth.high ?? a.cost.perMonth.value, basis: a.cost.perMonth.basis, source: a.cost.perMonth.source.slice(0, 300) }
    : null;
  return { assessment: a, decision: decide(decisionIntakeFromWorkload(a.workload, runCost)) };
}

type Est = { value: number; low?: number; high?: number } | null | undefined;

function checkEstimate(name: string, e: Est, out: string[], allowNegative = false) {
  if (!e) return;
  for (const [k, v] of [['value', e.value], ['low', e.low], ['high', e.high]] as const) {
    if (v === undefined) continue;
    if (!Number.isFinite(v)) out.push(`${name}.${k} is not finite (${v})`);
    else if (!allowNegative && v < 0) out.push(`${name}.${k} is negative (${v})`);
  }
  if (e.low !== undefined && e.low > e.value + 1e-9) out.push(`${name}: low ${e.low} > value ${e.value}`);
  if (e.high !== undefined && e.high < e.value - 1e-9) out.push(`${name}: high ${e.high} < value ${e.value}`);
}

const SENSITIVE = ['pii', 'sensitive_pii', 'phi', 'pci', 'financial', 'credentials', 'trade_secret', 'minors'];

export function invariantViolations(w: Workload, r: Run = run(w)): string[] {
  const out: string[] = [];
  const { assessment: a, decision: d } = r;
  const verdict = a.suitability.verdict;

  // Determinism: the same workload gives the same verdict, outcome and cost.
  const again = run(w);
  if (again.assessment.suitability.verdict !== verdict) out.push('verdict changed between identical runs');
  if (again.decision.outcome !== d.outcome) out.push('outcome changed between identical runs');
  if (again.decision.engine.inputHash !== d.engine.inputHash) out.push('decision input hash changed between identical runs');
  if (again.assessment.cost.perMonth.value !== a.cost.perMonth.value) out.push('monthly cost changed between identical runs');

  // A report that says "don't use AI" must not name a model, charge for one, or pick an AI outcome.
  if (verdict === 'not-ai') {
    if (a.model !== null) out.push('not-ai verdict but a model is named');
    if (a.cost.perMonth.value !== 0) out.push(`not-ai verdict but monthly model cost is ${a.cost.perMonth.value}`);
    if (d.outcome === 'buy_ai' || d.outcome === 'build_ai') out.push(`not-ai verdict but decision outcome is ${d.outcome}`);
  } else if (a.model === null) {
    out.push(`verdict ${verdict} but no model is named`);
  }

  // Numbers are finite, non-negative where they must be, and ranges are ordered.
  checkEstimate('cost.perUnit', a.cost.perUnit, out);
  checkEstimate('cost.perMonth', a.cost.perMonth, out);
  checkEstimate('cost.wastedOnFailures', a.cost.wastedOnFailures, out);
  checkEstimate('buildCost', a.buildCost, out);
  checkEstimate('value.humanCostPerUnit', a.value.humanCostPerUnit, out);
  checkEstimate('value.netPerMonth', a.value.netPerMonth, out, true);
  checkEstimate('value.paybackMonths', a.value.paybackMonths, out);

  // No invented savings: without a measured time per unit there is no human cost to compare.
  if (w.current.minutesPerUnit === undefined && w.current.costPerUnitUsd === undefined && a.value.humanCostPerUnit !== null) {
    out.push('human cost per unit reported although no time or cost per unit was given');
  }

  // Scores live on 0..100.
  const scores: [string, number][] = [
    ['suitability', a.suitability.score.value],
    ['security', a.security.score],
    ['decision.aiSuitability', d.aiSuitability.score],
    ['decision.risk', d.risk.score],
    ...a.suitability.dimensions.map((x) => [`dimension.${x.key}`, x.score] as [string, number]),
  ];
  for (const [k, v] of scores) if (!Number.isFinite(v) || v < 0 || v > 100) out.push(`${k} score ${v} outside 0..100`);

  // Irreversible actions run without a person are never "automate".
  const irreversible = w.actions.some((x) => x.blastRadius === 'irreversible');
  if (irreversible && (w.autonomy === 'full' || w.autonomy === 'bounded') && (verdict === 'automate' || verdict === 'automate-bounded')) {
    out.push(`irreversible action with ${w.autonomy} autonomy but verdict is ${verdict}`);
  }
  // Zero error tolerance never gets full automation.
  if (w.errorTolerance === 'none' && verdict === 'automate') out.push('zero error tolerance but verdict is automate');

  // Sensitive data always comes with controls.
  if (w.dataClasses.some((c) => SENSITIVE.includes(c)) && a.security.controls.length === 0) out.push('sensitive data but no security controls');

  // Regulated data always raises its flag.
  const flags = a.security.complianceFlags.join(' | ');
  if (w.dataClasses.includes('phi') && !flags.includes('HIPAA')) out.push('PHI without a HIPAA flag');
  if (w.dataClasses.includes('pci') && !flags.includes('PCI DSS')) out.push('cardholder data without a PCI DSS flag');
  if (w.dataClasses.includes('minors') && !flags.includes('minors')) out.push('data about minors without a flag');

  // The chosen outcome passed its own hard constraints.
  const chosen = d.outcomeScores.find((s) => s.outcome === d.outcome);
  if (!chosen) out.push(`chosen outcome ${d.outcome} has no score`);
  else if (!chosen.eligible) out.push(`chosen outcome ${d.outcome} was excluded by ${chosen.excludedBy.join(', ')}`);
  if (d.runnerUp === d.outcome) out.push('runner-up equals the chosen outcome');
  if (w.planning.offTheShelfAcceptable === false && d.outcome === 'buy_ai') out.push('hosted tools refused but outcome is buy_ai');

  // The decision is never presented as validated.
  if (d.validation.status !== 'not_validated') out.push('decision claims to be validated');

  return out;
}

const RISK_ORDER = ['low', 'moderate', 'high', 'severe'] as const;

/** Where the engine's answer falls outside what a practitioner expected. */
export function expectationMisses(c: SyntheticCase, r: Run = run(c.workload)): string[] {
  const out: string[] = [];
  const { assessment: a, decision: d } = r;
  const e = c.expect;
  if (!e.verdict.includes(a.suitability.verdict)) out.push(`verdict ${a.suitability.verdict}, expected ${e.verdict.join(' | ')}`);
  if (e.outcome && !e.outcome.includes(d.outcome)) out.push(`outcome ${d.outcome}, expected ${e.outcome.join(' | ')}`);
  if (e.notOutcome?.includes(d.outcome)) out.push(`outcome ${d.outcome}, which should not be chosen here`);
  for (const f of e.flags ?? []) {
    if (!a.security.complianceFlags.some((x) => x.startsWith(f))) out.push(`missing compliance flag ${f}`);
  }
  if (e.minRisk && RISK_ORDER.indexOf(a.security.level) < RISK_ORDER.indexOf(e.minRisk)) {
    out.push(`security level ${a.security.level}, expected at least ${e.minRisk}`);
  }
  return out;
}
