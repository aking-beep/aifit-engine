import { CALIBRATION_MIN_SAMPLE, type CalibrationSet, type PatternPrior } from '@aifit/calibration-contract';
import { Pattern } from '../assess/architecture.js';
import { Estimate, estimate, Basis } from '../schema/provenance.js';

/**
 * The feedback loop. This module is why Control is built before MY AI for teams.
 *
 * MY AI for teams ships with rules of thumb for how many turns a pattern takes, how
 * often calls fail, how much context an agent accumulates. Those are guesses.
 * ARC Control observes the same quantities in production and emits a
 * CalibrationSet. MY AI for teams then prefers observed values over its own priors, and
 * re-labels the resulting estimates from `heuristic` to `calibrated` or
 * `measured`.
 *
 * The practical consequence: the assessment product gets more accurate as the
 * telemetry product collects more data, and nothing else in the market has
 * that loop closed. Without it, MY AI for teams is a well-organised opinion.
 */

/**
 * The wire types are not defined here any more. They live in
 * `@aifit/calibration-contract`, a frozen copy of the schema Control builds
 * its response with, so Teams parses against a named contract version rather
 * than whatever this file happens to say.
 */
export { PatternPrior, CalibrationSet, CALIBRATION_MIN_SAMPLE } from '@aifit/calibration-contract';

export interface CallShapePrior {
  turnsPerOutcome: number;
  contextGrowthPerTurn: number;
  failureRate: number;
  retriesPerFailure: number;
  cacheHitRate: number;
  basis: Basis;
  sampleSize?: number;
  source: string;
}

/**
 * Resolve the call shape for a pattern, preferring observation over rubric.
 * `fallback` is the hard-coded prior from architecture.ts.
 */
export function resolveCallShape(
  pattern: Pattern,
  fallback: Omit<CallShapePrior, 'basis' | 'source' | 'sampleSize'>,
  calibration?: CalibrationSet | null,
  minSample = CALIBRATION_MIN_SAMPLE,
): CallShapePrior {
  const observed = calibration?.patterns.find((p) => p.pattern === pattern);

  if (!observed || observed.sampleSize < minSample) {
    return {
      ...fallback,
      basis: 'heuristic',
      source: observed
        ? `ARK rubric — only ${observed.sampleSize} observations for "${pattern}", below the ${minSample} needed to trust them`
        : 'ARK rubric v0.1 — no telemetry for this pattern yet. Connect ARC Control to replace this with measurement.',
    };
  }

  return {
    turnsPerOutcome: observed.turnsPerOutcome,
    contextGrowthPerTurn: observed.contextGrowthPerTurn,
    failureRate: observed.failureRate,
    retriesPerFailure: observed.retriesPerFailure,
    cacheHitRate: observed.cacheHitRate,
    basis: calibration!.basis,
    sampleSize: observed.sampleSize,
    source: `ARC Control, ${calibration!.windowDays}-day window, ${observed.sampleSize.toLocaleString()} outcomes`,
  };
}

/**
 * Promote an estimate's basis when the shape behind it was observed — but never
 * past `calibrated`. A cost figure multiplies the observed call shape by list
 * prices and the intake's assumed token sizes, so even when every turn count
 * came from your own telemetry the figure itself was derived, not observed.
 * Labelling it `measured` would put a guess and a measurement on screen as the
 * same thing.
 */
export function withPriorBasis<T>(e: Estimate<T>, prior: CallShapePrior): Estimate<T> {
  if (prior.basis === 'heuristic') return e;
  const basis = prior.basis === 'measured' ? 'calibrated' : prior.basis;
  const source = prior.basis === 'measured'
    ? `${prior.source}; call shape measured, priced at list rates for the recommended model`
    : prior.source;
  return estimate(e.value, basis, source, {
    low: e.low,
    high: e.high,
    sampleSize: prior.sampleSize,
    asOf: e.asOf,
  });
}

/**
 * Build a CalibrationSet from raw outcome rows. Control calls its own copy of
 * this in aking-beep/ark; Teams keeps this one so its tests can produce sets
 * the way Control does. The response shape both copies agree on is
 * `@aifit/calibration-contract`.
 */
export interface OutcomeRow {
  pattern: string;
  turns: number;
  inputTokensFirstTurn: number;
  inputTokensLastTurn: number;
  succeeded: boolean;
  retries: number;
  cachedInputTokens: number;
  totalInputTokens: number;
  costUsd: number;
}

export function buildCalibration(
  rows: OutcomeRow[],
  opts: { basis: 'measured' | 'calibrated'; windowDays: number; orgId?: string },
): CalibrationSet {
  const byPattern = new Map<string, OutcomeRow[]>();
  for (const r of rows) {
    const list = byPattern.get(r.pattern) ?? [];
    list.push(r);
    byPattern.set(r.pattern, list);
  }

  const patterns: PatternPrior[] = [];
  for (const [pattern, rs] of byPattern) {
    const n = rs.length;
    const successes = rs.filter((r) => r.succeeded);
    const turns = rs.map((r) => r.turns).sort((a, b) => a - b);
    const growth = rs
      .filter((r) => r.turns > 1)
      .map((r) => (r.inputTokensLastTurn - r.inputTokensFirstTurn) / (r.turns - 1));

    patterns.push({
      pattern,
      turnsPerOutcome: mean(rs.map((r) => r.turns)),
      contextGrowthPerTurn: growth.length ? mean(growth) : 0,
      // Fraction of *units of work* that failed, and the retries those failed
      // units burned beyond their first attempt — exactly the f and r that
      // `attemptsPerSuccess` in economics/tokens.ts expects.
      failureRate: n ? (n - successes.length) / n : 0,
      retriesPerFailure: (() => {
        const failed = rs.filter((r) => !r.succeeded);
        return failed.length ? mean(failed.map((r) => r.retries)) : 0;
      })(),
      cacheHitRate: (() => {
        const tot = sum(rs.map((r) => r.totalInputTokens));
        return tot ? sum(rs.map((r) => r.cachedInputTokens)) / tot : 0;
      })(),
      costPerOutcomeUsd: successes.length ? sum(rs.map((r) => r.costUsd)) / successes.length : undefined,
      sampleSize: n,
      p95TurnsPerOutcome: turns.length ? turns[Math.min(turns.length - 1, Math.floor(turns.length * 0.95))] : undefined,
    });
  }

  return {
    basis: opts.basis,
    generatedAt: new Date().toISOString(),
    windowDays: opts.windowDays,
    orgId: opts.orgId,
    patterns,
  };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);
