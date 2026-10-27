import { deleteAssessment, getAssessment, versions } from '@aifit/platform';
import { assertSameOrigin, errorResponse, json, requireStore, requireViewer } from '@/server/platform';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const v = await requireViewer();
    const store = requireStore();
    const rec = await getAssessment(store, v.ctx, id);
    const history = (await versions(store, v.ctx, rec.rootId)).map(({ workload: _w, ...r }) => r);
    return json({ assessment: rec, versions: history });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    assertSameOrigin(req);
    const { id } = await params;
    const v = await requireViewer();
    await deleteAssessment(requireStore(), v.ctx, id);
    return json({ deleted: true });
  } catch (e) {
    return errorResponse(e);
  }
}
