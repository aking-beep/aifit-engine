import { createSession, rateLimit, signup } from '@aifit/platform';
import { assertSameOrigin, clientKey, errorResponse, json, readBody, requireStore, sessionCookie } from '@/server/platform';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const store = requireStore();
    await rateLimit(store, 'signup', clientKey(req), 20, 3600);
    const body = await readBody(req, 4096);
    const user = await signup(store, {
      email: String(body.email ?? ''),
      password: String(body.password ?? ''),
      name: String(body.name ?? ''),
      orgName: typeof body.orgName === 'string' ? body.orgName : undefined,
    });
    const { token } = await createSession(store, user.id);
    const res = json({ user: { id: user.id, email: user.email, name: user.name } }, { status: 201 });
    res.cookies.set(sessionCookie(token));
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
