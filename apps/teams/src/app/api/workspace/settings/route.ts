import { readOrgProfile, renameOrg, saveOrgProfile } from '@aifit/platform';
import { assertSameOrigin, errorResponse, json, readBody, requireStore, requireViewer } from '@/server/platform';

export const dynamic = 'force-dynamic';

/** The active workspace's name and profile. Reading needs membership; changing needs admin. */
export async function GET() {
  try {
    const v = await requireViewer();
    return json({ name: v.org.name, profile: await readOrgProfile(requireStore(), v.ctx) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const v = await requireViewer();
    const store = requireStore();
    const body = await readBody(req, 4 * 1024);
    const out: Record<string, unknown> = {};
    if (body.name !== undefined) out.name = (await renameOrg(store, v.ctx, body.name)).name;
    if (body.profile !== undefined) out.profile = await saveOrgProfile(store, v.ctx, body.profile);
    return json(out);
  } catch (e) {
    return errorResponse(e);
  }
}
