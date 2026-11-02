import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CASES } from './workloads.js';
import { runSuite, formatReport } from './report.js';

const suite = runSuite();

test('the library is a real spread of work', () => {
  assert.ok(CASES.length >= 40 && CASES.length <= 60, `${CASES.length} cases`);
  assert.equal(new Set(CASES.map((c) => c.id)).size, CASES.length, 'ids are unique');
  assert.ok(new Set(CASES.map((c) => c.industry)).size >= 15, 'at least 15 industries');
  const expected = new Set(CASES.flatMap((c) => c.expect.verdict));
  for (const v of ['not-ai', 'not-yet', 'assisted', 'automate-bounded', 'automate']) assert.ok(expected.has(v as never), `some case expects ${v}`);
  for (const c of CASES) assert.ok(c.rationale.length > 10, `${c.id} has a rationale`);
});

test('the engine can say no: several cases land on not-ai and not-yet', () => {
  const verdicts = suite.results.map((r) => r.verdict);
  assert.ok(verdicts.filter((v) => v === 'not-ai').length >= 5, 'not-ai at least 5 times');
  assert.ok(verdicts.filter((v) => v === 'not-yet').length >= 5, 'not-yet at least 5 times');
});

for (const r of suite.results) {
  test(`invariants hold: ${r.id}`, () => {
    assert.deepEqual(r.violations, []);
  });
}

test('every miss against the expected answer has been reviewed', () => {
  const unexplained = suite.results.filter((r) => r.misses.length && !r.knownDisagreement);
  assert.deepEqual(unexplained.map((r) => `${r.id}: ${r.misses.join('; ')}`), [], formatReport(suite));
});

test('no recorded disagreement has gone stale', () => {
  const stale = suite.results.filter((r) => !r.misses.length && r.knownDisagreement);
  assert.deepEqual(stale.map((r) => r.id), [], 'the engine now agrees: delete the knownDisagreement note');
});
