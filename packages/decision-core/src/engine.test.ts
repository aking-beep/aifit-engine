import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, OUTCOME_LABEL } from './engine.js';
import { canonicalJson, canonicalNumber } from './canonical.js';
import { DecisionIntake, Outcome } from './schema.js';
import { computeGolden, loadFixtures } from './golden.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FIXTURE_DIR } from './golden.js';

const fixtures = loadFixtures();

describe('representative workloads', () => {
  test('there are at least 10 fixtures and every outcome appears', () => {
    assert.ok(fixtures.length >= 10);
    const seen = new Set(fixtures.map((f) => f.expect.outcome));
    for (const o of Outcome.options) assert.ok(seen.has(o), `no fixture decides ${o}`);
  });

  for (const f of fixtures) {
    test(f.id, () => {
      const r = decide(f.intake);
      assert.equal(r.outcome, f.expect.outcome, f.title);
      assert.deepEqual(r.hardConstraints.filter((h) => h.triggered).map((h) => h.id), f.expect.triggered);
      for (const c of f.expect.contradictions ?? []) assert.ok(r.contradictions.some((x) => x.id === c), `missing contradiction ${c}`);
      if (f.expect.missing) assert.deepEqual(r.missingInputs, f.expect.missing);
      if (f.expect.confidence) assert.equal(r.confidence, f.expect.confidence);
    });
  }

  test('golden.json is current (regenerate with npm run golden after an intended change)', () => {
    const onDisk = JSON.parse(readFileSync(resolve(FIXTURE_DIR, 'golden.json'), 'utf8'));
    assert.deepEqual(computeGolden(), onDisk);
  });
});

describe('invariants on every result', () => {
  for (const f of fixtures) {
    test(`${f.id}: the chosen outcome is eligible, and the result states its basis`, () => {
      const r = decide(f.intake);
      const chosen = r.outcomeScores.find((o) => o.outcome === r.outcome)!;
      assert.equal(chosen.eligible, true);
      for (const o of r.outcomeScores) if (o.eligible) assert.ok(o.score <= chosen.score);
      assert.equal(r.validation.status, 'not_validated');
      assert.ok(r.assumptions.length > 0 && r.limitations.length > 0);
      assert.ok(r.hardConstraints.every((h) => h.authority === 'deterministic-rule'));
      assert.equal(r.engine.name, 'aifit-decision');
      assert.match(r.engine.inputHash, /^[0-9a-f]{64}$/);
      if (r.outcome === 'buy_ai' || r.outcome === 'build_ai') assert.ok(r.requiredControls.length >= 2);
      for (const l of r.costs.lines) {
        if (l.low !== null && l.high !== null) assert.ok(l.low <= l.high, `${l.id} low > high`);
        assert.ok(l.source.length > 0);
      }
      assert.ok(OUTCOME_LABEL[r.outcome]);
    });
  }
});

describe('reproducibility', () => {
  test('same input, same result', () => {
    const f = fixtures[6]!;
    assert.deepEqual(decide(f.intake), decide(f.intake));
  });

  test('order of list inputs does not change the hash or the result', () => {
    const a = decide({ workTypes: ['summarize', 'classify'], constraints: { dataClasses: ['pii', 'internal'], integrations: ['Zendesk', 'slack'] } });
    const b = decide({ workTypes: ['classify', 'summarize', 'classify'], constraints: { dataClasses: ['internal', 'pii'], integrations: ['Slack', 'zendesk'] } });
    assert.equal(a.engine.inputHash, b.engine.inputHash);
    assert.deepEqual(a, b);
  });

  test('a parsed intake always carries every key, so both languages hash the same shape', () => {
    const parsed = DecisionIntake.parse({ workTypes: ['generate'] });
    assert.equal(canonicalJson(parsed),
      '{"constraints":{"autonomy":"suggest","dataClasses":["internal"],"dataResidency":"any","integrations":[],"irreversibleActions":false,"localOnly":false,"monthlyBudgetUsd":null,"offTheShelfAcceptable":true,"oneTimeBudgetUsd":null,"regulated":[],"timelineWeeks":null},"correctness":"tolerant","currentApproach":"manual","currentWorksWell":false,"errorImpact":"medium","externalEstimates":{"runCostPerMonthUsd":null},"frequencyPerMonth":null,"goal":"","hourlyValueUsd":null,"minutesPerOccurrence":null,"org":{"engineers":0,"hasMlExperience":false,"hasSecurityReview":false,"size":"solo"},"role":"individual","schemaVersion":"1","surface":"consumer","technicalAbility":"basic","workTypes":["generate"]}');
  });

  test('canonical numbers avoid exponent and float/int differences', () => {
    assert.equal(canonicalNumber(1), '1');
    assert.equal(canonicalNumber(1.0), '1');
    assert.equal(canonicalNumber(0.1), '0.1');
    assert.equal(canonicalNumber(0.000001), '0.000001');
    assert.equal(canonicalNumber(2.5000004), '2.5');
    assert.equal(canonicalNumber(62.125), '62.125');
    assert.throws(() => canonicalNumber(Number.NaN));
  });
});

describe('input validation', () => {
  const bad: [string, unknown][] = [
    ['no work types', { workTypes: [] }],
    ['unknown work type', { workTypes: ['teleport'] }],
    ['negative frequency', { workTypes: ['generate'], frequencyPerMonth: -1 }],
    ['oversized goal', { workTypes: ['generate'], goal: 'x'.repeat(2001) }],
    ['unknown enum', { workTypes: ['generate'], correctness: 'perfect' }],
    ['too many integrations', { workTypes: ['transfer'], constraints: { integrations: Array.from({ length: 21 }, (_, n) => `s${n}`) } }],
    ['fractional engineers', { workTypes: ['generate'], org: { engineers: 1.5 } }],
    ['not an object', 'build me an AI'],
  ];
  for (const [name, input] of bad) {
    test(`rejects ${name}`, () => assert.throws(() => decide(input)));
  }
});

describe('costs', () => {
  test('hours and dollars come only from what the person supplied', () => {
    const r = decide({ workTypes: ['generate'], frequencyPerMonth: 20, minutesPerOccurrence: 30, hourlyValueUsd: 50 });
    assert.equal(r.costs.hoursSavedPerMonth, 10);
    const value = r.costs.lines.find((l) => l.id === 'time_today_value')!;
    assert.equal(value.low, 500);
    assert.equal(value.basis, 'user_input');
    const sub = r.costs.lines.find((l) => l.id === 'subscription')!;
    assert.equal(sub.low, null, 'subscription prices are not in the registry, so none is invented');
  });

  test('without a rate there are no dollar figures at all', () => {
    const r = decide({ workTypes: ['generate'], frequencyPerMonth: 20, minutesPerOccurrence: 30 });
    assert.ok(r.costs.lines.every((l) => l.unit === 'hours' || l.low === null));
  });

  test('unknown frequency makes the cost uncertainty high', () => {
    assert.equal(decide({ workTypes: ['generate'] }).costs.uncertainty, 'high');
  });

  test('build run cost is passed through from the caller, with its basis', () => {
    const f = fixtures.find((x) => x.id === 'teams-support-triage')!;
    const r = decide({ ...(f.intake as object), externalEstimates: { runCostPerMonthUsd: { low: 40, high: 90, basis: 'heuristic', source: 'catalog 2026-09-14' } } });
    const run = r.costs.lines.find((l) => l.id === 'run_cost')!;
    assert.deepEqual([run.low, run.high, run.basis], [40, 90, 'catalog']);
  });
});
