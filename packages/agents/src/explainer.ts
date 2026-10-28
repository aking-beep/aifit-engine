import * as z from 'zod/v4';
import { buildExplainRequest, explain, type DecisionResult, type ExplainRequest, type Explanation } from '@aifit/decision-core';
import { runAgent, type AgentSpec, type RunContext, type AgentRun } from './harness.js';

/**
 * Decision explainer. The decision engine already made the decision; this
 * agent only puts it in plain language. decision-core's `explain()` is the
 * final gate: it re-validates the reply and discards one that names another
 * outcome, falling back to the rule-written explanation.
 */

const ExplanationOutput = z.object({
  summary: z.string().max(800),
  keyPoints: z.array(z.string().max(300)).max(6),
});

export const explainerAgent: AgentSpec<ExplainRequest, z.infer<typeof ExplanationOutput>, z.infer<typeof ExplanationOutput>> = {
  name: 'decision-explainer',
  version: '1.0.0',
  prompt: 'explainer',
  input: z.custom<ExplainRequest>((v) => typeof v === 'object' && v !== null && (v as ExplainRequest).task === 'explain-decision'),
  output: ExplanationOutput,
  effort: 'low',
  maxTokens: 2000,
  timeoutMs: 20_000,
  render: (req) => `The decision, as structured data:\n<decision>\n${JSON.stringify(req.decision, null, 2)}\n</decision>`,
  check: (_i, o) => ({ result: o, problems: [] }),
};

/** Explain a decision, using the model when available and the rules otherwise. Never throws. */
export async function explainDecision(d: DecisionResult, ctx: RunContext): Promise<{ explanation: Explanation; run: AgentRun<unknown> | null }> {
  let run: AgentRun<unknown> | null = null;
  const explanation = await explain(d, ctx.client
    ? async (request) => {
        run = await runAgent(explainerAgent, request, ctx);
        if (run.status !== 'ok') throw new Error(run.status);
        return run.result;
      }
    : null);
  return { explanation, run };
}

export { buildExplainRequest };
