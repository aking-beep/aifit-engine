import { acceptInvite } from '@aifit/platform';
import { ORG_COOKIE, assertSameOrigin, errorResponse, json, readBody, requireStore, requireViewer } from '@/server/platform';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const v = await requireViewer();
    const body = await readBody(req, 1024);
    const ctx = await acceptInvite(requireStore(), v.user.id, String(body.token ?? ''));
    const res = json({ orgId: ctx.orgId, role: ctx.role });
    res.cookies.set({ name: ORG_COOKIE, value: ctx.orgId, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
