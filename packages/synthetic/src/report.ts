import { CASES, type SyntheticCase } from './workloads.js';
import { run, invariantViolations, expectationMisses } from './invariants.js';

export interface CaseResult {
  id: string;
  industry: string;
  verdict: string;
  outcome: string;
  violations: string[];
  misses: string[];
  knownDisagreement: string | null;
}

export interface SuiteReport {
  cases: number;
  invariantFailures: number;
  agreed: number;
  /** Misses not yet reviewed: these fail CI. */
  unexplained: number;
  /** Misses reviewed and recorded with a reason. */
  knownDisagreements: number;
  /** Cases marked as a known disagreement that now agree: the note is stale. */
  staleDisagreements: number;
  results: CaseResult[];
}

export function runSuite(cases: readonly SyntheticCase[] = CASES): SuiteReport {
  const results = cases.map((c): CaseResult => {
    const r = run(c.workload);
    return {
      id: c.id,
      industry: c.industry,
      verdict: r.assessment.suitability.verdict,
      outcome: r.decision.outcome,
      violations: invariantViolations(c.workload, r),
      misses: expectationMisses(c, r),
      knownDisagreement: c.knownDisagreement ?? null,
    };
  });
  return {
    cases: results.length,
    invariantFailures: results.filter((r) => r.violations.length).length,
    agreed: results.filter((r) => !r.misses.length).length,
    unexplained: results.filter((r) => r.misses.length && !r.knownDisagreement).length,
    knownDisagreements: results.filter((r) => r.misses.length && r.knownDisagreement).length,
    staleDisagreements: results.filter((r) => !r.misses.length && r.knownDisagreement).length,
    results,
  };
}

export function formatReport(s: SuiteReport): string {
  const lines = [
    `Synthetic workload suite: ${s.cases} cases`,
    `  invariant failures:   ${s.invariantFailures}`,
    `  agreed with expected: ${s.agreed}`,
    `  known disagreements:  ${s.knownDisagreements}`,
    `  unexplained misses:   ${s.unexplained}`,
    '',
  ];
  for (const r of s.results) {
    const mark = r.violations.length ? 'FAIL' : r.misses.length ? (r.knownDisagreement ? 'NOTE' : 'MISS') : 'ok  ';
    lines.push(`${mark} ${r.id.padEnd(22)} ${r.verdict.padEnd(17)} ${r.outcome}`);
    for (const v of r.violations) lines.push(`       invariant: ${v}`);
    for (const m of r.misses) lines.push(`       expected:  ${m}`);
    if (r.misses.length && r.knownDisagreement) lines.push(`       reviewed:  ${r.knownDisagreement}`);
  }
  lines.push('', 'Synthetic data proves the engines are consistent. It does not prove customers agree; that needs real pilots.');
  return lines.join('\n');
}
