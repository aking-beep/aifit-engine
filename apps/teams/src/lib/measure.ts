import { assess, Workload, type Estimate, type Verdict } from '@aifit/teams-core';
// Type-only: erased under --experimental-strip-types, so no extension needed.
import type { RateLimiter } from './request-guard';

/**
 * Measure mode: one synthetic sample for a workload, run on a model and
 * reported to ARK Control as a trace.
 *
 * In ark this called `@ark/runtime`, which ran the sample and then POSTed it
 * to `${ARK_CONTROL_URL}/api/v1/events`. That is a second wire to Control,
 * next to the calibration read, and it pulls in Runtime, the SDK, the
 * providers and the evals. The aifit-engine build of AI Fit Teams does not
 * carry Runtime, so it does not carry that wire either: `BUNDLED_EXECUTOR` is
 * null, measuring reads as disabled whatever `ARK_MEASURE_ENABLED` says, and
 * the only call this app makes to Control is `GET /api/v1/calibration`.
 *
 * The gate, the sample namespace, the prompt and the timeout are kept, and
 * tested, against a `SampleExecutor` interface. Re-enabling measure mode is
 * supplying an executor (a published `@ark/runtime`, wired explicitly) and
 * setting `BUNDLED_EXECUTOR`; nothing else here has to change.
 */

/** Keep in sync with `measure-timeout.ts` (client-safe copy). */
export const MEASURE_TIMEOUT_MS = 15_000;

/** Every sample lands in this workload namespace so it can never overwrite a real workload's traces. */
export const SAMPLE_WORKLOAD_PREFIX = 'teams_sample_';

/** The request a sample executor is handed. Field for field, Runtime's `RuntimeRequest`. */
export interface SampleRequest {
  workloadId: string;
  application: string;
  model?: string;
  maxTokens: number;
  maxFallbacks: number;
  constraints: { privacy: 'local-only' | 'any'; maxCostUsd: number };
  messages: { role: 'user'; content: string }[];
}

/** What a sample run reports. The subset of Runtime's `RuntimeResult` the route returns. */
export interface SampleRun {
  modelId: string;
  adapterId: string;
  latencyMs: number;
  cost: Estimate<number>;
  /** Whether the trace was sent to Control, and whether Control accepted it. */
  telemetry: { attempted: boolean; ok: boolean };
  routing: { selected: string | null; rationale: string[] };
}

/** How an executor reports a failure, so the route can map it without knowing the executor. */
export class SampleError extends Error {
  readonly kind: 'aborted' | 'no_provider' | 'failed';
  constructor(kind: 'aborted' | 'no_provider' | 'failed', message: string) {
    super(message);
    this.name = 'SampleError';
    this.kind = kind;
  }
}

/**
 * Runs one sample and reports it to Control. It must stop the provider call
 * and send nothing when `signal` aborts.
 */
export type SampleExecutor = (
  req: SampleRequest,
  opts: { signal: AbortSignal; env: NodeJS.Dict<string> },
) => Promise<SampleRun>;

/** None in this build. See the header comment. */
export const BUNDLED_EXECUTOR: SampleExecutor | null = null;

export type MeasureFailureReason = 'not-ai' | 'timeout' | 'no_provider' | 'execution_failed';

export type MeasureResult =
  | { ok: true; result: SampleRun; verdict: Verdict }
  | { ok: false; reason: MeasureFailureReason; message: string; verdict?: Verdict };

/**
 * Fixed caller-facing copy. Provider and Control error bodies stay on the
 * server (logged), never in the response.
 */
export const MEASURE_MESSAGES: Record<Exclude<MeasureFailureReason, 'not-ai'>, string> = {
  no_provider: 'No eligible provider is configured for this sample (see the operator env vars).',
  execution_failed: 'The sample run failed. The operator can find the provider error in the server log.',
  timeout: `The sample did not finish within ${MEASURE_TIMEOUT_MS / 1000}s and was cancelled.`,
};

/** The operator asked for measuring. It also needs an executor in the build. */
export function measureRequested(env: NodeJS.Dict<string> = process.env): boolean {
  return env.ARK_MEASURE_ENABLED?.trim() === '1';
}

/**
 * `/api/measure` is off unless the operator turns it on (it spends model
 * tokens) and the build carries an executor. This build carries none.
 */
export function measureEnabled(
  env: NodeJS.Dict<string> = process.env,
  executor: SampleExecutor | null = BUNDLED_EXECUTOR,
): boolean {
  return measureRequested(env) && executor !== null;
}

export interface GateRefusal {
  status: 404 | 429;
  body: { ok: false; reason: 'disabled' | 'rate_limited'; message: string };
  headers: Record<string, string>;
}

/**
 * Checks that run before a body is read or a model is touched: the feature
 * flag (C6) and the per-client rate limit. null = proceed.
 */
