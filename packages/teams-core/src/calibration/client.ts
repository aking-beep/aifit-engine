import {
  CALIBRATION_DEFAULT_DAYS,
  CALIBRATION_PATH,
  CALIBRATION_TIMEOUT_MS,
  parseCalibrationResponse,
  type CalibrationSet,
} from '@aifit/calibration-contract';

/**
 * How AI Fit Teams reaches ARK Control.
 *
 * Deliberately a network call rather than a shared database import. The two
 * products must be separable — a customer can buy the assessment without
 * handing over telemetry, and can buy telemetry without ever opening the
 * assessment. The coupling is a documented HTTP contract
 * (`@aifit/calibration-contract`), not a schema.
 *
 * Every failure mode here returns null rather than throwing, because the
 * correct behaviour when calibration is unavailable is to fall back to the
 * rubric and say so — not to fail the assessment.
 */
export async function fetchCalibration(opts: {
  baseUrl?: string | undefined;
  /**
   * Ignored, and kept only so existing callers still compile. Control derives
   * the org from the bearer token; a query parameter naming one was never
   * honoured, and sending it suggested it might be.
   */
  orgId?: string | undefined;
  days?: number | undefined;
  timeoutMs?: number | undefined;
  token?: string | undefined;
  /** Injected in tests. Defaults to the global fetch. */
  fetch?: typeof fetch | undefined;
} = {}): Promise<CalibrationSet | null> {
  const base = opts.baseUrl ?? process.env.ARK_CONTROL_URL;
  if (!base) return null;

  let url: URL;
  try {
    url = new URL(CALIBRATION_PATH, base);
  } catch {
    return null;
  }
  url.searchParams.set('days', String(opts.days ?? CALIBRATION_DEFAULT_DAYS));

  const headers: Record<string, string> = { accept: 'application/json' };
  const token = opts.token ?? process.env.ARK_CONTROL_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;

  const doFetch = opts.fetch ?? globalThis.fetch;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), opts.timeoutMs ?? CALIBRATION_TIMEOUT_MS);
  try {
    const res = await doFetch(url, { signal: ac.signal, headers });
    if (!res.ok) return null;
    return parseCalibrationResponse({ status: res.status, body: await res.json() });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
