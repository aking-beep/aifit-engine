import type { DataClass, DecisionIntakeInput, Regulation, WorkType } from './schema.js';

/**
 * The fields of a Teams `Workload` (packages/teams-core) the decision engine
 * reads. Declared structurally so this package does not depend on teams-core.
 */
export interface WorkloadLike {
  name: string;
  description?: string;
  task: readonly string[];
  volume: { unitsPerMonth: number };
  input: { sourceSystems: readonly string[] };
  determinism: 'exact' | 'tolerant' | 'subjective';
  errorTolerance: 'none' | 'low' | 'medium' | 'high';
  dataClasses: readonly string[];
  actions: readonly { system: string; blastRadius: string }[];
  autonomy: 'suggest' | 'approve' | 'bounded' | 'full';
  regulated: readonly string[];
  dataResidency: 'any' | 'us' | 'eu' | 'on_prem';
  current: { minutesPerUnit?: number; fullyLoadedHourlyUsd?: number };
  team: { engineers: number; hasMlExperience: boolean; hasSecurityReview: boolean };
  planning?: {
    monthlyBudgetUsd?: number;
    oneTimeBudgetUsd?: number;
    timelineWeeks?: number;
    offTheShelfAcceptable?: boolean;
    currentWorksWell?: boolean;
  };
}

const ERROR_IMPACT = { none: 'critical', low: 'high', medium: 'medium', high: 'low' } as const;
const SHAPES = new Set<string>(['classify', 'extract', 'summarize', 'generate', 'converse', 'search', 'decide', 'act', 'calculate', 'lookup']);

export function decisionIntakeFromWorkload(
  w: WorkloadLike,
  runCost?: { low: number; high: number; basis: 'heuristic' | 'benchmark' | 'calibrated' | 'measured'; source: string } | null,
): DecisionIntakeInput {
  const engineers = Math.floor(w.team.engineers);
  const workTypes = w.task.filter((t) => SHAPES.has(t)) as WorkType[];
  return {
    schemaVersion: '1',
    surface: 'teams',
    goal: [w.name, w.description].filter(Boolean).join(' — ').slice(0, 2000),
    workTypes: workTypes.length > 0 ? workTypes : ['decide'],
    frequencyPerMonth: w.volume.unitsPerMonth,
    minutesPerOccurrence: w.current.minutesPerUnit ?? null,
    currentApproach: 'manual',
    currentWorksWell: w.planning?.currentWorksWell ?? false,
    correctness: w.determinism,
    errorImpact: ERROR_IMPACT[w.errorTolerance],
    role: 'manager',
    technicalAbility: engineers > 0 ? (w.team.hasMlExperience ? 'advanced' : 'intermediate') : 'basic',
    org: {
      size: engineers === 0 ? 'small' : engineers <= 15 ? 'small' : 'mid',
      engineers,
      hasMlExperience: w.team.hasMlExperience,
      hasSecurityReview: w.team.hasSecurityReview,
    },
    constraints: {
      dataClasses: [...w.dataClasses] as DataClass[],
      regulated: w.regulated.filter((r) => r !== 'none') as Regulation[],
      dataResidency: w.dataResidency,
      localOnly: w.dataResidency === 'on_prem',
      monthlyBudgetUsd: w.planning?.monthlyBudgetUsd ?? null,
      oneTimeBudgetUsd: w.planning?.oneTimeBudgetUsd ?? null,
      timelineWeeks: w.planning?.timelineWeeks ?? null,
      integrations: Array.from(new Set([...w.input.sourceSystems, ...w.actions.map((a) => a.system)])).slice(0, 20),
      autonomy: w.autonomy,
      irreversibleActions: w.actions.some((a) => a.blastRadius === 'irreversible'),
      offTheShelfAcceptable: w.planning?.offTheShelfAcceptable ?? true,
    },
    hourlyValueUsd: w.current.fullyLoadedHourlyUsd ?? null,
    externalEstimates: { runCostPerMonthUsd: runCost ?? null },
  };
}
