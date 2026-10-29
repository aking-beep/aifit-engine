import { createPasswordReset, rateLimit } from '@aifit/platform';
import { email, sendReset } from '@/server/email';
import { assertSameOrigin, clientKey, errorResponse, json, readBody, requireStore } from '@/server/platform';

export const dynamic = 'force-dynamic';

/** Always the same answer, whether or not the email has an account. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const store = requireStore();
    if (!email().enabled) return json({ error: 'Password reset by email is not set up on this deployment. Contact support to reset your password.', code: 'unavailable' }, { status: 503 });
    const body = await readBody(req, 2048);
    const address = String(body.email ?? '').trim().toLowerCase();
    await rateLimit(store, 'reset-ip', clientKey(req), 10, 3600);
    await rateLimit(store, 'reset-email', address, 3, 3600);
    const reset = await createPasswordReset(store, address);
    if (reset) await sendReset(reset.user.email, reset.token);
    return json({ sent: true, message: 'If an account uses that email, a reset link is on its way. It works for 30 minutes.' });
  } catch (e) {
    return errorResponse(e);
  }
}
