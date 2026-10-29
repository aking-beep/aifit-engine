import { listAssessments, saveAssessment } from '@aifit/platform';
import { assertSameOrigin, errorResponse, json, readBody, requireStore, requireViewer } from '@/server/platform';
import { snapshotFor, workloadFrom } from '@/server/assessments';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const v = await requireViewer();
    const rows = await listAssessments(requireStore(), v.ctx);
    return json({ assessments: rows.map(({ workload: _w, ...r }) => r) });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Save the assessment in `w` (the report link's payload) to the active workspace. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const v = await requireViewer();
    const body = await readBody(req, 32 * 1024);
    const w = workloadFrom(body.w);
    const rec = await saveAssessment(requireStore(), v.ctx, {
      title: (typeof body.title === 'string' && body.title.trim()) || w.name,
      workload: w,
      snapshot: snapshotFor(w),
    });
    return json({ id: rec.id, version: rec.version }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
