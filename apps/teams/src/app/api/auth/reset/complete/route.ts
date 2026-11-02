import { completePasswordReset, rateLimit } from '@aifit/platform';
import { sendPasswordChanged } from '@/server/email';
import { assertSameOrigin, clientKey, errorResponse, json, readBody, requireStore } from '@/server/platform';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const store = requireStore();
    await rateLimit(store, 'reset-complete', clientKey(req), 20, 3600);
    const body = await readBody(req, 2048);
    const user = await completePasswordReset(store, { token: String(body.token ?? ''), password: String(body.password ?? '') });
    await sendPasswordChanged(user.email).catch(() => false);
    return json({ reset: true });
  } catch (e) {
    return errorResponse(e);
  }
}
