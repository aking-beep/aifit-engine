import { intakeAgent, runAgent } from '@aifit/agents';
import { assertSameOrigin, errorResponse, json, readBody } from '@/server/platform';
import { agentContext, agentGate, agents } from '@/server/agents';

export const dynamic = 'force-dynamic';

/**
 * Suggest intake answers from the person's description. Returns only
 * suggestions whose evidence appears in the text; the form applies one only
 * when the person clicks Apply. Nothing is stored.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const body = await readBody(req, 16 * 1024);
    if (!agents().enabled) return json({ status: 'disabled', reason: agents().reason, suggestions: [], questions: [] });
    await agentGate(req);
    const run = await runAgent(intakeAgent, { text: body.text, surface: 'teams' }, agentContext('intake'));
    const r = run.result ?? { suggestions: [], questions: [], dropped: [] };
    return json({ status: run.status, suggestions: r.suggestions, questions: r.questions, droppedCount: r.dropped.length });
  } catch (e) {
    return errorResponse(e);
  }
}
