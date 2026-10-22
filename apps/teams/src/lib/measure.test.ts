import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { INVOICE_LOOKUP, SUPPORT_TRIAGE, estimate } from '@aifit/teams-core';
import {
  BUNDLED_EXECUTOR,
  MEASURE_TIMEOUT_MS,
  SampleError,
  measureEnabled,
  measureGate,
  measureWorkload,
  sampleModelId,
  sampleRequestFor,
  sampleWorkloadId,
  type SampleExecutor,
  type SampleRequest,
  type SampleRun,
} from './measure.ts';
import { MEASURE_CLIENT_TIMEOUT_MS, MEASURE_TIMEOUT_MS as CLIENT_COPY_MS } from './measure-timeout.ts';
import { RateLimiter, clientIp, readJsonBody } from './request-guard.ts';
import {
  describeClientFailure, describeMeasureFailure, describeTelemetry, measureFailureKind,
} from './measure-errors.ts';

/**
 * In ark these tests drove ARK Runtime with a fake Ollama adapter and a
 * capturing ingest client. This build carries no Runtime, so the same
 * behaviours are pinned against the SampleExecutor seam: what the executor is
 * handed, how its failures map, and that a timeout aborts it and reports
 * nothing.
 */
function run(over: Partial<SampleRun> = {}): SampleRun {
  return {
    modelId: 'llama3.2',
    adapterId: 'ollama',
    latencyMs: 3,
    cost: estimate(0, 'heuristic', 'test'),
    telemetry: { attempted: true, ok: true },
    routing: { selected: 'ollama', rationale: [] },
    ...over,
  };
}

/** An executor that records what it would have posted to Control's /api/v1/events. */
function reporting(posted: SampleRequest[], fn?: SampleExecutor): SampleExecutor {
  return async (req, opts) => {
    const out = fn ? await fn(req, opts) : run({ modelId: req.model ?? 'llama3.2' });
    if (!opts.signal.aborted) posted.push(req);
    return out;
  };
}

describe('sampleRequestFor', () => {
  test('never puts the workload description in the prompt', () => {
    const req = sampleRequestFor(SUPPORT_TRIAGE, 'llama3.2');
    const text = req.messages.map((m) => m.content).join(' ');
    assert.equal(text.includes(SUPPORT_TRIAGE.description), false);
    assert.match(text, /wl_support_triage/);
    assert.match(text, /classify/);
    assert.equal(req.maxTokens, 64);
    assert.equal(req.application, 'my-ai-for-teams');
  });

  test('on-prem residency forces local-only', () => {
    const req = sampleRequestFor({ ...SUPPORT_TRIAGE, dataResidency: 'on_prem' });
    assert.equal(req.constraints.privacy, 'local-only');
  });

  test('omits model when none is passed so the adapter default applies', () => {
    const req = sampleRequestFor(SUPPORT_TRIAGE);
    assert.equal(req.model, undefined);
  });
});

describe('sampleModelId', () => {
  test('reads ARK_OLLAMA_MODEL and ignores empty', () => {
    assert.equal(sampleModelId({ ARK_OLLAMA_MODEL: 'smollm2:135m' }), 'smollm2:135m');
    assert.equal(sampleModelId({ ARK_OLLAMA_MODEL: '  ' }), undefined);
    assert.equal(sampleModelId({}), undefined);
  });
});

