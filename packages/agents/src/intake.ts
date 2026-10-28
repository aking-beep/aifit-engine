import * as z from 'zod/v4';
import type { AgentSpec } from './harness.js';
import { dataBlock } from './harness.js';
import { quoteAppears } from './text.js';

/**
 * Intake interpreter: reads the person's own description of a task and
 * suggests answers to the structured form. Suggestions are never applied
 * automatically; the decision engine scores only fields the person confirms.
 * A suggestion survives only if its evidence quote appears in the text.
 */

export const INTAKE_FIELDS = [
  'workTypes', 'frequencyPerMonth', 'minutesPerOccurrence', 'correctness', 'errorImpact', 'dataClasses', 'localOnly', 'integrations',
] as const;
export type IntakeField = (typeof INTAKE_FIELDS)[number];

const WORK_TYPES = ['classify', 'extract', 'summarize', 'generate', 'converse', 'search', 'decide', 'act', 'transfer', 'calculate', 'lookup', 'record'];
const DATA_CLASSES = ['public', 'internal', 'pii', 'sensitive_pii', 'phi', 'pci', 'financial', 'credentials', 'trade_secret', 'minors'];
const CORRECTNESS = ['exact', 'tolerant', 'subjective'];
const IMPACT = ['low', 'medium', 'high', 'critical'];

export const IntakeAgentInput = z.object({
  text: z.string().trim().min(10).max(4000),
  surface: z.enum(['consumer', 'teams']).default('consumer'),
});
export type IntakeAgentInput = z.infer<typeof IntakeAgentInput>;

/** Deliberately flat (every value is a string) so the same schema works in both languages' structured outputs. */
export const IntakeAgentOutput = z.object({
  suggestions: z.array(z.object({
    field: z.enum(INTAKE_FIELDS),
    value: z.string(),
    evidence: z.string(),
    confidence: z.enum(['low', 'medium', 'high']),
  })).max(16),
  questions: z.array(z.string()).max(5),
});
export type IntakeAgentOutput = z.infer<typeof IntakeAgentOutput>;

export type SuggestedValue = string | number | boolean | string[];

export interface IntakeSuggestion {
  field: IntakeField;
  value: SuggestedValue;
  evidence: string;
  confidence: 'low' | 'medium' | 'high';
}

export interface IntakeResult {
  suggestions: IntakeSuggestion[];
  questions: string[];
  dropped: { field: string; reason: string }[];
}

function list(raw: string, allowed: string[]): string[] {
  return Array.from(new Set(raw.split(',').map((s) => s.trim().toLowerCase()).filter((s) => allowed.includes(s)))).sort();
}

/** Parse one suggestion's string value for its field, or explain why it cannot be used. */
export function parseValue(field: IntakeField, raw: string): { value: SuggestedValue } | { reason: string } {
  const v = raw.trim();
  switch (field) {
    case 'workTypes': {
      const xs = list(v, WORK_TYPES);
      return xs.length ? { value: xs } : { reason: 'no_valid_values' };
    }
    case 'dataClasses': {
      const xs = list(v, DATA_CLASSES);
      return xs.length ? { value: xs } : { reason: 'no_valid_values' };
    }
    case 'frequencyPerMonth':
    case 'minutesPerOccurrence': {
      if (!/^\d+(\.\d+)?$/.test(v)) return { reason: 'not_a_number' };
      const n = Number(v);
      return n <= 1_000_000 ? { value: n } : { reason: 'out_of_range' };
    }
    case 'correctness':
      return CORRECTNESS.includes(v.toLowerCase()) ? { value: v.toLowerCase() } : { reason: 'not_an_option' };
    case 'errorImpact':
      return IMPACT.includes(v.toLowerCase()) ? { value: v.toLowerCase() } : { reason: 'not_an_option' };
    case 'localOnly':
      return v.toLowerCase() === 'true' ? { value: true } : v.toLowerCase() === 'false' ? { value: false } : { reason: 'not_a_boolean' };
    case 'integrations': {
      const xs = Array.from(new Set(v.split(',').map((s) => s.trim()).filter((s) => s.length >= 1 && s.length <= 80))).slice(0, 20);
      return xs.length ? { value: xs } : { reason: 'no_valid_values' };
    }
  }
}

/** The deterministic gate between the model and the form. Shared fixtures pin the Python mirror to it. */
export function checkIntake(text: string, output: IntakeAgentOutput): IntakeResult {
  const seen = new Set<string>();
  const suggestions: IntakeSuggestion[] = [];
  const dropped: IntakeResult['dropped'] = [];
  for (const s of output.suggestions) {
    if (seen.has(s.field)) { dropped.push({ field: s.field, reason: 'duplicate_field' }); continue; }
    if (s.evidence.length > 120 || !quoteAppears(s.evidence, text)) { dropped.push({ field: s.field, reason: 'evidence_not_in_text' }); continue; }
    const parsed = parseValue(s.field, s.value);
    if ('reason' in parsed) { dropped.push({ field: s.field, reason: parsed.reason }); continue; }
    seen.add(s.field);
    suggestions.push({ field: s.field, value: parsed.value, evidence: s.evidence.trim(), confidence: s.confidence });
  }
  const questions = output.questions.map((q) => q.trim()).filter((q) => q.length > 0 && q.length <= 200).slice(0, 3);
  return { suggestions, questions, dropped };
}

export const intakeAgent: AgentSpec<IntakeAgentInput, IntakeAgentOutput, IntakeResult> = {
  name: 'intake-interpreter',
  version: '1.0.0',
  prompt: 'intake',
  input: IntakeAgentInput,
  output: IntakeAgentOutput,
  effort: 'low',
  maxTokens: 4000,
  timeoutMs: 30_000,
  render: (i) => `Form surface: ${i.surface}.\nThe person's description of the task:\n${dataBlock('description', i.text)}`,
  check: (i, o) => {
    const r = checkIntake(i.text, o);
    return { result: r, problems: r.dropped.map((d) => `Dropped ${d.field}: ${d.reason}`) };
  },
};
