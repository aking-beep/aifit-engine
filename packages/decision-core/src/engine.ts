import { RULES } from './generated/rules.js';
import { canonicalJson, sha256Hex } from './canonical.js';
import {
  DecisionIntake,
  type CostLine,
  type Contribution,
  type DecisionIntakeInput,
  type DecisionResult,
  type HardConstraint,
  type Outcome,
  type OutcomeScore,
  type SuitabilityDimension,
  type WorkType,
} from './schema.js';

/**
 * The five-outcome decision engine.
 *
 * Deterministic and pure: the same parsed intake always yields the same
 * result, with no clock, randomness or network. Free text (`goal`) is hashed
 * so a saved result can be traced to its input, but no rule reads it.
 *
 * Every weight comes from RULES (rules/decision-rules.v1.json). Points are
 * accumulated in integer tenths and rounded half-up so the Python port in
 * `aifit.decision` reproduces every score exactly.
 */

export const ENGINE_NAME = 'aifit-decision' as const;
export const ENGINE_VERSION: string = RULES.engineVersion;
export const RULES_VERSION: string = RULES.rulesVersion;

const T = RULES.thresholds;
const ORDER = RULES.outcomes.order as readonly Outcome[];

const DET = new Set<string>(RULES.workTypes.deterministic);
const FLOW = new Set<string>(RULES.workTypes.flow);
const AI = new Set<string>(RULES.workTypes.ai);
const SENSITIVE = new Set<string>(RULES.sensitiveDataClasses);
const HIGHLY_REGULATED = new Set<string>(RULES.highlyRegulatedDataClasses);

/** Round half-up to an integer. `Math.round` is half-up for positives; this is for both signs. */
export function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5);
}

/** points * (count / total), in tenths, rounded half-up. */
function sharePoints(points: number, count: number, total: number): number {
  return roundHalfUp((points * 10 * count) / total);
}

const tenths = (points: number) => points * 10;

function bandFor(score: number, table: readonly { atLeast: number; [k: string]: unknown }[], key: string): string {
  for (const row of table) if (score >= row.atLeast) return row[key] as string;
  return table[table.length - 1]![key] as string;
}

function stepScore(value: number, table: readonly { atLeast: number; score: number }[]): number {
  for (const row of table) if (value >= row.atLeast) return row.score;
  return table[table.length - 1]!.score;
}

export interface Shares {
  total: number;
  det: number;
  flow: number;
  ai: number;
}

export function shares(workTypes: readonly WorkType[]): Shares {
  return {
    total: workTypes.length,
    det: workTypes.filter((w) => DET.has(w)).length,
    flow: workTypes.filter((w) => FLOW.has(w)).length,
    ai: workTypes.filter((w) => AI.has(w)).length,
  };
}

export function hoursPerMonth(i: DecisionIntake): number | null {
  if (i.frequencyPerMonth === null || i.minutesPerOccurrence === null) return null;
  return (i.frequencyPerMonth * i.minutesPerOccurrence) / 60;
}

/** Parse, then decide. The only public entry point that accepts unknown input. */
export function decide(input: DecisionIntakeInput | unknown): DecisionResult {
  return decideParsed(DecisionIntake.parse(input));
}

export function inputHash(i: DecisionIntake): string {
  return sha256Hex(canonicalJson(i));
}

