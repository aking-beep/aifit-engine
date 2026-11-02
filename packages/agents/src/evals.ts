import { isDeepStrictEqual } from 'node:util';
import { decide } from '@aifit/decision-core';
import { runAgent, type RunContext, type RunStatus } from './harness.js';
import { intakeAgent, type IntakeResult } from './intake.js';
import { explainDecision } from './explainer.js';
import { priceVerifierAgent, type VerifiedPrices } from './price-verifier.js';
import { registryVerifierAgent, type VerifiedProduct } from './registry-verifier.js';
import { loadJson } from './fixtures.js';

/**
 * Eval cases and their deterministic graders. The same files run offline
 * (inputs must validate) and live (eval-cli, which needs a key and costs money).
 */

export interface IntakeCase { id: string; text: string; expect: Record<string, unknown>; forbid: string[]; minQuestions?: number }
export interface ExplainerCase { id: string; input: Record<string, unknown> }
export interface PriceCase { id: string; input: Record<string, unknown>; expect: Partial<VerifiedPrices> & { found: boolean } }
export interface RegistryCase { id: string; input: Record<string, unknown>; expect: { status: VerifiedProduct['status']; currentName?: string } }

export const EVAL_FILES = {
  intake: 'evals/intake.json',
  /** Synthetic customer personas: realistic, messy descriptions across industries. Same grader. */
  intakePersonas: 'evals/intake-personas.json',
  explainer: 'evals/explainer.json',
  price: 'evals/price-verifier.json',
  registry: 'evals/registry-verifier.json',
} as const;

export function loadCases<T>(file: string): T[] {
  return loadJson<{ cases: T[] }>(file).cases;
}

export function gradeIntake(c: IntakeCase, r: IntakeResult | null): string[] {
  if (!r) return ['no result'];
  const got = new Map(r.suggestions.map((s) => [s.field as string, s.value]));
  const fails: string[] = [];
  for (const [field, want] of Object.entries(c.expect)) {
    const v = got.get(field);
    if (v === undefined) { fails.push(`${field}: not suggested`); continue; }
    const ok = Array.isArray(want) && want.length === 2 && typeof want[0] === 'number'
      ? typeof v === 'number' && v >= (want[0] as number) && v <= (want[1] as number)
      : Array.isArray(want) && Array.isArray(v)
        ? (want as string[]).every((w) => (v as string[]).map((x) => x.toLowerCase()).includes(w.toLowerCase()))
        : isDeepStrictEqual(v, want);
    if (!ok) fails.push(`${field}: got ${JSON.stringify(v)}, want ${JSON.stringify(want)}`);
  }
  for (const f of c.forbid) if (got.has(f)) fails.push(`${f}: should not be suggested`);
  if (c.minQuestions && r.questions.length < c.minQuestions) fails.push(`asked ${r.questions.length} questions, want ≥${c.minQuestions}`);
  return fails;
}

export function gradePrice(c: PriceCase, r: VerifiedPrices | null): string[] {
  if (!r) return ['no result'];
  const fails: string[] = [];
  for (const [k, want] of Object.entries(c.expect)) {
    const v = (r as unknown as Record<string, unknown>)[k];
    if (!isDeepStrictEqual(v, want)) fails.push(`${k}: got ${JSON.stringify(v)}, want ${JSON.stringify(want)}`);
  }
  return fails;
}

export function gradeRegistry(c: RegistryCase, r: VerifiedProduct | null): string[] {
  if (!r) return ['no result'];
  const fails: string[] = [];
  if (r.status !== c.expect.status) fails.push(`status: got ${r.status}, want ${c.expect.status}`);
  if (c.expect.currentName !== undefined && r.currentName !== c.expect.currentName) fails.push(`currentName: got ${r.currentName}, want ${c.expect.currentName}`);
  return fails;
}

export interface EvalOutcome { agent: string; id: string; status: RunStatus | 'rules'; pass: boolean; fails: string[] }

export async function runEvals(contexts: Record<'intake' | 'explainer' | 'price' | 'registry', RunContext>): Promise<EvalOutcome[]> {
  const out: EvalOutcome[] = [];
  for (const c of [...loadCases<IntakeCase>(EVAL_FILES.intake), ...loadCases<IntakeCase>(EVAL_FILES.intakePersonas)]) {
    const run = await runAgent(intakeAgent, { text: c.text }, contexts.intake);
    const fails = run.status === 'ok' ? gradeIntake(c, run.result) : [run.status];
    out.push({ agent: intakeAgent.name, id: c.id, status: run.status, pass: fails.length === 0, fails });
  }
  for (const c of loadCases<ExplainerCase>(EVAL_FILES.explainer)) {
    const { explanation, run } = await explainDecision(decide(c.input), contexts.explainer);
    const fails = explanation.source === 'model' ? [] : [`fell back to the rules (${run?.status ?? 'no run'})`];
    out.push({ agent: 'decision-explainer', id: c.id, status: run?.status ?? 'rules', pass: fails.length === 0, fails });
  }
  for (const c of loadCases<PriceCase>(EVAL_FILES.price)) {
    const run = await runAgent(priceVerifierAgent, c.input, contexts.price);
    const fails = run.status === 'ok' ? gradePrice(c, run.result) : [run.status];
    out.push({ agent: priceVerifierAgent.name, id: c.id, status: run.status, pass: fails.length === 0, fails });
  }
  for (const c of loadCases<RegistryCase>(EVAL_FILES.registry)) {
    const run = await runAgent(registryVerifierAgent, c.input, contexts.registry);
    const fails = run.status === 'ok' ? gradeRegistry(c, run.result) : [run.status];
    out.push({ agent: registryVerifierAgent.name, id: c.id, status: run.status, pass: fails.length === 0, fails });
  }
  return out;
}
