import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// The parts of ark's packages/core/src/review-fixes.test.ts that cover code
// Teams vendored. The ingest, assurance, discovery and policy cases stay in
// ark with the modules they test.
import { attemptsPerSuccess, costPerSuccessfulOutcome, costPerAttempt } from './economics/tokens.js';
import { byId } from './models/catalog.js';
import { weakestBasis, isUncalibrated } from './schema/provenance.js';
import { fetchCalibration } from './calibration/client.js';

describe('cost per successful outcome counts the failed attempt', () => {
  test('with no retries it is the geometric 1/(1-f)', () => {
    assert.ok(Math.abs(attemptsPerSuccess(0.5, 0) - 2) < 1e-12);
    assert.ok(Math.abs(attemptsPerSuccess(0.2) - 1.25) < 1e-12);
  });

  test('each failure costs the failed attempt plus its retries', () => {
    // f=0.5: one failure per success on average, costing 1 + 2 attempts.
    assert.ok(Math.abs(attemptsPerSuccess(0.5, 2) - 4) < 1e-12);
  });

  test('failure rate is clamped to 0.95 so the cost stays finite', () => {
    assert.ok(Number.isFinite(attemptsPerSuccess(1, 0)));
    assert.equal(attemptsPerSuccess(1, 0), attemptsPerSuccess(0.95, 0));
    assert.equal(attemptsPerSuccess(-1, 3), 1);
  });

  test('costPerSuccessfulOutcome applies it', () => {
    const m = byId('claude-sonnet-5')!;
    const shape = { inputTokens: 1000, outputTokens: 300, failureRate: 0.5, retriesPerFailure: 2 };
    assert.ok(Math.abs(costPerSuccessfulOutcome(m, shape) - 4 * costPerAttempt(m, shape)) < 1e-12);
  });
});

describe('provenance of nothing', () => {
  test('weakestBasis([]) is heuristic, agreeing with isUncalibrated([])', () => {
    assert.equal(weakestBasis([]), 'heuristic');
    assert.equal(isUncalibrated([]), true);
  });
});

describe('calibration client', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test('does not send an org query parameter — the token decides', async () => {
    let seen = '';
    globalThis.fetch = (async (url: string | URL) => {
      seen = String(url);
      return new Response('{}', { status: 404 });
    }) as typeof fetch;
    await fetchCalibration({ baseUrl: 'http://control.test', orgId: 'org_other', days: 7, token: 't' });
    const u = new URL(seen);
    assert.equal(u.searchParams.has('org'), false);
    assert.equal(u.searchParams.get('days'), '7');
  });
});