export function decideParsed(i: DecisionIntake): DecisionResult {
  const s = shares(i.workTypes);
  const hours = hoursPerMonth(i);
  const sensitive = i.constraints.dataClasses.filter((d) => SENSITIVE.has(d));
  const highlyRegulated = i.constraints.dataClasses.some((d) => HIGHLY_REGULATED.has(d));
  const localOnly = i.constraints.localOnly || i.constraints.dataResidency === 'on_prem';

  const hardConstraints = evaluateHardConstraints(i, s, localOnly, highlyRegulated);
  const excluded = new Map<Outcome, string[]>();
  for (const hc of hardConstraints) {
    if (!hc.triggered) continue;
    for (const o of hc.excludes) excluded.set(o, [...(excluded.get(o) ?? []), hc.id]);
  }

  const outcomeScores = scoreOutcomes(i, s, hours, sensitive.length > 0, localOnly).map((o) => ({
    ...o,
    eligible: !excluded.has(o.outcome),
    excludedBy: excluded.get(o.outcome) ?? [],
  }));

  // Highest eligible score wins; ties go to the simpler outcome (earlier in ORDER).
  const ranked = outcomeScores
    .filter((o) => o.eligible)
    .sort((a, b) => b.score - a.score || ORDER.indexOf(a.outcome) - ORDER.indexOf(b.outcome));
  // no_change and conventional_software are never excluded, so ranked is never empty.
  const winner = ranked[0]!;
  const runnerUp = ranked[1] ?? null;

  const missingInputs = missing(i);
  const contradictions = findContradictions(i, s);
  const margin = runnerUp ? winner.score - runnerUp.score : 100;
  const hoursKnown = hours !== null;
  const confidence: DecisionResult['confidence'] =
    contradictions.length > 0 ? 'low'
      : margin >= T.confidenceHighMargin && hoursKnown ? 'high'
        : margin >= T.confidenceMediumMargin ? 'medium'
          : 'low';

  const outcome = winner.outcome;
  const isAi = outcome === 'buy_ai' || outcome === 'build_ai';
  const suitability = aiSuitability(i, s, hours, sensitive.length);

  return {
    engine: { name: ENGINE_NAME, version: ENGINE_VERSION, rulesVersion: RULES_VERSION, inputHash: inputHash(i) },
    surface: i.surface,
    outcome,
    runnerUp: runnerUp?.outcome ?? null,
    confidence,
    summary: SUMMARY[outcome],
    aiSuitability: suitability,
    outcomeScores,
    hardConstraints,
    requiredControls: requiredControls(hardConstraints, isAi),
    toolRequirements: {
      categories: outcome === 'buy_ai' ? toolCategories(i.workTypes, localOnly) : [],
      localOnly,
      freeTierOnly: i.constraints.monthlyBudgetUsd === 0,
    },
    costs: costs(i, outcome, hours),
    risk: risk(i, sensitive.length, highlyRegulated),
    feasibility: feasibility(i, outcome, sensitive.length > 0),
    missingInputs,
    contradictions,
    whatWouldChange: whatWouldChange(runnerUp?.outcome ?? null, outcomeScores),
    assumptions: ASSUMPTIONS,
    limitations: LIMITATIONS,
    validation: {
      status: 'not_validated',
      note: 'No validation step has run against real outcomes for this recommendation. It is a structured argument from your inputs and the published rules, not a measured prediction.',
    },
  };
}

// --- Hard constraints ----------------------------------------------------

function hc(id: string, triggered: boolean, effect: HardConstraint['effect'], excludes: Outcome[], detail: string): HardConstraint {
  return { id, triggered, effect, excludes, detail, authority: 'deterministic-rule' };
}

export function evaluateHardConstraints(i: DecisionIntake, s: Shares, localOnly: boolean, highlyRegulated: boolean): HardConstraint[] {
  const c = i.constraints;
  const regulated = c.regulated.length > 0 || highlyRegulated;
  return [
    hc('HC_DETERMINISTIC_ONLY', s.ai === 0, 'exclude_outcomes', ['buy_ai', 'build_ai'],
      'None of the work is language or judgement. Every step has a computable answer or is moving data, so a model adds cost and variance for no gain.'),
    hc('HC_CREDENTIALS_IN_DATA', c.dataClasses.includes('credentials'), 'exclude_outcomes', ['buy_ai'],
      'Credentials (keys, passwords, tokens) are in the data. They must never be pasted into a third-party AI tool; any AI path must redact or vault them before a prompt is built.'),
    hc('HC_HOSTED_TOOLS_REFUSED', !c.offTheShelfAcceptable, 'exclude_outcomes', ['buy_ai'],
      'You said a third-party hosted tool is not acceptable for this work.'),
    hc('HC_NO_BUILD_CAPACITY', i.org.engineers === 0 && (i.technicalAbility === 'none' || i.technicalAbility === 'basic'), 'exclude_outcomes', ['build_ai'],
      'Nobody available can build or maintain custom software, so building an AI system is not a realistic option.'),
    hc('HC_ZERO_BUDGET', c.monthlyBudgetUsd === 0 && !localOnly, 'exclude_outcomes', ['build_ai'],
      'A monthly budget of zero rules out paying for model API calls, which a hosted build needs.'),
    hc('HC_LOCAL_ONLY', localOnly, 'restrict_tools', [],
      'Data must stay on your own machines. Only tools the registry lists as local or self-hosted are eligible.'),
    hc('HC_FREE_TIER_ONLY', c.monthlyBudgetUsd === 0, 'restrict_tools', [],
      'With no monthly budget, only tools the registry lists with a free tier are eligible. Free tiers have limits; check them.'),
    hc('HC_REGULATED_DATA', regulated, 'require_control', [],
      'Regulated or highly sensitive data is in scope. Before any vendor sees it you need a signed agreement that covers it (for example a BAA or DPA) on the plan you use. AI Fit does not verify any vendor\'s certifications or agreements.'),
    hc('HC_IRREVERSIBLE_AUTONOMY', c.irreversibleActions && (c.autonomy === 'bounded' || c.autonomy === 'full'), 'require_control', [],
      'Irreversible actions with autonomy. A person must approve each irreversible action before it runs.'),
    hc('HC_CRITICAL_EXACT', i.errorImpact === 'critical' && i.correctness === 'exact' && s.ai > 0, 'require_control', [],
      'A wrong answer is critical and there is one exact answer. Any model output needs a deterministic check before it is used.'),
  ];
}

