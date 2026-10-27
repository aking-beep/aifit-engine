import { cookies } from 'next/headers';
import { revokeSession } from '@aifit/platform';
import { ORG_COOKIE, SESSION_COOKIE, assertSameOrigin, clearCookie, errorResponse, json, requireStore } from '@/server/platform';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const store = requireStore();
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (token) await revokeSession(store, token);
    const res = json({ ok: true });
    res.cookies.set(clearCookie(SESSION_COOKIE));
    res.cookies.set(clearCookie(ORG_COOKIE));
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
