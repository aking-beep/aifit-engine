import { Workload } from '@aifit/teams-core';
import { audit, getAssessment, requireEntitlement, authorize } from '@aifit/platform';
import { buildBlueprint, buildControlExport, controlAdapterFromEnv, renderControlExport } from '@aifit/deliverables';
import { assertSameOrigin, billing, errorResponse, json, requireStore, requireViewer } from '@/server/platform';

export const dynamic = 'force-dynamic';

async function exportFor(req: Request, id: string) {
  const v = await requireViewer();
  const store = requireStore();
  const rec = await getAssessment(store, v.ctx, id);
  await requireEntitlement(store, v.ctx, billing(), 'control-export', rec.rootId);
  const bundle = buildBlueprint(Workload.parse(rec.workload), { generatedAt: rec.createdAt, assessment: { id: rec.id, rootId: rec.rootId, version: rec.version } });
  return { v, store, rec, doc: buildControlExport(bundle) };
}

/** Download governance-export.json (GovernanceExport v1, recommendations only). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { v, store, rec, doc } = await exportFor(req, id);
    const file = renderControlExport(doc);
    await audit(store, v.ctx.orgId, v.ctx.userId, 'export.control', { id: rec.id, delivery: 'download' });
    return new Response(file.body, {
      headers: { 'content-type': file.contentType, 'content-disposition': `attachment; filename="${file.filename}"`, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
    });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Send it to ARC Control over HTTP, when an operator has configured CONTROL_EXPORT_URL. Admins only. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { id } = await params;
    const { v, store, rec, doc } = await exportFor(req, id);
    authorize(v.ctx, 'members:manage');
    const adapter = controlAdapterFromEnv(process.env);
    if (!adapter) return json({ delivered: false, adapter: 'none', detail: 'No Control endpoint is configured on this deployment. Download the file and import it in Control.' });
    const result = await adapter.deliver(doc);
    await audit(store, v.ctx.orgId, v.ctx.userId, 'export.control', { id: rec.id, delivery: adapter.name, delivered: result.delivered });
    return json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
