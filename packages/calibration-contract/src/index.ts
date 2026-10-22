import { z } from 'zod';

/**
 * The calibration contract between AI Fit Teams and ARK Control, frozen.
 *
 * Teams reads `GET ${ARK_CONTROL_URL}/api/v1/calibration?days=30` and Control
 * answers with a `CalibrationSet`. Until this extraction both sides parsed the
 * response with the same `@ark/core` module (`packages/core/src/calibration/
 * priors.ts` in aking-beep/ark at f4f52ce). Now that Teams lives in another
 * repo, this package is the copy Teams parses against. The schemas below are
 * field-for-field the ones in that file; `CALIBRATION_CONTRACT_VERSION` names
 * the snapshot.
 *
 * Changing a field here is a contract change. Make it in ark first (where
 * Control's `buildCalibration` lives), bump the version, and update the
 * fixtures in `fixtures/` so both repos test against the same responses.
 */

/** The ark commit the schema was copied from. */
export const CALIBRATION_CONTRACT_SOURCE = 'aking-beep/ark@f4f52cefdb3050875f41490740d7539169e84a58:packages/core/src/calibration/priors.ts';
export const CALIBRATION_CONTRACT_VERSION = '1.0.0';

/** Path on the Control origin. */
export const CALIBRATION_PATH = '/api/v1/calibration';
/** Window Teams asks for. Control clamps `days` to 1–365. */
export const CALIBRATION_DEFAULT_DAYS = 30;
/** Teams gives up on Control after this long and falls back to the rubric. */
export const CALIBRATION_TIMEOUT_MS = 2500;
/**
 * A pattern with fewer observed outcomes than this is ignored, and its figures
 * stay `heuristic`. Control applies the same floor when it decides between an
 * org's own (`measured`) set and the fleet (`calibrated`) set.
 */
export const CALIBRATION_MIN_SAMPLE = 30;

export const PatternPrior = z.object({
  pattern: z.string(),
  turnsPerOutcome: z.number(),
  contextGrowthPerTurn: z.number(),
  failureRate: z.number(),
  retriesPerFailure: z.number(),
  cacheHitRate: z.number(),
  /** Observed cost per successful outcome, USD. */
  costPerOutcomeUsd: z.number().optional(),
  sampleSize: z.number(),
  /** p50/p95 spread, so Teams can show a range rather than a false point. */
  p95TurnsPerOutcome: z.number().optional(),
});
export type PatternPrior = z.infer<typeof PatternPrior>;

export const CalibrationSet = z.object({
  /** 'measured' when from this org's own data; 'calibrated' when from the fleet. */
  basis: z.enum(['measured', 'calibrated']),
  generatedAt: z.string(),
  windowDays: z.number(),
  orgId: z.string().optional(),
  patterns: z.array(PatternPrior),
  /** Observed build-cost actuals, if the org records delivery effort. */
  buildCostActualsUsd: z.record(z.string(), z.number()).optional(),
});
export type CalibrationSet = z.infer<typeof CalibrationSet>;

/** One HTTP answer from Control, as the fixtures record it. */
export interface CalibrationResponse {
  status: number;
  body: unknown;
}

/**
 * The whole client-side rule in one place: anything but a 200 whose body
 * parses is `null`. Never a partial set, so a response that is half right
 * cannot make a figure look measured.
 */
export function parseCalibrationResponse(res: CalibrationResponse): CalibrationSet | null {
  if (res.status !== 200) return null;
  const parsed = CalibrationSet.safeParse(res.body);
  return parsed.success ? parsed.data : null;
}

/** The patterns that clear the sample floor. The rest are ignored by Teams. */
export function patternsAboveFloor(set: CalibrationSet, minSample = CALIBRATION_MIN_SAMPLE): PatternPrior[] {
  return set.patterns.filter((p) => p.sampleSize >= minSample);
}