function requiredControls(hcs: HardConstraint[], isAi: boolean): string[] {
  const out: string[] = [];
  const on = (id: string) => hcs.some((h) => h.id === id && h.triggered);
  if (on('HC_CREDENTIALS_IN_DATA')) out.push('Redact or vault credentials before any text reaches a model.');
  if (on('HC_REGULATED_DATA')) out.push('Confirm in writing that your vendor agreement covers this data class, on the plan you use.');
  if (on('HC_IRREVERSIBLE_AUTONOMY')) out.push('Human approval gate on every irreversible action.');
  if (on('HC_CRITICAL_EXACT')) out.push('Deterministic verification of every model output before it is used.');
  if (isAi) {
    out.push('Keep a person reviewing outputs until you have measured the error rate on real examples.');
    out.push('Do not paste data into a tool whose data-retention terms you have not read.');
  }
  return out;
}

// --- Outcome scores --------------------------------------------------------

function scoreOutcomes(i: DecisionIntake, s: Shares, hours: number | null, sensitive: boolean, localOnly: boolean): Omit<OutcomeScore, 'eligible' | 'excludedBy'>[] {
  const O = RULES.outcomes;
  const c = i.constraints;
  const exact = i.correctness === 'exact';
  const freq = i.frequencyPerMonth;
  const lowTech = i.technicalAbility === 'none' || i.technicalAbility === 'basic';
  const shortTimeline = c.timelineWeeks !== null && c.timelineWeeks <= T.shortTimelineWeeks;
  const integrations = c.integrations.length;

  const build = (outcome: Outcome, parts: [string, number, boolean][]): Omit<OutcomeScore, 'eligible' | 'excludedBy'> => {
    const contributions: Contribution[] = parts.filter(([, , on]) => on).map(([factor, t]) => ({ factor, points: t / 10 }));
    const totalTenths = parts.filter(([, , on]) => on).reduce((sum, [, t]) => sum + t, 0);
    const score = Math.max(0, Math.min(1000, totalTenths)) / 10;
    return { outcome, score, contributions };
  };

  return [
    build('no_change', [
      ['base', tenths(O.no_change.base), true],
      ['negligible time involved', tenths(O.no_change.negligibleHours), hours !== null && hours < T.negligibleHoursPerMonth],
      ['little time involved', tenths(O.no_change.smallHours), hours !== null && hours >= T.negligibleHoursPerMonth && hours < T.smallHoursPerMonth],
      ['today\'s approach works', tenths(O.no_change.currentWorksWell), i.currentWorksWell],
      ['a lot of time involved', tenths(O.no_change.largeHoursPenalty), hours !== null && hours >= T.largeHoursPerMonth],
    ]),
    build('conventional_software', [
      ['base', tenths(O.conventional_software.base), true],
      ['share of computable work', sharePoints(O.conventional_software.deterministicShare, s.det, s.total), s.det > 0],
      ['one exact answer', tenths(O.conventional_software.exactCorrectness), exact],
      ['done by hand or in a spreadsheet today', tenths(O.conventional_software.manualToday),
        s.det > 0 && (i.currentApproach === 'manual' || i.currentApproach === 'spreadsheet' || i.currentApproach === 'none')],
    ]),
    build('conventional_automation', [
      ['base', tenths(O.conventional_automation.base), true],
      ['share of data-moving or action work', sharePoints(O.conventional_automation.flowShare, s.flow, s.total), s.flow > 0],
      ['share of computable work', sharePoints(O.conventional_automation.deterministicShare, s.det, s.total), s.det > 0],
      ['repeats often', tenths(O.conventional_automation.repetitive), freq !== null && freq >= T.repetitiveFrequencyPerMonth],
      ['one exact answer', tenths(O.conventional_automation.exactCorrectness), exact],
      ['systems to connect', tenths(O.conventional_automation.hasIntegrations), integrations > 0],
    ]),
    build('buy_ai', [
      ['base', tenths(O.buy_ai.base), true],
      ['share of language or judgement work', sharePoints(O.buy_ai.aiShare, s.ai, s.total), s.ai > 0],
      ['a range of answers is acceptable', tenths(O.buy_ai.tolerantCorrectness), !exact],
      ['one exact answer', tenths(O.buy_ai.exactCorrectnessPenalty), exact],
      ['little technical experience', tenths(O.buy_ai.lowTechnicalAbility), lowTech],
      ['no engineers', tenths(O.buy_ai.noEngineers), i.org.engineers === 0],
      ['short timeline', tenths(O.buy_ai.shortTimeline), shortTimeline],
      ['modest volume', tenths(O.buy_ai.modestVolume), freq !== null && freq < T.buyVolumeCeilingPerMonth],
      ['many systems to connect', tenths(O.buy_ai.manyIntegrationsPenalty), integrations > T.manyIntegrations],
      ['sensitive data', tenths(O.buy_ai.sensitiveDataPenalty), sensitive],
    ]),
    build('build_ai', [
      ['base', tenths(O.build_ai.base), true],
      ['share of language or judgement work', sharePoints(O.build_ai.aiShare, s.ai, s.total), s.ai > 0],
      ['an engineering team', tenths(O.build_ai.engineeringTeam), i.org.engineers >= 2],
      ['machine-learning experience', tenths(O.build_ai.mlExperience), i.org.hasMlExperience],
      ['high volume', tenths(O.build_ai.strongVolume), freq !== null && freq >= T.buildVolumeStrongPerMonth],
      ['some volume', tenths(O.build_ai.someVolume), freq !== null && freq >= T.buildVolumeFloorPerMonth && freq < T.buildVolumeStrongPerMonth],
      ['several systems to connect', tenths(O.build_ai.manyIntegrations), integrations >= T.manyIntegrations],
      ['data must stay local', tenths(O.build_ai.localOrOnPrem), localOnly],
      ['short timeline', tenths(O.build_ai.shortTimelinePenalty), c.timelineWeeks !== null && c.timelineWeeks < T.shortTimelineWeeks],
      ['no technical experience', tenths(O.build_ai.noTechnicalAbilityPenalty), i.technicalAbility === 'none'],
      ['one exact answer', tenths(O.build_ai.exactCorrectnessPenalty), exact],
    ]),
  ];
}