describe('measureWorkload', () => {
  test('this build bundles no executor, so the default is no_provider and nothing is sent', async () => {
    assert.equal(BUNDLED_EXECUTOR, null);
    const out = await measureWorkload(SUPPORT_TRIAGE);
    assert.equal(out.ok, false);
    if (!out.ok) assert.equal(out.reason, 'no_provider');
  });

  test('refuses not-ai without calling a provider', async () => {
    let called = 0;
    const out = await measureWorkload(INVOICE_LOOKUP, async () => {
      called++;
      throw new Error('should not run');
    });
    assert.equal(out.ok, false);
    if (!out.ok) {
      assert.equal(out.reason, 'not-ai');
      assert.equal(out.verdict, 'not-ai');
    }
    assert.equal(called, 0);
  });

  test('does not send the catalog estimate id as the sample model', async () => {
    let seen: string | undefined = 'unset';
    const out = await measureWorkload(SUPPORT_TRIAGE, async (req) => {
      seen = req.model;
      return run();
    }, 15_000, {});
    assert.equal(out.ok, true);
    assert.notEqual(seen, 'local-70b');
    assert.equal(seen, undefined);
  });

  test('uses ARK_OLLAMA_MODEL when set', async () => {
    let seen: string | undefined;
    const out = await measureWorkload(SUPPORT_TRIAGE, async (req) => {
      seen = req.model;
      return run();
    }, 15_000, { ARK_OLLAMA_MODEL: 'smollm2:135m' });
    assert.equal(out.ok, true);
    assert.equal(seen, 'smollm2:135m');
  });

  test('runs a support sample and reports it', async () => {
    const posted: SampleRequest[] = [];
    const out = await measureWorkload(SUPPORT_TRIAGE, reporting(posted, async (req) => {
      assert.equal(req.messages.map((m) => m.content).join(' ').includes('40 agents'), false);
      return run();
    }));
    assert.equal(out.ok, true);
    if (out.ok) {
      assert.equal(out.result.telemetry.ok, true);
      assert.equal(out.result.telemetry.attempted, true);
    }
    assert.equal(posted.length, 1);
  });

  test('an executor with no eligible provider is no_provider, not a throw', async () => {
    const out = await measureWorkload(SUPPORT_TRIAGE, async () => {
      throw new SampleError('no_provider', 'no eligible adapter remains after policy');
    }, 15_000, {}, () => {});
    assert.equal(out.ok, false);
    if (!out.ok) assert.equal(out.reason, 'no_provider');
  });

  test('timeout wins over a hung executor', async () => {
    const out = await measureWorkload(
      SUPPORT_TRIAGE,
      () => new Promise((resolve) => setTimeout(() => resolve(run()), 200)),
      30,
    );
    assert.equal(out.ok, false);
    if (!out.ok) assert.equal(out.reason, 'timeout');
  });

  test('timeout aborts the executor and reports nothing', async () => {
    const posted: SampleRequest[] = [];
    let aborted = false;
    const executor = reporting(posted, (_req, opts) =>
      new Promise((resolve, reject) => {
        const late = setTimeout(() => resolve(run()), 200);
        opts.signal.addEventListener('abort', () => {
          aborted = true;
          clearTimeout(late);
          reject(new SampleError('aborted', 'aborted'));
        });
      }),
    );
    const out = await measureWorkload(SUPPORT_TRIAGE, executor, 30);
    assert.equal(out.ok, false);
    if (!out.ok) assert.equal(out.reason, 'timeout');
    // Let any straggling work settle, then confirm nothing was reported.
    await new Promise((r) => setTimeout(r, 250));
    assert.equal(aborted, true);
    assert.equal(posted.length, 0);
  });

  test('provider error text is logged, not returned', async () => {
    const logged: string[] = [];
    const out = await measureWorkload(
      SUPPORT_TRIAGE,
      async () => {
        throw new SampleError('failed', 'ollama HTTP 500: LEAK_SENTINEL internal body');
      },
      15_000,
      {},
      (m) => logged.push(m),
    );
    assert.equal(out.ok, false);
    if (!out.ok) {
      assert.equal(out.reason, 'execution_failed');
      assert.equal(out.message.includes('LEAK_SENTINEL'), false);
    }
    assert.ok(logged.some((m) => m.includes('LEAK_SENTINEL')));
  });

  test('no_provider message does not echo routing internals', async () => {
    const out = await measureWorkload(SUPPORT_TRIAGE, async () => {
      throw new SampleError('no_provider', 'no eligible provider: rationale ollama not configured');
    }, 15_000, {}, () => {});
    assert.equal(out.ok, false);
    if (!out.ok) assert.equal(/rationale|not configured|no eligible provider:/.test(out.message), false);
  });

  test('the reported sample uses the teams_sample_ workload namespace', async () => {
    const posted: SampleRequest[] = [];
    const out = await measureWorkload(SUPPORT_TRIAGE, reporting(posted));
    assert.equal(out.ok, true);
    const json = JSON.stringify(posted);
    assert.match(json, /"workloadId":"teams_sample_wl_support_triage"/);
    assert.equal(/"workloadId":"wl_support_triage"/.test(json), false);
  });
});

