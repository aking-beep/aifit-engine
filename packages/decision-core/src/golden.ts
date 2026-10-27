import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide } from './engine.js';
import type { DecisionResult } from './schema.js';

const here = dirname(fileURLToPath(import.meta.url));
export const FIXTURE_DIR = resolve(here, '../fixtures');

export interface Fixture {
  id: string;
  title: string;
  intake: unknown;
  expect: { outcome: string; triggered: string[]; contradictions?: string[]; missing?: string[]; confidence?: string };
}

export function loadFixtures(): Fixture[] {
  return JSON.parse(readFileSync(resolve(FIXTURE_DIR, 'workloads.json'), 'utf8')) as Fixture[];
}

/**
 * The cross-language parity record. Python's test computes the same projection
 * with `aifit.decision` and must match field for field.
 */
export function goldenProjection(r: DecisionResult) {
  return {
    inputHash: r.engine.inputHash,
    rulesVersion: r.engine.rulesVersion,
    outcome: r.outcome,
    runnerUp: r.runnerUp,
    confidence: r.confidence,
    suitability: r.aiSuitability.score,
    suitabilityBand: r.aiSuitability.band,
    outcomeScores: r.outcomeScores.map((o) => ({ outcome: o.outcome, score: o.score, eligible: o.eligible, excludedBy: o.excludedBy })),
    triggered: r.hardConstraints.filter((h) => h.triggered).map((h) => h.id),
    risk: { level: r.risk.level, score: r.risk.score },
    feasibility: r.feasibility.level,
    missingInputs: r.missingInputs,
    contradictions: r.contradictions.map((c) => c.id),
    toolCategories: r.toolRequirements.categories,
    costLines: r.costs.lines.map((l) => ({ id: l.id, low: l.low, high: l.high, unit: l.unit, period: l.period, basis: l.basis })),
    hoursSavedPerMonth: r.costs.hoursSavedPerMonth,
  };
}

export function computeGolden(): Record<string, ReturnType<typeof goldenProjection>> {
  const out: Record<string, ReturnType<typeof goldenProjection>> = {};
  for (const f of loadFixtures()) out[f.id] = goldenProjection(decide(f.intake));
  return out;
}