// --- AI suitability --------------------------------------------------------

function aiSuitability(i: DecisionIntake, s: Shares, hours: number | null, sensitiveCount: number): DecisionResult['aiSuitability'] {
  const S = RULES.suitability;
  const w = S.weights;
  const unknown = S.scores.unknown;
  const freq = i.frequencyPerMonth;
  const mins = i.minutesPerOccurrence;
  const dims: SuitabilityDimension[] = [
    {
      key: 'taskFit', weight: w.taskFit, known: true,
      score: roundHalfUp((100 * s.ai) / s.total),
      reasoning: s.ai === 0
        ? 'None of the work is language or judgement.'
        : s.ai === s.total ? 'All of the work is language or judgement, the shape models handle well.'
          : `${s.ai} of ${s.total} kinds of work need language or judgement; the rest has a computable answer.`,
    },
    {
      key: 'correctness', weight: w.correctness, known: true,
      score: S.scores.correctness[i.correctness],
      reasoning: i.correctness === 'exact' ? 'One exact answer: models do not promise that.' : 'A range of answers is acceptable.',
    },
    {
      key: 'errorImpact', weight: w.errorImpact, known: true,
      score: S.scores.errorImpact[i.errorImpact],
      reasoning: `A wrong answer has ${i.errorImpact} impact.`,
    },
    {
      key: 'data', weight: w.data, known: true,
      score: Math.max(0, S.scores.dataBase - S.scores.dataPerSensitiveClass * sensitiveCount),
      reasoning: sensitiveCount === 0 ? 'No sensitive data classes.' : `${sensitiveCount} sensitive data class${sensitiveCount === 1 ? '' : 'es'} in scope.`,
    },
    {
      key: 'volume', weight: w.volume, known: freq !== null,
      score: freq === null ? unknown : stepScore(freq, S.scores.volume),
      reasoning: freq === null ? 'How often this happens was not given.' : `${freq} times a month.`,
    },
    {
      key: 'value', weight: w.value, known: mins !== null,
      score: mins === null ? unknown : stepScore(mins, S.scores.value),
      reasoning: mins === null ? 'Minutes each time were not given.'
        : hours === null ? `${mins} minutes each time.` : `${mins} minutes each time, about ${round1(hours)} hours a month.`,
    },
  ];
  // Weighted mean in integer percent weights, rounded half-up.
  const weighted = dims.reduce((sum, d) => sum + d.score * Math.round(d.weight * 100), 0);
  const score = Math.floor((weighted + 50) / 100);
  return { score, band: bandFor(score, S.bands, 'band'), dimensions: dims };
}