describe('sample workload namespace', () => {
  test('forces every id under teams_sample_ with a safe charset and length', () => {
    assert.equal(sampleWorkloadId('wl_support_triage'), 'teams_sample_wl_support_triage');
    assert.equal(sampleWorkloadId('teams_sample_x'), 'teams_sample_x');
    assert.equal(sampleWorkloadId('../evil id'), 'teams_sample_.._evil_id');
    assert.equal(sampleWorkloadId(''), 'teams_sample_unnamed');
    assert.ok(sampleWorkloadId('x'.repeat(500)).length <= 128);
    assert.equal(sampleRequestFor(SUPPORT_TRIAGE).workloadId, 'teams_sample_wl_support_triage');
  });
});

describe('measure gate (C6)', () => {
  const fake: SampleExecutor = async () => run();

  test('disabled unless ARK_MEASURE_ENABLED=1', () => {
    const limiter = new RateLimiter(5, 60_000);
    assert.equal(measureGate('1.2.3.4', limiter, {}, undefined, fake)?.status, 404);
    assert.equal(measureGate('1.2.3.4', limiter, { ARK_MEASURE_ENABLED: 'true' }, undefined, fake)?.status, 404);
    assert.equal(measureGate('1.2.3.4', limiter, { ARK_MEASURE_ENABLED: '1' }, undefined, fake), null);
  });

  test('this build is disabled even with ARK_MEASURE_ENABLED=1, because it carries no executor', () => {
    const limiter = new RateLimiter(5, 60_000);
    const env = { ARK_MEASURE_ENABLED: '1' };
    assert.equal(measureEnabled(env), false);
    const refused = measureGate('1.2.3.4', limiter, env);
    assert.equal(refused?.status, 404);
    assert.equal(refused?.body.reason, 'disabled');
    assert.match(refused!.body.message, /not part of this build/);
  });

  test('rate limits to 5 per minute per client', () => {
    const limiter = new RateLimiter(5, 60_000);
    const env = { ARK_MEASURE_ENABLED: '1' };
    for (let i = 0; i < 5; i++) assert.equal(measureGate('1.2.3.4', limiter, env, undefined, fake), null);
    const refused = measureGate('1.2.3.4', limiter, env, undefined, fake);
    assert.equal(refused?.status, 429);
    assert.ok(Number(refused?.headers['retry-after']) > 0);
    assert.equal(measureGate('5.6.7.8', limiter, env, undefined, fake), null);
  });

  test('a rotating client address cannot escape the global ceiling', () => {
    const limiter = new RateLimiter(5, 60_000);
    const global = new RateLimiter(3, 60_000);
    const env = { ARK_MEASURE_ENABLED: '1' };
    for (let i = 0; i < 3; i++) assert.equal(measureGate(`10.0.0.${i}`, limiter, env, global, fake), null);
    assert.equal(measureGate('10.0.0.99', limiter, env, global, fake)?.status, 429);
  });

  test('rate limiter window resets', () => {
    const limiter = new RateLimiter(1, 1000);
    assert.equal(limiter.take('a', 0), 0);
    assert.ok(limiter.take('a', 10) > 0);
    assert.equal(limiter.take('a', 1000), 0);
  });

  test('client timeout is the server budget plus 5s', () => {
    assert.equal(CLIENT_COPY_MS, MEASURE_TIMEOUT_MS);
    assert.equal(MEASURE_CLIENT_TIMEOUT_MS, MEASURE_TIMEOUT_MS + 5_000);
  });

  test('clientIp takes the right-most forwarded address, not one the client wrote', () => {
    const req = new Request('http://x/', { headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' } });
    assert.equal(clientIp(req), '10.0.0.1');
    assert.equal(clientIp(new Request('http://x/')), 'unknown');
  });
});

describe('readJsonBody', () => {
  test('parses a small JSON body', async () => {
    const out = await readJsonBody(new Request('http://x/', { method: 'POST', body: '{"a":1}' }));
    assert.deepEqual(out, { ok: true, value: { a: 1 } });
  });

  test('refuses a declared content-length over the cap without reading', async () => {
    const req = new Request('http://x/', {
      method: 'POST',
      body: '{}',
      headers: { 'content-length': String(300 * 1024) },
    });
    const out = await readJsonBody(req);
    assert.equal(out.ok, false);
    if (!out.ok) assert.equal(out.status, 413);
  });

  test('cuts off a streamed body over the cap', async () => {
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++;
        controller.enqueue(new Uint8Array(64 * 1024).fill(0x20));
        if (pulled > 100) controller.close();
      },
    });
    const req = new Request('http://x/', { method: 'POST', body: stream, duplex: 'half' } as RequestInit);
    const out = await readJsonBody(req, 256 * 1024);
    assert.equal(out.ok, false);
    if (!out.ok) assert.equal(out.status, 413);
    assert.ok(pulled < 10);
  });

  test('invalid JSON is 400', async () => {
    const out = await readJsonBody(new Request('http://x/', { method: 'POST', body: '{nope' }));
    assert.equal(out.ok, false);
    if (!out.ok) assert.equal(out.status, 400);
  });
});