export function measureGate(
  clientKey: string,
  limiter: RateLimiter,
  env: NodeJS.Dict<string> = process.env,
  globalLimiter?: RateLimiter,
  executor: SampleExecutor | null = BUNDLED_EXECUTOR,
): GateRefusal | null {
  if (!measureEnabled(env, executor)) {
    return {
      status: 404,
      body: {
        ok: false,
        reason: 'disabled',
        message: executor
          ? 'Measuring is disabled on this deployment (ARK_MEASURE_ENABLED=1 enables it).'
          : 'Measuring is not part of this build: it carries no ARK Runtime, so it sends nothing to ARK Control but the calibration read.',
      },
      headers: { 'cache-control': 'no-store' },
    };
  }
  // The global ceiling caps spend even when a caller rotates its address.
  // Only a call the client's own bucket admits counts against the global one, so
  // a client hammering past its 429s does not use up everyone else's slots.
  const own = limiter.take(clientKey);
  const retryMs = own > 0 ? own : globalLimiter?.take('*') ?? 0;
  if (retryMs > 0) {
    return {
      status: 429,
      body: { ok: false, reason: 'rate_limited', message: 'Too many samples. Try again in a minute.' },
      headers: { 'cache-control': 'no-store', 'retry-after': String(Math.ceil(retryMs / 1000)) },
    };
  }
  return null;
}

/** Map any client-supplied id into the sample namespace, with a safe charset and length. */
export function sampleWorkloadId(id: string): string {
  const safe = id.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 128 - SAMPLE_WORKLOAD_PREFIX.length);
  const bare = safe.startsWith(SAMPLE_WORKLOAD_PREFIX) ? safe.slice(SAMPLE_WORKLOAD_PREFIX.length) : safe;
  return `${SAMPLE_WORKLOAD_PREFIX}${bare || 'unnamed'}`;
}

/**
 * Operator-configured Ollama tag for a synthetic sample.
 * Catalog estimate ids (`local-70b`) are cost rows, not installed tags — never
 * pass those as the sample model.
 */
export function sampleModelId(env: NodeJS.Dict<string> = process.env): string | undefined {
  const configured = env.ARK_OLLAMA_MODEL?.trim();
  return configured || undefined;
}

/**
 * One synthetic request for a teams workload. The prompt carries the id and
 * task shapes so Control can attribute the sample — never the free-text
 * description, which is where PII would live if it lived anywhere.
 */
export function sampleRequestFor(workload: Workload, model?: string): SampleRequest {
  const privacy = workload.dataResidency === 'on_prem' ? 'local-only' : 'any';
  const workloadId = sampleWorkloadId(workload.id);
  return {
    workloadId,
    application: 'my-ai-for-teams',
    ...(model ? { model } : {}),
    maxTokens: 64,
    maxFallbacks: 1,
    constraints: { privacy, maxCostUsd: 0.05 },
    messages: [
      {
        role: 'user',
        content: `Synthetic ARK sample. id=${workloadId}. tasks=${workload.task.join(',')}. Reply OK.`,
      },
    ],
  };
}

export async function measureWorkload(
  workload: Workload,
  executor: SampleExecutor | null = BUNDLED_EXECUTOR,
  timeoutMs = MEASURE_TIMEOUT_MS,
  env: NodeJS.Dict<string> = process.env,
  log: (msg: string) => void = (m) => console.error(m),
): Promise<MeasureResult> {
  const assessment = assess(workload, { depth: 'business' });
  const verdict = assessment.suitability.verdict;
  if (verdict === 'not-ai') {
    return {
      ok: false,
      reason: 'not-ai',
      verdict,
      message: 'This workload was scored not-ai. Measuring it with a model would be the thing the report just refused.',
    };
  }
  if (!executor) {
    return { ok: false, reason: 'no_provider', verdict, message: MEASURE_MESSAGES.no_provider };
  }

  // The timer aborts the run itself, not only the wait: the executor must
  // cancel the provider call and report nothing for a timed-out sample.
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const timedOut = new Promise<MeasureResult>((resolve) => {
    ac.signal.addEventListener(
      'abort',
      () => resolve({ ok: false, reason: 'timeout', verdict, message: MEASURE_MESSAGES.timeout }),
      { once: true },
    );
  });

  const run = (async (): Promise<MeasureResult> => {
    try {
      const result = await executor(sampleRequestFor(workload, sampleModelId(env)), { signal: ac.signal, env });
      return { ok: true, result, verdict };
    } catch (err) {
      if ((err instanceof SampleError && err.kind === 'aborted') || ac.signal.aborted) {
        return { ok: false, reason: 'timeout', verdict, message: MEASURE_MESSAGES.timeout };
      }
      const detail = err instanceof Error ? err.message : String(err);
      log(`[measure] ${workload.id}: ${detail.slice(0, 2000)}`);
      if (err instanceof SampleError && err.kind === 'no_provider') {
        return { ok: false, reason: 'no_provider', verdict, message: MEASURE_MESSAGES.no_provider };
      }
      return { ok: false, reason: 'execution_failed', verdict, message: MEASURE_MESSAGES.execution_failed };
    }
  })();

  try {
    return await Promise.race([run, timedOut]);
  } finally {
    clearTimeout(timer);
  }
}