export function round1(x: number): number {
  return roundHalfUp(x * 10) / 10;
}

// --- Costs -------------------------------------------------------------------

function costs(i: DecisionIntake, outcome: Outcome, hours: number | null): DecisionResult['costs'] {
  const effort = RULES.effortHours[i.surface][outcome];
  const rate = i.hourlyValueUsd;
  const lines: CostLine[] = [];
  const rulesSource = `${RULES_VERSION} effort ranges (rule of thumb, not a quote)`;

  if (hours !== null) {
    lines.push({ id: 'time_today', label: 'Time spent today', low: round1(hours), high: round1(hours), unit: 'hours', period: 'month', basis: 'user_input', source: 'Your frequency × minutes per occurrence' });
    if (rate !== null) {
      lines.push({ id: 'time_today_value', label: 'Value of that time', low: round1(hours * rate), high: round1(hours * rate), unit: 'usd', period: 'month', basis: 'user_input', source: 'Your hours × your hourly value' });
    }
  }
  lines.push({ id: 'setup_effort', label: 'Setup effort', low: effort.setup[0], high: effort.setup[1], unit: 'hours', period: 'one_time', basis: 'heuristic', source: rulesSource });
  lines.push({ id: 'upkeep_effort', label: 'Upkeep effort', low: effort.monthly[0], high: effort.monthly[1], unit: 'hours', period: 'month', basis: 'heuristic', source: rulesSource });
  if (rate !== null) {
    lines.push({ id: 'setup_cost', label: 'Setup effort at your hourly value', low: round1(effort.setup[0] * rate), high: round1(effort.setup[1] * rate), unit: 'usd', period: 'one_time', basis: 'heuristic', source: `${rulesSource} × your hourly value` });
  }
  if (outcome === 'buy_ai') {
    lines.push({ id: 'subscription', label: 'Tool subscription', low: null, high: null, unit: 'usd', period: 'month', basis: 'heuristic', source: 'Not recorded in the AI Fit registry. Check each vendor\'s current pricing page; free tiers have usage limits.' });
  }
  if (outcome === 'conventional_software') {
    lines.push({ id: 'license', label: 'Software licence', low: null, high: null, unit: 'usd', period: 'month', basis: 'heuristic', source: 'Depends on the product you choose; not estimated here.' });
  }
  if (outcome === 'build_ai') {
    const run = i.externalEstimates.runCostPerMonthUsd;
    lines.push(run
      ? { id: 'run_cost', label: 'Model run cost', low: run.low, high: run.high, unit: 'usd', period: 'month', basis: run.basis === 'heuristic' ? 'catalog' : run.basis, source: run.source }
      : { id: 'run_cost', label: 'Model run cost', low: null, high: null, unit: 'usd', period: 'month', basis: 'heuristic', source: 'Not estimated: depends on the model and volume. AI Fit Teams prices this from its dated model catalog.' });
  }
  const uncertainty: DecisionResult['costs']['uncertainty'] = hours === null ? 'high' : 'medium';
  return { lines, hoursSavedPerMonth: hours === null ? null : round1(hours), uncertainty };
}

