import { assess, type Workload } from '@aifit/teams-core';
import { decide, decisionIntakeFromWorkload, ENGINE_VERSION, RULES_VERSION } from '@aifit/decision-core';
import { PlatformError } from '@aifit/platform';
import { decodeWorkload } from '@/lib/encode';

/** Decode `?w=` into a Workload, or refuse. */
export function workloadFrom(encoded: unknown): Workload {
  if (typeof encoded !== 'string' || encoded.length === 0 || encoded.length > 16_000) throw new PlatformError('invalid', 'Missing or oversized assessment link.');
  const w = decodeWorkload(encoded);
  if (!w) throw new PlatformError('invalid', 'That assessment link could not be read.');
  return w;
}

/** What a saved record pins: the verdict, the decision and the engine versions that produced them. */
export function snapshotFor(w: Workload) {
  const a = assess(w, { depth: 'business' });
  const d = decisionFor(a);
  return {
    verdict: a.suitability.verdict,
    outcome: d.outcome,
    pattern: a.architecture.pattern,
    decisionInputHash: d.engine.inputHash,
    engines: { decision: ENGINE_VERSION, decisionRules: RULES_VERSION, suitabilityRubric: 'v0.1' },
  };
}

/** The five-outcome decision for an assessment, with the model run cost passed in from the dated catalog. */
export function decisionFor(a: ReturnType<typeof assess>) {
  const run = a.model ? { low: a.cost.perMonth.low ?? a.cost.perMonth.value, high: a.cost.perMonth.high ?? a.cost.perMonth.value, basis: a.cost.perMonth.basis, source: a.cost.perMonth.source.slice(0, 300) } : null;
  return decide(decisionIntakeFromWorkload(a.workload, run));
}
