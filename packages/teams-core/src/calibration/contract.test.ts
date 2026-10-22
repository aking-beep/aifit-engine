import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { CalibrationResponse } from '@aifit/calibration-contract';
import { fetchCalibration } from './client.js';
import { resolveCallShape } from './priors.js';
import { assess } from '../assess/index.js';
import { CALL_SHAPE } from '../assess/architecture.js';
import { FIXTURES, SUPPORT_TRIAGE } from '../fixtures.js';
import type { Basis } from '../schema/provenance.js';

/**
 * The client and the engine against the contract's fixture responses: the
 * same files Control's side should be tested against.
 */
const require = createRequire(import.meta.url);
const fixture = (name: string): CalibrationResponse =>
  JSON.parse(readFileSync(require.resolve(`@aifit/calibration-contract/fixtures/${name}.json`), 'utf8'));

interface Seen {
  url: URL;
  headers: Record<string, string>;
}

function serve(res: CalibrationResponse, seen: Seen[] = []): typeof fetch {
  return (async (url: string | URL, init?: RequestInit) => {
    seen.push({ url: new URL(String(url)), headers: { ...(init?.headers as Record<string, string>) } });
    return new Response(JSON.stringify(res.body), { status: res.status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}

const BASE = 'http://control.test';

/** Every provenance-bearing value in an assessment, wherever it sits. */
function bases(value: unknown, out: Basis[] = []): Basis[] {
  if (Array.isArray(value)) {
    for (const v of value) bases(v, out);
  } else if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (typeof o.basis === 'string' && 'value' in o && 'source' in o) out.push(o.basis as Basis);
    for (const v of Object.values(o)) bases(v, out);
  }
  return out;
}

describe('fetchCalibration against the contract fixtures', () => {
  test('measured: parses, and promotes cost to calibrated (never measured)', async () => {
    const cal = await fetchCalibration({ baseUrl: BASE, token: 't', fetch: serve(fixture('measured')) });
    assert.equal(cal?.basis, 'measured');
    const a = assess(SUPPORT_TRIAGE, { depth: 'business', calibration: cal });
    assert.equal(a.architecture.pattern, 'bounded-agent');
    assert.equal(a.trust.calibrated, true);
    assert.equal(a.cost.perUnit.basis, 'calibrated');
    assert.equal(a.cost.perUnit.sampleSize, 200);
    assert.equal(bases(a).includes('measured'), false);
  });

  test('calibrated (fleet): parses and labels cost calibrated', async () => {
    const cal = await fetchCalibration({ baseUrl: BASE, token: 't', fetch: serve(fixture('calibrated')) });
    assert.equal(cal?.basis, 'calibrated');
    const a = assess(SUPPORT_TRIAGE, { depth: 'business', calibration: cal });
    assert.equal(a.cost.perUnit.basis, 'calibrated');
    assert.equal(a.cost.perUnit.sampleSize, 90);
  });

  test('below the 30-trace floor: parses, but every figure stays heuristic', async () => {
    const cal = await fetchCalibration({ baseUrl: BASE, token: 't', fetch: serve(fixture('below-floor')) });
    assert.ok(cal);
    const a = assess(SUPPORT_TRIAGE, { depth: 'business', calibration: cal });
    assert.equal(a.trust.calibrated, false);
    assert.equal(a.cost.perUnit.basis, 'heuristic');
    const shape = resolveCallShape('bounded-agent', CALL_SHAPE['bounded-agent'], cal);
    assert.equal(shape.basis, 'heuristic');
    assert.match(shape.source, /only 12 observations/);
  });

  test('401: null, and the report is the heuristic one', async () => {
    const cal = await fetchCalibration({ baseUrl: BASE, fetch: serve(fixture('unauthorized')) });
    assert.equal(cal, null);
    const a = assess(SUPPORT_TRIAGE, { depth: 'business', calibration: cal });
    assert.equal(a.cost.perUnit.basis, 'heuristic');
  });

  test('a 200 that breaks the contract: null, not a partial set', async () => {
    const cal = await fetchCalibration({ baseUrl: BASE, token: 't', fetch: serve(fixture('invalid')) });
    assert.equal(cal, null);
  });
});

describe('the request Teams sends', () => {
  test('GET /api/v1/calibration?days=30 with a bearer token and no org parameter', async () => {
    const seen: Seen[] = [];
    await fetchCalibration({ baseUrl: BASE, orgId: 'org_other', token: 'tok_1', fetch: serve(fixture('measured'), seen) });
    assert.equal(seen.length, 1);
    const { url, headers } = seen[0]!;
    assert.equal(url.origin + url.pathname, `${BASE}/api/v1/calibration`);
    assert.equal(url.searchParams.get('days'), '30');
    assert.equal(url.searchParams.has('org'), false);
    assert.equal(headers.authorization, 'Bearer tok_1');
    assert.equal(headers.accept, 'application/json');
  });

  test('no token, no authorization header', async () => {
    const seen: Seen[] = [];
    const prev = process.env.ARK_CONTROL_TOKEN;
    delete process.env.ARK_CONTROL_TOKEN;
    try {
      await fetchCalibration({ baseUrl: BASE, fetch: serve(fixture('unauthorized'), seen) });
    } finally {
      if (prev !== undefined) process.env.ARK_CONTROL_TOKEN = prev;
    }
    assert.equal('authorization' in seen[0]!.headers, false);
  });
});

describe('Control unreachable', () => {
  test('a hung Control times out to null', async () => {
    const hung = ((_url: URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      })) as unknown as typeof fetch;
    const started = Date.now();
    assert.equal(await fetchCalibration({ baseUrl: BASE, timeoutMs: 30, fetch: hung }), null);
    assert.ok(Date.now() - started < 1000);
  });

  test('a network error is null, not a throw', async () => {
    const down = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    assert.equal(await fetchCalibration({ baseUrl: BASE, fetch: down }), null);
  });

  test('a malformed ARK_CONTROL_URL is null, not a throw', async () => {
    assert.equal(await fetchCalibration({ baseUrl: 'not a url', fetch: serve(fixture('measured')) }), null);
  });

  test('ARK_CONTROL_URL unset: no request, and every figure reads heuristic', async () => {
    const prev = process.env.ARK_CONTROL_URL;
    delete process.env.ARK_CONTROL_URL;
    const seen: Seen[] = [];
    try {
      const cal = await fetchCalibration({ days: 30, fetch: serve(fixture('measured'), seen) });
      assert.equal(cal, null);
      assert.equal(seen.length, 0);
      const a = assess(SUPPORT_TRIAGE, { depth: 'business', calibration: cal });
      assert.equal(a.trust.calibrated, false);
      assert.equal(a.trust.weakestBasis, 'heuristic');
      assert.equal(a.cost.perUnit.basis, 'heuristic');
      assert.equal(a.cost.perMonth.basis, 'heuristic');
      for (const w of FIXTURES) {
        const found = bases(assess(w, { depth: 'business', calibration: cal }));
        assert.ok(found.length > 3, w.id);
        assert.deepEqual(found.filter((b) => b !== 'heuristic'), [], w.id);
      }
    } finally {
      if (prev !== undefined) process.env.ARK_CONTROL_URL = prev;
    }
  });
});
