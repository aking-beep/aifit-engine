import { z } from 'zod';
import { OUTCOME_LABEL } from './engine.js';
import type { DecisionResult, Outcome } from './schema.js';

/**
 * Optional model-written explanation of a decision that rules already made.
 *
 * The model never decides. It receives the structured result (never the
 * person's free text, which may hold personal data or injected instructions),
 * and its reply must match `ModelExplanation` exactly. A reply that fails the
 * schema, times out, or names a different outcome is discarded and the
 * rule-written explanation is used instead. The page labels which one it shows.
 */

export const ModelExplanation = z.object({
  summary: z.string().trim().min(1).max(800),
  keyPoints: z.array(z.string().trim().min(1).max(300)).max(6),
}).strict();
export type ModelExplanation = z.infer<typeof ModelExplanation>;

export interface ExplainRequest {
  task: 'explain-decision';
  instructions: string;
  decision: Pick<DecisionResult, 'outcome' | 'runnerUp' | 'confidence' | 'summary' | 'requiredControls' | 'missingInputs' | 'whatWouldChange'> & {
    outcomeLabel: string;
    hardConstraints: { id: string; detail: string }[];
    topFactors: { factor: string; points: number }[];
  };
  responseSchema: { summary: 'string (max 800 chars)'; keyPoints: 'string[] (max 6, each max 300 chars)' };
}

export type ExplainerAdapter = (request: ExplainRequest) => Promise<unknown>;

export interface Explanation {
  source: 'model' | 'rules';
  summary: string;
  keyPoints: string[];
  /** Why a model reply was not used, when one was requested. */
  rejected?: string;
}

export function rulesExplanation(r: DecisionResult): Explanation {
  const top = r.outcomeScores.find((o) => o.outcome === r.outcome)!;
  return {
    source: 'rules',
    summary: r.summary,
    keyPoints: [
      ...top.contributions.filter((c) => c.factor !== 'base' && c.points > 0).slice(0, 3).map((c) => `In favour: ${c.factor} (+${c.points}).`),
      ...r.hardConstraints.filter((h) => h.triggered).slice(0, 2).map((h) => h.detail),
    ],
  };
}

export function buildExplainRequest(r: DecisionResult): ExplainRequest {
  const top = r.outcomeScores.find((o) => o.outcome === r.outcome)!;
  return {
    task: 'explain-decision',
    instructions:
      'Explain this already-made decision in plain language for the person who asked. Do not change, question or re-rank the outcome. Do not add prices, certifications or performance figures that are not in the input. Reply with JSON only, matching responseSchema.',
    decision: {
      outcome: r.outcome,
      outcomeLabel: OUTCOME_LABEL[r.outcome],
      runnerUp: r.runnerUp,
      confidence: r.confidence,
      summary: r.summary,
      requiredControls: r.requiredControls,
      missingInputs: r.missingInputs,
      whatWouldChange: r.whatWouldChange,
      hardConstraints: r.hardConstraints.filter((h) => h.triggered).map((h) => ({ id: h.id, detail: h.detail })),
      topFactors: top.contributions.filter((c) => c.factor !== 'base'),
    },
    responseSchema: { summary: 'string (max 800 chars)', keyPoints: 'string[] (max 6, each max 300 chars)' },
  };
}

/** True if the text recommends an outcome other than the one decided. */
function namesOtherOutcome(text: string, chosen: Outcome): boolean {
  const lower = text.toLowerCase();
  return (Object.keys(OUTCOME_LABEL) as Outcome[]).some((o) =>
    o !== chosen && (lower.includes(o) || lower.includes(OUTCOME_LABEL[o].toLowerCase())));
}

export async function explain(r: DecisionResult, adapter: ExplainerAdapter | null, timeoutMs = 4000): Promise<Explanation> {
  const fallback = rulesExplanation(r);
  if (!adapter) return fallback;
  let raw: unknown;
  try {
    raw = await Promise.race([
      adapter(buildExplainRequest(r)),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ]);
  } catch (e) {
    return { ...fallback, rejected: e instanceof Error && e.message === 'timeout' ? 'timed out' : 'adapter failed' };
  }
  const parsed = ModelExplanation.safeParse(raw);
  if (!parsed.success) return { ...fallback, rejected: 'reply did not match the schema' };
  const all = [parsed.data.summary, ...parsed.data.keyPoints].join('\n');
  if (namesOtherOutcome(all, r.outcome)) return { ...fallback, rejected: 'reply named a different outcome' };
  return { source: 'model', summary: parsed.data.summary, keyPoints: parsed.data.keyPoints };
}

/**
 * Provider-neutral HTTP adapter: POSTs the request to an endpoint you run
 * (which holds any model keys) and returns its JSON. Off unless configured.
 */
export function httpExplainer(url: string | undefined, token?: string): ExplainerAdapter | null {
  if (!url) return null;
  return async (request) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(request),
    });
    if (!res.ok) throw new Error(`explainer ${res.status}`);
    return res.json();
  };
}
