import { assess } from '@aifit/teams-core';
import { explainDecision } from '@aifit/agents';
import { assertSameOrigin, errorResponse, json, readBody } from '@/server/platform';
import { decisionFor, workloadFrom } from '@/server/assessments';
import { agentContext, agentGate, agents } from '@/server/agents';

export const dynamic = 'force-dynamic';

/**
 * Plain-language explanation of a report's decision. The decision is
 * recomputed here from the report link, never taken from the client, and the
 * explainer sees only the structured result, not the workload's free text.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const body = await readBody(req, 32 * 1024);
    const d = decisionFor(assess(workloadFrom(body.w)));
    const on = agents().enabled;
    if (on) await agentGate(req);
    const ctx = agentContext('explainer');
    const { explanation, run } = await explainDecision(d, on ? ctx : { ...ctx, client: null });
    return json({ status: run?.status ?? 'disabled', outcome: d.outcome, explanation });
  } catch (e) {
    return errorResponse(e);
  }
}
