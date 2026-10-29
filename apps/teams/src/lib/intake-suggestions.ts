import type { DataClass, Determinism, ErrorTolerance, TaskShape } from '@aifit/teams-core';
import type { IntakeState } from './intake-state';

/**
 * Turns one checked intake-interpreter suggestion into a change to the Teams
 * intake. Pure, so it runs under `node --test`. Applied only when the person
 * clicks Apply; a suggestion that has no place in this form returns null and
 * is not offered.
 */

export interface AgentSuggestion {
  field: 'workTypes' | 'frequencyPerMonth' | 'minutesPerOccurrence' | 'correctness' | 'errorImpact' | 'dataClasses' | 'localOnly' | 'integrations';
  value: string | number | boolean | string[];
  evidence: string;
  confidence: 'low' | 'medium' | 'high';
}

const SHAPES: readonly TaskShape[] = ['classify', 'extract', 'summarize', 'generate', 'converse', 'search', 'decide', 'act', 'calculate', 'lookup'];
const DATA: readonly DataClass[] = ['public', 'internal', 'pii', 'sensitive_pii', 'phi', 'pci', 'financial', 'credentials', 'trade_secret', 'minors'];
const DETERMINISM: readonly Determinism[] = ['exact', 'tolerant', 'subjective'];
/** Consumer "how bad if wrong" to Teams "how much error is tolerable": the inverse scale. */
const TOLERANCE: Record<string, ErrorTolerance> = { critical: 'none', high: 'low', medium: 'medium', low: 'high' };

export const SUGGESTION_LABEL: Record<AgentSuggestion['field'], string> = {
  workTypes: 'Shape of the work',
  frequencyPerMonth: 'Units per month',
  minutesPerOccurrence: 'Minutes per unit today',
  correctness: 'Is there one right answer',
  errorImpact: 'Error tolerance',
  dataClasses: 'Data classes',
  localOnly: 'Data residency',
  integrations: 'Source systems',
};

const union = <T,>(a: readonly T[], b: readonly T[]) => Array.from(new Set([...a, ...b]));

export function patchFromSuggestion(s: AgentSuggestion, state: IntakeState): Partial<IntakeState> | null {
  switch (s.field) {
    case 'workTypes': {
      const add = (Array.isArray(s.value) ? s.value : []).filter((v): v is TaskShape => (SHAPES as readonly string[]).includes(v));
      return add.length ? { task: union(state.task, add) } : null;
    }
    case 'frequencyPerMonth':
      return typeof s.value === 'number' && s.value > 0 ? { unitsPerMonth: s.value } : null;
    case 'minutesPerOccurrence':
      return typeof s.value === 'number' && s.value > 0 ? { minutesPerUnit: s.value } : null;
    case 'correctness':
      return (DETERMINISM as readonly unknown[]).includes(s.value) ? { determinism: s.value as Determinism } : null;
    case 'errorImpact': {
      const t = typeof s.value === 'string' ? TOLERANCE[s.value] : undefined;
      return t ? { errorTolerance: t } : null;
    }
    case 'dataClasses': {
      const add = (Array.isArray(s.value) ? s.value : []).filter((v): v is DataClass => (DATA as readonly string[]).includes(v));
      return add.length ? { dataClasses: union(state.dataClasses, add) } : null;
    }
    case 'localOnly':
      // Only "must stay on our own systems" maps to a form answer; "false" is already the default.
      return s.value === true ? { dataResidency: 'on_prem' } : null;
    case 'integrations': {
      const add = Array.isArray(s.value) ? s.value : [];
      const existing = state.sourceSystems.split(',').map((x) => x.trim()).filter(Boolean);
      return add.length ? { sourceSystems: union(existing, add).join(', ') } : null;
    }
  }
}

/** What the person sees for a suggestion, in this form's terms. */
export function describePatch(p: Partial<IntakeState>): string {
  return Object.entries(p)
    .map(([, v]) => (Array.isArray(v) ? v.join(', ') : v === 'on_prem' ? 'on our own systems only' : String(v)))
    .join('; ');
}