// --- Risk and feasibility -----------------------------------------------------

function risk(i: DecisionIntake, sensitiveCount: number, highlyRegulated: boolean): DecisionResult['risk'] {
  const R = RULES.risk;
  const c = i.constraints;
  const factors: string[] = [];
  let score = 0;
  if (sensitiveCount > 0) { score += R.perSensitiveClass * sensitiveCount; factors.push(`${sensitiveCount} sensitive data class${sensitiveCount === 1 ? '' : 'es'}`); }
  if (highlyRegulated) { score += R.highlyRegulated; factors.push('highly regulated data (health, card, government ID or minors)'); }
  if (c.regulated.length > 0) { score += R.regulation * c.regulated.length; factors.push(`regulations in scope: ${c.regulated.join(', ')}`); }
  score += R.errorImpact[i.errorImpact];
  if (R.errorImpact[i.errorImpact] > 0) factors.push(`${i.errorImpact} impact when wrong`);
  score += R.autonomy[c.autonomy];
  if (R.autonomy[c.autonomy] > 0) factors.push(`autonomy: ${c.autonomy}`);
  if (c.irreversibleActions) { score += R.irreversibleActions; factors.push('irreversible actions'); }
  score = Math.min(100, score);
  return { level: bandFor(score, R.levels, 'level') as DecisionResult['risk']['level'], score, factors };
}

function feasibility(i: DecisionIntake, outcome: Outcome, sensitive: boolean): DecisionResult['feasibility'] {
  const factors: { level: 'low' | 'medium'; text: string }[] = [];
  const effort = RULES.effortHours[i.surface][outcome];
  const weeks = i.constraints.timelineWeeks;
  if (weeks !== null && effort.setup[1] > 0) {
    const perWeek = i.surface === 'teams' ? T.builderHoursPerWeek * Math.max(1, i.org.engineers) : T.consumerHoursPerWeek;
    const capacity = perWeek * weeks;
    if (effort.setup[0] > capacity) factors.push({ level: 'low', text: `Even the low end of the setup effort (${effort.setup[0]} h) exceeds the time available in ${weeks} weeks (about ${capacity} h).` });
    else if (effort.setup[1] > capacity) factors.push({ level: 'medium', text: `The high end of the setup effort (${effort.setup[1]} h) exceeds the time available in ${weeks} weeks (about ${capacity} h).` });
  }
  const once = i.constraints.oneTimeBudgetUsd;
  if (once !== null && i.hourlyValueUsd !== null && effort.setup[0] * i.hourlyValueUsd > once) {
    factors.push({ level: 'low', text: 'The low end of the setup effort, at your hourly value, is more than your one-time budget.' });
  }
  if (outcome === 'build_ai' && !i.org.hasMlExperience) factors.push({ level: 'medium', text: 'Nobody on the team has shipped a model-backed system before; budget time for evaluation work.' });
  if (i.surface === 'teams' && sensitive && !i.org.hasSecurityReview && outcome !== 'no_change') {
    factors.push({ level: 'medium', text: 'Sensitive data is in scope and there is no security review process.' });
  }
  const level: DecisionResult['feasibility']['level'] = factors.some((f) => f.level === 'low') ? 'low'
    : factors.some((f) => f.level === 'medium') ? 'medium' : 'high';
  return { level, factors: factors.map((f) => f.text) };
}

// --- Inputs, contradictions, explanation --------------------------------------

function missing(i: DecisionIntake): string[] {
  const out: string[] = [];
  if (i.frequencyPerMonth === null) out.push('frequencyPerMonth');
  if (i.minutesPerOccurrence === null) out.push('minutesPerOccurrence');
  if (i.surface === 'teams') {
    if (i.constraints.monthlyBudgetUsd === null) out.push('monthlyBudgetUsd');
    if (i.constraints.timelineWeeks === null) out.push('timelineWeeks');
  }
  if (i.hourlyValueUsd === null) out.push('hourlyValueUsd');
  return out;
}

