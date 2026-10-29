import { reassess } from '@aifit/platform';
import { assertSameOrigin, errorResponse, json, readBody, requireStore, requireViewer } from '@/server/platform';
import { snapshotFor, workloadFrom } from '@/server/assessments';

export const dynamic = 'force-dynamic';

/** Save new answers as the next version of an existing assessment. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { id } = await params;
    const v = await requireViewer();
    const body = await readBody(req, 32 * 1024);
    const w = workloadFrom(body.w);
    const rec = await reassess(requireStore(), v.ctx, id, { title: w.name, workload: w, snapshot: snapshotFor(w) });
    return json({ id: rec.id, version: rec.version, rootId: rec.rootId }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
