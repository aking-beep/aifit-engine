import { buildBlueprint, renderBlueprint } from '@aifit/deliverables';
import { PlatformError } from '@aifit/platform';
import { billing, errorResponse } from '@/server/platform';
import { workloadFrom } from '@/server/assessments';

export const dynamic = 'force-dynamic';

/**
 * Blueprint straight from a report link, with no account. Only while billing
 * is off; once billing is on, the blueprint is a paid deliverable of a saved
 * assessment and this route says so.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    if (billing().enabled) throw new PlatformError('payment_required', 'Save this assessment to a workspace to download its blueprint.');
    const w = workloadFrom(url.searchParams.get('w'));
    const format = url.searchParams.get('format') === 'md' ? 'md' : 'json';
    const file = renderBlueprint(buildBlueprint(w, { generatedAt: new Date().toISOString(), assessment: null }).blueprint, format);
    return new Response(file.body, {
      headers: { 'content-type': file.contentType, 'content-disposition': `attachment; filename="${file.filename}"`, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
