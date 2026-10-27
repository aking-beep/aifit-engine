import { contextFor, createOrg, PlatformError } from '@aifit/platform';
import { ORG_COOKIE, assertSameOrigin, errorResponse, json, readBody, requireStore, requireViewer } from '@/server/platform';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const v = await requireViewer();
    return json({ user: v.user, active: v.org, workspaces: v.orgs });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Switch the active workspace ({orgId}) or create one ({name}). */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const v = await requireViewer();
    const store = requireStore();
    const body = await readBody(req, 2048);
    let orgId: string;
    if (typeof body.orgId === 'string') {
      orgId = (await contextFor(store, v.user.id, body.orgId)).orgId;
    } else if (typeof body.name === 'string') {
      if (v.orgs.length >= 20) throw new PlatformError('conflict', 'You can belong to at most 20 workspaces.');
      orgId = (await createOrg(store, v.user.id, body.name)).id;
    } else {
      throw new PlatformError('invalid', 'Send orgId to switch or name to create.');
    }
    const res = json({ orgId });
    res.cookies.set({ name: ORG_COOKIE, value: orgId, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
