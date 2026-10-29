import { parseRiskEdit } from '@aifit/deliverables';
import { PlatformError, readRiskEdits, saveRiskEdit } from '@aifit/platform';
import { assertSameOrigin, errorResponse, json, readBody, requireStore, requireViewer } from '@/server/platform';

export const dynamic = 'force-dynamic';

/** Risk register edits for a saved assessment. Org-scoped; members and above may edit. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const v = await requireViewer();
    return json({ edits: await readRiskEdits(requireStore(), v.ctx, id) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { id } = await params;
    const v = await requireViewer();
    const body = await readBody(req, 4 * 1024);
    const edit = parseRiskEdit(body.edit);
    if (!edit || typeof body.riskId !== 'string') throw new PlatformError('invalid', 'Nothing valid to save.');
    return json({ edits: await saveRiskEdit(requireStore(), v.ctx, id, body.riskId, { ...edit }) });
  } catch (e) {
    return errorResponse(e);
  }
}