export function findContradictions(i: DecisionIntake, s: Shares): { id: string; detail: string }[] {
  const out: { id: string; detail: string }[] = [];
  const c = i.constraints;
  if (i.frequencyPerMonth === 0) out.push({ id: 'zero_frequency', detail: 'You said this happens zero times a month. If it never happens, there is nothing to change.' });
  if (i.correctness === 'exact' && s.ai === s.total && i.workTypes.some((w) => w === 'generate' || w === 'converse')) {
    out.push({ id: 'exact_generative', detail: 'The work is open-ended writing or conversation, but you said there is one exact right answer. Those rarely go together; check which is true.' });
  }
  if (i.errorImpact === 'critical' && c.autonomy === 'full') {
    out.push({ id: 'critical_full_autonomy', detail: 'A wrong answer is critical, yet you asked for full autonomy. Pick one: accept a review step, or accept the risk.' });
  }
  if (i.org.size === 'solo' && i.org.engineers > 1) {
    out.push({ id: 'solo_with_engineers', detail: 'You described a one-person setup with more than one engineer.' });
  }
  if (c.irreversibleActions && !i.workTypes.some((w) => w === 'act' || w === 'transfer')) {
    out.push({ id: 'irreversible_without_action', detail: 'You flagged irreversible actions, but none of the work you selected takes an action or moves data.' });
  }
  return out;
}

const LEVERS: Record<Outcome, string> = {
  no_change: 'If the time involved were under 30 minutes a month, or today\'s approach already works, leaving it alone would win.',
  conventional_software: 'If the work had one computable right answer (records, lookups, arithmetic), ordinary software would win.',
  conventional_automation: 'If the work were mostly moving data between systems on a schedule, rules-based automation would win.',
  buy_ai: 'A tolerant definition of correct, a short timeline, or no engineering capacity favours buying an AI tool.',
  build_ai: 'Higher volume (1,000+ a month), two or more engineers, or several systems to connect favour building.',
};

function whatWouldChange(runnerUp: Outcome | null, scores: OutcomeScore[]): string[] {
  const out: string[] = [];
  if (runnerUp) out.push(`Runner-up: ${OUTCOME_LABEL[runnerUp]}. ${LEVERS[runnerUp]}`);
  for (const o of scores) {
    if (!o.eligible) out.push(`${OUTCOME_LABEL[o.outcome]} was ruled out by ${o.excludedBy.join(', ')}.`);
  }
  return out;
}

export function toolCategories(workTypes: readonly WorkType[], localOnly: boolean): string[] {
  const set = new Set<string>();
  for (const w of workTypes) for (const c of (RULES.toolCategories as Record<string, readonly string[]>)[w] ?? []) set.add(c);
  if (localOnly) for (const c of RULES.localCategories) set.add(c);
  return Array.from(set).sort();
}

export const OUTCOME_LABEL: Record<Outcome, string> = {
  no_change: 'No change',
  conventional_software: 'Conventional software',
  conventional_automation: 'Conventional automation',
  buy_ai: 'Buy an AI tool',
  build_ai: 'Build an AI system',
};

const SUMMARY: Record<Outcome, string> = {
  no_change: 'Leave this as it is. The time involved, or how well today\'s approach works, does not justify a change.',
  conventional_software: 'Use ordinary software. The work has computable answers, so a database, spreadsheet or app does it correctly every time.',
  conventional_automation: 'Automate it with rules. The work is repetitive and mostly moves data or triggers actions, which rules handle reliably and cheaply.',
  buy_ai: 'Buy an AI tool. The work needs language or judgement, and an off-the-shelf tool is the fastest, cheapest way to find out if AI helps.',
  build_ai: 'Build an AI system. The volume, integrations or constraints justify custom engineering, provided you measure it from day one.',
};

const ASSUMPTIONS = [
  'Effort ranges are rules of thumb from the published decision rules, not quotes.',
  'Hours saved assume the change removes the whole task; real savings are usually lower.',
  'Tool eligibility uses the AI Fit registry as last reviewed; vendors change plans and features.',
  'Scores combine your structured answers only. Free-text descriptions are shown back to you but never scored.',
];

const LIMITATIONS = [
  'Does not verify any vendor\'s security, privacy or compliance claims.',
  'Does not know your existing contracts, tools or procurement rules.',
  'Scores are normalised comparisons between the five options, not probabilities of success.',
  'Not validated against measured outcomes yet.',
];