describe('measure failures in plain language', () => {
  const ADAPTER_DIALECT = /eligible adapter|after policy|PolicyError|runtime execution failed/i;

  test('every API reason maps to a line and an operator step', () => {
    const cases: [string, string][] = [
      ['no_provider', 'no_provider'],
      ['disabled', 'disabled'],
      ['rate_limited', 'rate_limited'],
      ['timeout', 'timeout'],
      ['not-ai', 'not-ai'],
      ['not_ai', 'not-ai'],
      ['unsuitable', 'not-ai'],
      ['execution_failed', 'execution_failed'],
      ['something_new', 'unknown'],
    ];
    for (const [reason, kind] of cases) {
      assert.equal(measureFailureKind(reason), kind, reason);
      const m = describeMeasureFailure(reason);
      assert.ok(m.line.length > 20 && m.recovery.length > 10, reason);
      assert.doesNotMatch(`${m.line} ${m.recovery}`, ADAPTER_DIALECT);
    }
  });

  test('no reason falls back to the HTTP status', () => {
    assert.equal(measureFailureKind(undefined, 429), 'rate_limited');
    assert.equal(measureFailureKind(undefined, 422), 'invalid_workload');
    assert.equal(measureFailureKind(undefined, 504), 'timeout');
    assert.equal(measureFailureKind(undefined, 500), 'unknown');
  });

  test('no_provider tells the operator which env to set', () => {
    assert.match(describeMeasureFailure('no_provider').recovery, /ARK_OLLAMA_MODEL/);
  });

  test('client-side timeout and network failures are covered', () => {
    assert.equal(describeClientFailure('timeout'), describeMeasureFailure('timeout'));
    assert.match(describeClientFailure('network').line, /could not reach/);
  });

  test('telemetry failures are reported even when the sample ran', () => {
    assert.equal(describeTelemetry({ attempted: true, ok: true }), null);
    assert.match(describeTelemetry({ attempted: false, ok: false })!.recovery, /ARK_CONTROL_URL/);
    assert.match(describeTelemetry(undefined)!.line, /not connected/);
    assert.match(describeTelemetry({ attempted: true, ok: false })!.line, /did not accept/);
  });

  test('the real no-provider failure renders without adapter dialect', async () => {
    const out = await measureWorkload(SUPPORT_TRIAGE);
    assert.equal(out.ok, false);
    if (!out.ok) {
      const m = describeMeasureFailure(out.reason);
      assert.doesNotMatch(`${m.line} ${m.recovery}`, ADAPTER_DIALECT);
    }
  });
});
