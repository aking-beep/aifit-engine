import { Workload } from '@aifit/teams-core';
import { audit, getAssessment, requireEntitlement } from '@aifit/platform';
import { buildBlueprint, renderBlueprint } from '@aifit/deliverables';
import { billing, errorResponse, requireStore, requireViewer } from '@/server/platform';

export const dynamic = 'force-dynamic';

/**
 * The technical blueprint for a saved assessment, as JSON or Markdown.
 * Entitlement is checked on the server from stored, webhook-written state.
 * `generatedAt` is the record's own timestamp, so a version always downloads
 * as the same document.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const format = new URL(req.url).searchParams.get('format') === 'md' ? 'md' : 'json';
    const v = await requireViewer();
    const store = requireStore();
    const rec = await getAssessment(store, v.ctx, id);
    await requireEntitlement(store, v.ctx, billing(), 'blueprint', rec.rootId);
    const { blueprint } = buildBlueprint(Workload.parse(rec.workload), {
      generatedAt: rec.createdAt,
      assessment: { id: rec.id, rootId: rec.rootId, version: rec.version },
    });
    const file = renderBlueprint(blueprint, format);
    await audit(store, v.ctx.orgId, v.ctx.userId, 'export.blueprint', { id: rec.id, format });
    return new Response(file.body, {
      headers: {
        'content-type': file.contentType,
        'content-disposition': `attachment; filename="${file.filename}"`,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
