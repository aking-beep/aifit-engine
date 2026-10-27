import { authenticate, createSession, rateLimit } from '@aifit/platform';
import { assertSameOrigin, clientKey, errorResponse, json, readBody, requireStore, sessionCookie } from '@/server/platform';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const store = requireStore();
    const body = await readBody(req, 4096);
    const email = String(body.email ?? '').trim().toLowerCase();
    // Per address and per client, so neither a botnet on one account nor one client on many gets far.
    await rateLimit(store, 'login-ip', clientKey(req), 30, 900);
    await rateLimit(store, 'login-email', email, 10, 900);
    const user = await authenticate(store, { email, password: String(body.password ?? '') });
    const { token } = await createSession(store, user.id);
    const res = json({ user: { id: user.id, email: user.email, name: user.name } });
    res.cookies.set(sessionCookie(token));
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
